"use server";

import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import {
  Matiere,
  MATIERE_SALLE_MODE_VALUES,
  type MatiereSalleMode,
} from "@/lib/models/Matiere";
import { parseMatiereContraintesJsonForSave } from "@/lib/matiereContraintes";
import { Salle } from "@/lib/models/Salle";
import { PERMISSION_CREATION_MATIERE } from "@/lib/permissions/keys";
import { slugifyMetierLabel } from "@/lib/slugifyMetier";
import { revalidatePath } from "next/cache";

function isDuplicateKeyError(e: unknown): boolean {
  return typeof e === "object" && e != null && (e as { code?: number }).code === 11000;
}

export type MatiereActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const MATIERE_PATH = "/administration/creation-matiere";
const NOM_MAX = 200;
const DESC_MAX = 2000;

function parseSalleModeFromForm(formData: FormData): MatiereSalleMode | null {
  const raw = formData.get("salleMode");
  if (typeof raw !== "string") {
    return null;
  }
  const v = raw.trim();
  return MATIERE_SALLE_MODE_VALUES.includes(v as MatiereSalleMode)
    ? (v as MatiereSalleMode)
    : null;
}

function parseContraintesJsonField(formData: FormData): unknown {
  const raw = formData.get("contraintesJson");
  if (typeof raw !== "string") {
    return undefined;
  }
  return raw;
}

function parseSalleIdsFromForm(formData: FormData): string[] {
  const raw = formData.getAll("salleIds");
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const val of raw) {
    if (typeof val !== "string") {
      continue;
    }
    const id = val.trim();
    if (!mongoose.isValidObjectId(id)) {
      continue;
    }
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

type ResolveSallesResult =
  | { ok: true; salleMode: MatiereSalleMode; salleIds: string[] }
  | { ok: false; error: string };

async function resolveSalleFields(formData: FormData): Promise<ResolveSallesResult> {
  const salleMode = parseSalleModeFromForm(formData);
  if (!salleMode) {
    return { ok: false, error: "Mode salles invalide." };
  }
  if (salleMode === "classique") {
    return { ok: true, salleMode: "classique", salleIds: [] };
  }
  const salleIds = parseSalleIdsFromForm(formData);
  if (salleIds.length === 0) {
    return {
      ok: false,
      error:
        "En mode « Salles déterminées », cochez au moins une salle dans la liste.",
    };
  }
  await connectDB();
  const oidList = salleIds.map((id) => new mongoose.Types.ObjectId(id));
  const count = await Salle.countDocuments({ _id: { $in: oidList } });
  if (count !== salleIds.length) {
    return { ok: false, error: "Une ou plusieurs salles sélectionnées sont invalides." };
  }
  return { ok: true, salleMode: "liste", salleIds };
}

async function ensureMatierePermission(): Promise<MatiereActionState | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Non connecté." };
  }
  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_CREATION_MATIERE,
  ]);
  if (!allowed) {
    return { ok: false, error: "Permission refusée." };
  }
  return null;
}

async function allocateUniqueSlug(
  label: string,
  excludeMongooseId?: string
): Promise<string> {
  await connectDB();
  let base = slugifyMetierLabel(label);
  if (!base) {
    base = "matiere";
  }
  let candidate = base;
  let n = 0;
  for (;;) {
    const existing = await Matiere.findOne({ slug: candidate })
      .select("_id")
      .lean();
    if (!existing) {
      return candidate;
    }
    if (excludeMongooseId && String(existing._id) === excludeMongooseId) {
      return candidate;
    }
    n += 1;
    candidate = `${base}_${n}`;
  }
}

