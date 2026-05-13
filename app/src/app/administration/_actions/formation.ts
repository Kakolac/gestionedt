"use server";

import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { Formation } from "@/lib/models/Formation";
import { Matiere } from "@/lib/models/Matiere";
import { Professeur } from "@/lib/models/Professeur";
import { PERMISSION_CREATION_FORMATION } from "@/lib/permissions/keys";
import { parseFormationContraintesJsonForSave } from "@/lib/formationContraintes";
import {
  isLocalisationPaysSupporteeAdmin,
  parseIsoDateOnlyUtc,
} from "@/lib/planning/planning-public-holidays";
import { slugifyMetierLabel } from "@/lib/slugifyMetier";
import { revalidatePath } from "next/cache";

function isDuplicateKeyError(e: unknown): boolean {
  return typeof e === "object" && e != null && (e as { code?: number }).code === 11000;
}

/** Si E11000 sur Formation : indication restart + extrait message Mongo pour diagnostic. */
function formationDuplicateKeyUserHint(e: unknown): string {
  const detail =
    typeof e === "object" && e != null && "message" in e
      ? String((e as Error).message).slice(0, 260)
      : "";
  return (
    "Contrainte d’unicité MongoDB sur la collection formations (souvent un ancien index sur « matiereId » à la racine du document). " +
    "Arrêtez puis relancez le serveur Next : au premier chargement, les index obsolètes sont supprimés automatiquement. " +
    (detail ? `Détail : ${detail}` : "")
  );
}

export type FormationActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const FORMATION_PATH = "/administration/creation-formation";
const MATIERE_PATH = "/administration/creation-matiere";

const NOM_FORMATION_MAX = 200;
const DESC_FORMATION_MAX = 2000;
const NOM_MAT_MAX = 200;
const DESC_MAT_MAX = 2000;
const HEURES_MIN = 0;
const HEURES_MAX = 50000;

const MAX_LIGNES = 120;
const MAX_JSON_CHARS = 400_000;

async function ensureFormationPermission(): Promise<FormationActionState | null> {
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
  return null;
}

async function assertProfesseursExist(
  ids: string[]
): Promise<FormationActionState | null> {
  const ordered = [
    ...new Set(ids.map((id) => id.trim()).filter((id) => mongoose.isValidObjectId(id))),
  ];
  if (ordered.length === 0) return null;
  await connectDB();
  const oidList = ordered.map((id) => new mongoose.Types.ObjectId(id));
  const count = await Professeur.countDocuments({ _id: { $in: oidList } });
  if (count !== ordered.length) {
    return {
      ok: false,
      error:
        "Un ou plusieurs professeurs ne sont pas reconnus (supprimés ou invalides).",
    };
  }
  return null;
}

async function assertProfesseursOntMatiere(
  professeurIds: string[],
  matiereId: mongoose.Types.ObjectId
): Promise<Extract<FormationActionState, { ok: false }> | null> {
  if (professeurIds.length === 0) return null;
  await connectDB();
  const oidList = professeurIds.map((id) => new mongoose.Types.ObjectId(id));
  const count = await Professeur.countDocuments({
    _id: { $in: oidList },
    matiereIds: matiereId,
  });
  if (count !== professeurIds.length) {
    return {
      ok: false,
      error:
        "Pour une matière déjà créée, chaque professeur sélectionné sur cette ligne doit l’avoir dans sa fiche référentiel.",
    };
  }
  return null;
}

async function allocateUniqueMatiereSlug(
  label: string,
  excludeMongooseId?: string
): Promise<string> {
  await connectDB();
  let base = slugifyMetierLabel(label);
  if (!base) base = "matiere";
  let candidate = base;
  let n = 0;
  for (;;) {
    const existing = await Matiere.findOne({ slug: candidate }).select("_id").lean();
    if (!existing) return candidate;
    if (excludeMongooseId && String(existing._id) === excludeMongooseId) {
      return candidate;
    }
    n += 1;
    candidate = `${base}_${n}`;
  }
}

function parseHeuresPrevuesPourLigne(
  raw: unknown,
  ligneIndex: number
): number | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return 0;
  }
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw.trim())
        : NaN;
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    return {
      ok: false,
      error: `Ligne ${ligneIndex} : heures prévues invalides.`,
    };
  }
  const entier = Math.round(n);
  if (entier < HEURES_MIN || entier > HEURES_MAX) {
    return {
      ok: false,
      error: `Ligne ${ligneIndex} : heures prévues entre ${HEURES_MIN} et ${HEURES_MAX}.`,
    };
  }
  return entier;
}

