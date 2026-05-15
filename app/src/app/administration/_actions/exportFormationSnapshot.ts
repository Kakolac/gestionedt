"use server";

import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { Formation } from "@/lib/models/Formation";
import { Matiere } from "@/lib/models/Matiere";
import { Professeur } from "@/lib/models/Professeur";
import { PERMISSION_CREATION_FORMATION } from "@/lib/permissions/keys";
import type { PlanningExportRaw } from "@/lib/planning/planning.types";
import { extractDateDemarrageIsoDepuisValeurExport } from "@/lib/planning/planning-public-holidays";
import { mongoLeanToPlainJson } from "@/lib/serialization/mongoLeanToJson";

const MAX_FORMATIONS_PER_EXPORT = 80;
const MAX_JSON_CHARS = 800_000;
const SNAPSHOT_VERSION = 1 as const;

export type ExportFormationSnapshotState =
  | { ok: true; jsonText: string; filenameSuggested: string }
  | { ok: false; error: string };

function matiereIdsFromFormationLean(f: Record<string, unknown>): string[] {
  const rawLignes = f.lignes;
  if (Array.isArray(rawLignes) && rawLignes.length > 0) {
    const ids: string[] = [];
    for (const ligne of rawLignes) {
      if (
        typeof ligne !== "object" ||
        ligne == null ||
        !("matiereId" in ligne)
      ) {
        continue;
      }
      const mid = String((ligne as { matiereId: unknown }).matiereId);
      if (mid && mid !== "undefined") {
        ids.push(mid);
      }
    }
    if (ids.length > 0) return ids;
  }
  const raw = f.matiereIds;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((x) => String(x));
  }
  if (f.matiereId != null) {
    return [String(f.matiereId)];
  }
  return [];
}

function collectRefsFromFormationDocs(
  formationDocs: readonly Record<string, unknown>[]
): { matiereIdSet: Set<string>; profIdSet: Set<string> } {
  const matiereIdSet = new Set<string>();
  const profIdSet = new Set<string>();

  for (const f of formationDocs) {
    const lignesRaw = f.lignes;
    if (Array.isArray(lignesRaw)) {
      for (const ligne of lignesRaw) {
        if (
          typeof ligne !== "object" ||
          ligne == null ||
          !("matiereId" in ligne)
        ) {
          continue;
        }
        const mid = String((ligne as { matiereId: unknown }).matiereId);
        if (mongoose.isValidObjectId(mid)) {
          matiereIdSet.add(mid);
        }
        const pRaw = (ligne as { professeurIds?: unknown }).professeurIds;
        if (Array.isArray(pRaw)) {
          for (const p of pRaw) {
            const pid = String(p);
            if (mongoose.isValidObjectId(pid)) {
              profIdSet.add(pid);
            }
          }
        }
      }
    }

    const legacyP = f.professeurIds;
    if (Array.isArray(legacyP)) {
      for (const p of legacyP) {
        const pid = String(p);
        if (mongoose.isValidObjectId(pid)) {
          profIdSet.add(pid);
        }
      }
    }
    for (const mid of matiereIdsFromFormationLean(f)) {
      if (mongoose.isValidObjectId(mid)) {
        matiereIdSet.add(mid);
      }
    }
  }

  return { matiereIdSet, profIdSet };
}

export type LoadFormationPlanningSnapshotState =
  | { ok: true; rawData: PlanningExportRaw }
  | { ok: false; error: string };

/**
 * Construit le même jeu de données que l’export JSON (formations + matières + professeurs),
 * sérialisé en objets JSON plain.
 */
async function buildFormationSnapshotPlain(
  uniqueIds: string[]
): Promise<
  | { ok: true; plain: Record<string, unknown> }
  | { ok: false; error: string }