export async function createMatiereAction(
  _prev: MatiereActionState | undefined,
  formData: FormData
): Promise<MatiereActionState> {
  const denied = await ensureMatierePermission();
  if (denied) {
    return denied;
  }

  const nomRaw = formData.get("nom");
  if (typeof nomRaw !== "string" || !nomRaw.trim()) {
    return { ok: false, error: "Le nom de la matière est obligatoire." };
  }
  const nom = nomRaw.trim();
  if (nom.length > NOM_MAX) {
    return { ok: false, error: `Le nom est trop long (max ${NOM_MAX}).` };
  }

  const descRaw = formData.get("description");
  const description =
    typeof descRaw === "string" ? descRaw.trim().slice(0, DESC_MAX) : "";

  const salles = await resolveSalleFields(formData);
  if (!salles.ok) {
    return { ok: false, error: salles.error };
  }
  const { salleMode, salleIds } = salles;

  const slug = await allocateUniqueSlug(nom);

  const contraintesParsed = parseMatiereContraintesJsonForSave(
    parseContraintesJsonField(formData)
  );
  if (!contraintesParsed.ok) {
    return { ok: false, error: contraintesParsed.error };
  }

  await connectDB();
  try {
    await Matiere.create({
      nom,
      slug,
      description,
      salleMode,
      salleIds:
        salleIds.length > 0
          ? salleIds.map((id) => new mongoose.Types.ObjectId(id))
          : [],
      contraintes: contraintesParsed.contraintes,
    });
  } catch (e: unknown) {
    if (isDuplicateKeyError(e)) {
      return { ok: false, error: "Ce nom produit un identifiant déjà utilisé." };
    }
    throw e;
  }

  revalidatePath(MATIERE_PATH);
  return { ok: true, message: "Matière créée." };
}

export async function updateMatiereAction(
  _prev: MatiereActionState | undefined,
  formData: FormData
): Promise<MatiereActionState> {
  const denied = await ensureMatierePermission();
  if (denied) {
    return denied;
  }

  const idRaw = formData.get("matiereId");
  if (typeof idRaw !== "string" || !mongoose.isValidObjectId(idRaw)) {
    return { ok: false, error: "Identifiant de matière invalide." };
  }

  const nomRaw = formData.get("nom");
  if (typeof nomRaw !== "string" || !nomRaw.trim()) {
    return { ok: false, error: "Le nom de la matière est obligatoire." };
  }
  const nom = nomRaw.trim();
  if (nom.length > NOM_MAX) {
    return { ok: false, error: `Le nom est trop long (max ${NOM_MAX}).` };
  }

  const descRaw = formData.get("description");
  const description =
    typeof descRaw === "string" ? descRaw.trim().slice(0, DESC_MAX) : "";

  const salles = await resolveSalleFields(formData);
  if (!salles.ok) {
    return { ok: false, error: salles.error };
  }
  const { salleMode, salleIds } = salles;

  const contraintesParsed = parseMatiereContraintesJsonForSave(
    parseContraintesJsonField(formData)
  );
  if (!contraintesParsed.ok) {
    return { ok: false, error: contraintesParsed.error };
  }

  await connectDB();
  const doc = await Matiere.findById(idRaw);
  if (!doc) {
    return { ok: false, error: "Matière introuvable." };
  }

  const slug = await allocateUniqueSlug(nom, String(doc._id));
  doc.nom = nom;
  doc.slug = slug;
  doc.description = description;
  doc.salleMode = salleMode;
  doc.salleIds =
    salleIds.length > 0
      ? salleIds.map((id) => new mongoose.Types.ObjectId(id))
      : [];
  doc.contraintes = contraintesParsed.contraintes;

  try {
    await doc.save();
  } catch (e: unknown) {
    if (isDuplicateKeyError(e)) {
      return { ok: false, error: "Conflit d’identifiant unique." };
    }
    throw e;
  }

  revalidatePath(MATIERE_PATH);
  return { ok: true, message: "Matière mise à jour." };
}

export async function deleteMatiereAction(
  matiereId: string
): Promise<MatiereActionState> {
  const denied = await ensureMatierePermission();
  if (denied) {
    return denied;
  }

  if (!mongoose.isValidObjectId(matiereId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  await connectDB();
  const res = await Matiere.deleteOne({ _id: matiereId });
  if (res.deletedCount === 0) {
    return { ok: false, error: "Matière introuvable." };
  }

  revalidatePath(MATIERE_PATH);
  return { ok: true, message: "Matière supprimée." };
}

export async function deleteMatiereFormAction(
  _prev: MatiereActionState | undefined,
  formData: FormData
): Promise<MatiereActionState> {
  const raw = formData.get("matiereId");
  if (typeof raw !== "string") {
    return { ok: false, error: "Identifiant manquant." };
  }
  return deleteMatiereAction(raw);
}