function sommeHeuresLignes(
  lignes: { nombreHeuresPrevues: number }[]
): number | FormationActionState {
  const sum = lignes.reduce((s, l) => s + l.nombreHeuresPrevues, 0);
  if (sum > HEURES_MAX) {
    return {
      ok: false,
      error: `Le total d’heures de la formation ne peut pas dépasser ${HEURES_MAX}.`,
    };
  }
  return sum;
}

function parseFormationNomDesc(formData: FormData):
  | { ok: true; nom: string; description: string }
  | { ok: false; error: string } {
  const nomRaw = formData.get("nomFormation");
  if (typeof nomRaw !== "string" || !nomRaw.trim()) {
    return { ok: false, error: "Indiquez le nom de la formation." };
  }
  const nom = nomRaw.trim().slice(0, NOM_FORMATION_MAX);
  const descRaw = formData.get("descriptionFormation");
  const description =
    typeof descRaw === "string" ? descRaw.trim().slice(0, DESC_FORMATION_MAX) : "";
  return { ok: true, nom, description };
}

const REGION_LOCALISATION_MAX = 32;
const REGION_LOCALISATION_CHARS = /^[A-Za-z0-9-]*$/;

function parseFormationLocalisationFromForm(formData: FormData):
  | FormationActionState
  | { ok: true; localisationPays: string; localisationRegion: string } {
  const paysRaw = formData.get("localisationPays");
  const regionRaw = formData.get("localisationRegion");
  const pays =
    typeof paysRaw === "string" ? paysRaw.trim().toUpperCase() : "";
  const region =
    typeof regionRaw === "string" ? regionRaw.trim() : "";

  if (region.length > REGION_LOCALISATION_MAX) {
    return {
      ok: false,
      error: `Localisation : subdivision trop longue (${REGION_LOCALISATION_MAX} caractères max).`,
    };
  }
  if (region.length > 0 && !REGION_LOCALISATION_CHARS.test(region)) {
    return {
      ok: false,
      error:
        "Localisation : subdivision — uniquement lettres sans accent, chiffres et tirets.",
    };
  }

  if (!pays) {
    if (region.length > 0) {
      return {
        ok: false,
        error:
          "Choisissez un pays pour la localisation ou effacez la subdivision.",
      };
    }
    return { ok: true, localisationPays: "", localisationRegion: "" };
  }

  if (!isLocalisationPaysSupporteeAdmin(pays)) {
    return {
      ok: false,
      error: "Pays de localisation inconnu ou non disponible dans la liste.",
    };
  }

  return { ok: true, localisationPays: pays, localisationRegion: region };
}

function parseFormationDateDemarrageFromForm(formData: FormData):
  | FormationActionState
  | { ok: true; dateDemarrageIso: string } {
  const raw = formData.get("dateDemarrageIso");
  if (typeof raw !== "string" || !raw.trim()) {
    return {
      ok: false,
      error: "Indiquez la date de démarrage de la formation.",
    };
  }
  const iso = raw.trim().slice(0, 10);
  if (!parseIsoDateOnlyUtc(iso)) {
    return {
      ok: false,
      error: "Date de démarrage invalide (format AAAA-MM-JJ).",
    };
  }
  return { ok: true, dateDemarrageIso: iso };
}

type VacancePeriode = {
  debut: string;
  fin: string;
  nom: string;
};