> {
  if (uniqueIds.length === 0) {
    return { ok: false, error: "Aucun identifiant de formation valide." };
  }

  await connectDB();
  const oids = uniqueIds.map((id) => new mongoose.Types.ObjectId(id));
  const formationsLean = await Formation.find({ _id: { $in: oids } })
    .populate('periodeVacancesIds')
    .lean()
    .exec();

  if (formationsLean.length === 0) {
    return { ok: false, error: "Aucune formation trouvée pour cette sélection." };
  }

  const asRecords = formationsLean as unknown as Record<string, unknown>[];
  
  // Fusionner datesVacances locales + périodes référentielles dans un seul champ datesVacances
  for (const formation of asRecords) {
    const datesVacancesLocales = Array.isArray(formation.datesVacances)
      ? formation.datesVacances
      : [];
    const periodesReferencees = Array.isArray(formation.periodeVacancesIds)
      ? formation.periodeVacancesIds
      : [];
    
    // Convertir les périodes référentielles en format datesVacances
    const datesFromRefs = periodesReferencees
      .filter((p: unknown): p is Record<string, unknown> => typeof p === 'object' && p !== null)
      .map((periode: Record<string, unknown>) => ({
        debut: String(periode.debut ?? ''),
        fin: String(periode.fin ?? ''),
        nom: String(periode.nom ?? ''),
      }))
      .filter((p: { debut: string; fin: string; nom: string }) => p.debut && p.fin && p.nom);
    
    // Fusionner les deux sources
    formation.datesVacances = [...datesVacancesLocales, ...datesFromRefs];
    
    // Supprimer periodeVacancesIds du résultat (déjà fusionné dans datesVacances)
    delete formation.periodeVacancesIds;
  }
  
  const { matiereIdSet, profIdSet } = collectRefsFromFormationDocs(asRecords);

  const matiereOids = [...matiereIdSet].map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  const profOids = [...profIdSet].map((id) => new mongoose.Types.ObjectId(id));

  const [matieresLean, professeursLean] = await Promise.all([
    matiereOids.length > 0
      ? Matiere.find({ _id: { $in: matiereOids } }).lean().exec()
      : Promise.resolve([]),
    profOids.length > 0
      ? Professeur.find({ _id: { $in: profOids } }).lean().exec()
      : Promise.resolve([]),
  ]);

  const payload = {
    meta: {
      version: SNAPSHOT_VERSION,
      exportedAt: new Date().toISOString(),
      formationIdsRequested: uniqueIds,
    },
    formations: formationsLean,
    matieres: matieresLean,
    professeurs: professeursLean,
  };

  const plain = mongoLeanToPlainJson(payload) as Record<string, unknown>;
  const fsPlain = plain.formations;
  if (Array.isArray(fsPlain)) {
    for (const item of fsPlain) {
      if (typeof item !== "object" || item === null) continue;
      const rec = item as Record<string, unknown>;
      const ext = extractDateDemarrageIsoDepuisValeurExport(rec.dateDemarrageIso);
      if (ext) {
        rec.dateDemarrageIso = ext;
      }
    }
  }
  return { ok: true, plain };
}

function uniqueValidFormationIds(
  formationIds: string[]
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(formationIds) || formationIds.length === 0) {
    return {
      ok: false,
      error: "Sélectionnez au moins une formation.",
    };
  }
  if (formationIds.length > MAX_FORMATIONS_PER_EXPORT) {
    return {
      ok: false,
      error: `Trop de formations sélectionnées (maximum ${MAX_FORMATIONS_PER_EXPORT}).`,
    };
  }
  const uniqueIds = [
    ...new Set(
      formationIds.map((id) => id.trim()).filter(mongoose.isValidObjectId)
    ),
  ];
  if (uniqueIds.length === 0) {
    return { ok: false, error: "Identifiants de formation invalides." };
  }
  return { ok: true, ids: uniqueIds };
}

/** Données planning pour une ou plusieurs formations (même périmètre que l’export JSON). */
export async function loadFormationPlanningSnapshotAction(
  formationIds: string[]
): Promise<LoadFormationPlanningSnapshotState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Non connecté." };
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_CREATION_FORMATION,
  ]);
  if (!allowed) {
    return { ok: false, error: "Permission refusée." };
  }

  const picked = uniqueValidFormationIds(formationIds);
  if (!picked.ok) {
    return picked;
  }

  const built = await buildFormationSnapshotPlain(picked.ids);
  if (!built.ok) {
    return built;
  }

  const jsonText = JSON.stringify(built.plain);
  if (jsonText.length > MAX_JSON_CHARS) {
    return {
      ok: false,
      error: `Jeu de données trop volumineux (limite ${MAX_JSON_CHARS} caractères).`,
    };
  }

  return { ok: true, rawData: built.plain as PlanningExportRaw };
}

export async function exportFormationSnapshotAction(
  formationIds: string[]
): Promise<ExportFormationSnapshotState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Non connecté." };
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_CREATION_FORMATION,
  ]);
  if (!allowed) {
    return { ok: false, error: "Permission refusée." };
  }

  const picked = uniqueValidFormationIds(formationIds);
  if (!picked.ok) {
    return picked;
  }

  const built = await buildFormationSnapshotPlain(picked.ids);
  if (!built.ok) {
    return built;
  }

  const jsonText = JSON.stringify(built.plain, null, 2);

  if (jsonText.length > MAX_JSON_CHARS) {
    return {
      ok: false,
      error: `Export trop volumineux (limite ${MAX_JSON_CHARS} caractères). Réduisez la sélection.`,
    };
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filenameSuggested = `formations-export-${ts}.json`;

  return { ok: true, jsonText, filenameSuggested };
}