function parseDatesVacancesJsonFromForm(formData: FormData):
  | FormationActionState
  | { ok: true; periodes: VacancePeriode[] } {
  const raw = formData.get("datesVacancesJson");
  if (typeof raw !== "string") {
    return { ok: true, periodes: [] };
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]") {
    return { ok: true, periodes: [] };
  }
  if (trimmed.length > MAX_JSON_CHARS) {
    return { ok: false, error: "Données de vacances trop volumineuses." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Format JSON des dates de vacances invalide." };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Les dates de vacances doivent être un tableau." };
  }

  const periodes: VacancePeriode[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (typeof item !== "object" || item == null) {
      return { ok: false, error: `Période de vacances ${i + 1} : objet attendu.` };
    }
    const o = item as Record<string, unknown>;
    const debut = typeof o.debut === "string" ? o.debut.trim() : "";
    const fin = typeof o.fin === "string" ? o.fin.trim() : "";
    const nom = typeof o.nom === "string" ? o.nom.trim() : "";

    if (!debut || !fin || !nom) {
      return {
        ok: false,
        error: `Période de vacances ${i + 1} : debut, fin et nom sont requis.`,
      };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(debut)) {
      return {
        ok: false,
        error: `Période de vacances ${i + 1} : date de début invalide (format AAAA-MM-JJ).`,
      };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fin)) {
      return {
        ok: false,
        error: `Période de vacances ${i + 1} : date de fin invalide (format AAAA-MM-JJ).`,
      };
    }
    if (debut > fin) {
      return {
        ok: false,
        error: `Période de vacances ${i + 1} : la date de fin doit être postérieure ou égale à la date de début.`,
      };
    }
    if (nom.length > 100) {
      return {
        ok: false,
        error: `Période de vacances ${i + 1} : nom trop long (100 caractères max).`,
      };
    }

    periodes.push({ debut, fin, nom });
  }

  return { ok: true, periodes };
}

type LigneParsée =
  | {
      kind: "existing";
      matiereIdStr: string;
      profIds: string[];
      nombreHeuresPrevues: number;
    }
  | {
      kind: "new";
      nouveauNom: string;
      nouveauDesc: string;
      profIds: string[];
      nombreHeuresPrevues: number;
    };

function parseProfIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!mongoose.isValidObjectId(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function parseLignesJsonFromForm(formData: FormData):
  | { ok: true; lignes: LigneParsée[] }
  | { ok: false; error: string } {
  const raw = formData.get("lignesJson");
  if (typeof raw !== "string") {
    return { ok: false, error: "Données des matières / lignes invalides ou manquantes." };
  }
  const trimmed = raw.trim();
  if (trimmed.length > MAX_JSON_CHARS) {
    return { ok: false, error: "Données de lignes trop volumineuses." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Format JSON des lignes invalide." };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ok: false, error: "Ajoutez au moins une ligne (matière + professeurs)." };
  }
  if (parsed.length > MAX_LIGNES) {
    return { ok: false, error: "Trop de lignes dans la formation." };
  }

  const lignesResult: LigneParsée[] = [];
  let index = 0;
  for (const item of parsed) {
    index += 1;
    if (typeof item !== "object" || item == null) {
      return { ok: false, error: `Ligne ${index} : objet attendu.` };
    }
    const o = item as Record<string, unknown>;
    const profIdsParsed = parseProfIds(o.professeurIds);
    if (profIdsParsed === null) {
      return { ok: false, error: `Ligne ${index} : champ professeurIds invalide.` };
    }
    const heuresParsed = parseHeuresPrevuesPourLigne(o.nombreHeuresPrevues, index);
    if (typeof heuresParsed !== "number") return heuresParsed;
    const nid = typeof o.existingMatiereId === "string" ? o.existingMatiereId.trim() : "";
    const nNom = typeof o.nouveauNom === "string" ? o.nouveauNom.trim() : "";

    const hasExisting = nid.length > 0 && mongoose.isValidObjectId(nid);
    const hasNew = nNom.length > 0;

    if (hasExisting === hasNew) {
      return {
        ok: false,
        error: `Ligne ${index} : renseignez soit existingMatiereId, soit nouveauNom (exclusif).`,
      };
    }

    if (hasExisting) {
      lignesResult.push({
        kind: "existing",
        matiereIdStr: nid,
        profIds: profIdsParsed,
        nombreHeuresPrevues: heuresParsed,
      });
    } else {
      const descRaw = o.nouveauDescription;
      const nouveauDesc =
        typeof descRaw === "string" ? descRaw.trim().slice(0, DESC_MAT_MAX) : "";
      lignesResult.push({
        kind: "new",
        nouveauNom: nNom.slice(0, NOM_MAT_MAX),
        nouveauDesc,
        profIds: profIdsParsed,
        nombreHeuresPrevues: heuresParsed,
      });
    }
  }

  const seenMid = new Set<string>();
  for (const ligne of lignesResult) {
    if (ligne.kind === "existing") {
      if (seenMid.has(ligne.matiereIdStr)) {
        return { ok: false, error: "La même matière ne peut apparaître qu’une fois." };
      }
      seenMid.add(ligne.matiereIdStr);
    }
  }

  return { ok: true, lignes: lignesResult };
}

async function resoudreLignesVersMongoose(
  lignesParsées: LigneParsée[]
): Promise<
  | {
      ok: true;
      mongooseLignes: {
        matiereId: mongoose.Types.ObjectId;
        professeurIds: mongoose.Types.ObjectId[];
        nombreHeuresPrevues: number;
      }[];
      aCreeMatiere: boolean;
    }
  | { ok: false; error: string }
> {
  const mongooseLignes: {
    matiereId: mongoose.Types.ObjectId;
    professeurIds: mongoose.Types.ObjectId[];
    nombreHeuresPrevues: number;
  }[] = [];
  let aCreeMatiere = false;

  for (const lp of lignesParsées) {
    if (lp.kind === "existing") {
      const mid = new mongoose.Types.ObjectId(lp.matiereIdStr);
      const aff = await assertProfesseursOntMatiere(lp.profIds, mid);
      if (aff) return aff;
      mongooseLignes.push({
        matiereId: mid,
        professeurIds: lp.profIds.map((id) => new mongoose.Types.ObjectId(id)),
        nombreHeuresPrevues: lp.nombreHeuresPrevues,
      });
    } else {
      const slug = await allocateUniqueMatiereSlug(lp.nouveauNom);
      try {
        const cre = await Matiere.create({
          nom: lp.nouveauNom,
          slug,
          description: lp.nouveauDesc,
          salleMode: "classique",
          salleIds: [],
        });
        aCreeMatiere = true;
        const mid =
          cre._id instanceof mongoose.Types.ObjectId
            ? cre._id
            : new mongoose.Types.ObjectId(String(cre._id));
        mongooseLignes.push({
          matiereId: mid,
          professeurIds: lp.profIds.map((id) => new mongoose.Types.ObjectId(id)),
          nombreHeuresPrevues: lp.nombreHeuresPrevues,
        });
      } catch (e: unknown) {
        if (isDuplicateKeyError(e)) {
          return { ok: false, error: "Impossible de créer une nouvelle matière (conflit)." };
        }
        throw e;
      }
    }
  }

  const allMid = mongooseLignes.map((x) => x.matiereId);
  const uniqueStr = new Set<string>();
  for (const m of allMid) {
    const s = String(m);
    if (uniqueStr.has(s)) {
      return { ok: false, error: "Deux lignes ciblent la même matière." };
    }
    uniqueStr.add(s);
  }

  const countMat = await Matiere.countDocuments({ _id: { $in: allMid } });
  if (countMat !== allMid.length) {
    return { ok: false, error: "Une matière résolue est introuvable." };
  }

  return { ok: true, mongooseLignes, aCreeMatiere };
}

export async function createFormationAction(
  _prev: FormationActionState | undefined,
  formData: FormData
): Promise<FormationActionState> {
  const denied = await ensureFormationPermission();
  if (denied) return denied;

  const meta = parseFormationNomDesc(formData);
  if (!meta.ok) return meta;
  const { nom, description } = meta;

  const ctrParsed = parseFormationContraintesJsonForSave(
    formData.get("formationContraintesJson")
  );
  if (!ctrParsed.ok) return { ok: false, error: ctrParsed.error };

  const locParsed = parseFormationLocalisationFromForm(formData);
  if (!("localisationPays" in locParsed)) return locParsed;

  const dateParsed = parseFormationDateDemarrageFromForm(formData);
  if (!("dateDemarrageIso" in dateParsed)) return dateParsed;

  const parsedLignes = parseLignesJsonFromForm(formData);
  if (!parsedLignes.ok) return parsedLignes;

  const lignesParsées = parsedLignes.lignes;
  const allProfUnion = [...new Set(lignesParsées.flatMap((l) => l.profIds))];
  const badProfs = await assertProfesseursExist(allProfUnion);
  if (badProfs) return badProfs;

  await connectDB();

  const résolu = await resoudreLignesVersMongoose(lignesParsées);
  if (!résolu.ok) return résolu;
  const { mongooseLignes, aCreeMatiere } = résolu;

  const totalHeures = sommeHeuresLignes(mongooseLignes);
  if (typeof totalHeures !== "number") return totalHeures;

  if (aCreeMatiere) {
    revalidatePath(MATIERE_PATH);
  }

  try {
    await Formation.create({
      nom,
      description,
      lignes: mongooseLignes,
      nombreHeures: totalHeures,
      contraintes: ctrParsed.contraintes,
      localisationPays: locParsed.localisationPays,
      localisationRegion: locParsed.localisationRegion,
      dateDemarrageIso: dateParsed.dateDemarrageIso,
    });
  } catch (e: unknown) {
    if (isDuplicateKeyError(e)) {
      return { ok: false, error: formationDuplicateKeyUserHint(e) };
    }
    throw e;
  }

  revalidatePath(FORMATION_PATH);
  return { ok: true, message: "Formation enregistrée." };
}

export async function updateFormationAction(
  _prev: FormationActionState | undefined,
  formData: FormData
): Promise<FormationActionState> {
  const denied = await ensureFormationPermission();
  if (denied) return denied;

  const meta = parseFormationNomDesc(formData);
  if (!meta.ok) return meta;
  const { nom, description } = meta;

  const ctrParsed = parseFormationContraintesJsonForSave(
    formData.get("formationContraintesJson")
  );
  if (!ctrParsed.ok) return { ok: false, error: ctrParsed.error };

  const locParsed = parseFormationLocalisationFromForm(formData);
  if (!("localisationPays" in locParsed)) return locParsed;

  const dateParsed = parseFormationDateDemarrageFromForm(formData);
  if (!("dateDemarrageIso" in dateParsed)) return dateParsed;

  const vacancesParsed = parseDatesVacancesJsonFromForm(formData);
  if (!("periodes" in vacancesParsed)) return vacancesParsed;

  const idRaw = formData.get("formationId");
  if (
    typeof idRaw !== "string" ||
    !mongoose.isValidObjectId(idRaw.trim())
  ) {
    return { ok: false, error: "Identifiant de fiche invalide." };
  }
  const fid = idRaw.trim();

  const parsedLignes = parseLignesJsonFromForm(formData);
  if (!parsedLignes.ok) return parsedLignes;

  await connectDB();
  const doc = await Formation.findById(fid);
  if (!doc) return { ok: false, error: "Fiche introuvable." };

  const lignesParsées = parsedLignes.lignes;
  const allProfUnion = [...new Set(lignesParsées.flatMap((l) => l.profIds))];
  const badProfs = await assertProfesseursExist(allProfUnion);
  if (badProfs) return badProfs;

  const résolu = await resoudreLignesVersMongoose(lignesParsées);
  if (!résolu.ok) return résolu;
  const { mongooseLignes, aCreeMatiere } = résolu;

  const totalHeures = sommeHeuresLignes(mongooseLignes);
  if (typeof totalHeures !== "number") return totalHeures;

  if (aCreeMatiere) {
    revalidatePath(MATIERE_PATH);
  }

  doc.nom = nom;
  doc.description = description;
  doc.lignes = mongooseLignes;
  doc.nombreHeures = totalHeures;
  doc.contraintes = ctrParsed.contraintes;
  doc.localisationPays = locParsed.localisationPays;
  doc.localisationRegion = locParsed.localisationRegion;
  doc.dateDemarrageIso = dateParsed.dateDemarrageIso;
  doc.datesVacances = vacancesParsed.periodes;

  try {
    await doc.save();
  } catch (e: unknown) {
    if (isDuplicateKeyError(e)) {
      return { ok: false, error: formationDuplicateKeyUserHint(e) };
    }
    throw e;
  }

  revalidatePath(FORMATION_PATH);
  return { ok: true, message: "Fiche mise à jour." };
}

export async function deleteFormationAction(
  formationId: string
): Promise<FormationActionState> {
  const denied = await ensureFormationPermission();
  if (denied) return denied;

  if (!mongoose.isValidObjectId(formationId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  await connectDB();
  const res = await Formation.deleteOne({ _id: formationId });
  if (res.deletedCount === 0) {
    return { ok: false, error: "Fiche introuvable." };
  }

  revalidatePath(FORMATION_PATH);
  return { ok: true, message: "Fiche supprimée." };
}

export async function deleteFormationFormAction(
  _prev: FormationActionState | undefined,
  formData: FormData
): Promise<FormationActionState> {
  const raw = formData.get("formationId");
  if (typeof raw !== "string") {
    return { ok: false, error: "Identifiant manquant." };
  }
  return deleteFormationAction(raw);
}
