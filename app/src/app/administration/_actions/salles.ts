"use server";

import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { Salle, SALLE_KIND_VALUES, type SalleKind } from "@/lib/models/Salle";
import { PERMISSION_CREATION_SALLE } from "@/lib/permissions/keys";
import { slugifyMetierLabel } from "@/lib/slugifyMetier";
import { revalidatePath } from "next/cache";

function isDuplicateKeyError(e: unknown): boolean {
  return typeof e === "object" && e != null && (e as { code?: number }).code === 11000;
}

export type SalleActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const SALLE_PATH = "/administration/creation-salle";
const NOM_MAX = 200;
const DESC_MAX = 2000;

function parseKind(raw: unknown): SalleKind | null {
  if (typeof raw !== "string") {
    return null;
  }
  return SALLE_KIND_VALUES.includes(raw as SalleKind) ? (raw as SalleKind) : null;
}

async function ensureSallePermission(): Promise<SalleActionState | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Non connecté." };
  }
  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_CREATION_SALLE,
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
    base = "salle";
  }
  let candidate = base;
  let n = 0;
  for (;;) {
    const existing = await Salle.findOne({ slug: candidate }).select("_id").lean();
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

export async function createSalleAction(
  _prev: SalleActionState | undefined,
  formData: FormData
): Promise<SalleActionState> {
  const denied = await ensureSallePermission();
  if (denied) {
    return denied;
  }

  const nomRaw = formData.get("nom");
  if (typeof nomRaw !== "string" || !nomRaw.trim()) {
    return { ok: false, error: "Le nom de la salle est obligatoire." };
  }
  const nom = nomRaw.trim();
  if (nom.length > NOM_MAX) {
    return { ok: false, error: `Le nom est trop long (max ${NOM_MAX}).` };
  }

  const kind = parseKind(formData.get("kind"));
  if (!kind) {
    return { ok: false, error: "Type de salle invalide." };
  }

  const descRaw = formData.get("description");
  const description =
    typeof descRaw === "string" ? descRaw.trim().slice(0, DESC_MAX) : "";

  const slug = await allocateUniqueSlug(nom);

  await connectDB();
  try {
    await Salle.create({ nom, slug, kind, description });
  } catch (e: unknown) {
    if (isDuplicateKeyError(e)) {
      return { ok: false, error: "Ce nom produit un identifiant déjà utilisé." };
    }
    throw e;
  }

  revalidatePath(SALLE_PATH);
  return { ok: true, message: "Salle créée." };
}

export async function updateSalleAction(
  _prev: SalleActionState | undefined,
  formData: FormData
): Promise<SalleActionState> {
  const denied = await ensureSallePermission();
  if (denied) {
    return denied;
  }

  const idRaw = formData.get("salleId");
  if (typeof idRaw !== "string" || !mongoose.isValidObjectId(idRaw)) {
    return { ok: false, error: "Identifiant de salle invalide." };
  }

  const nomRaw = formData.get("nom");
  if (typeof nomRaw !== "string" || !nomRaw.trim()) {
    return { ok: false, error: "Le nom de la salle est obligatoire." };
  }
  const nom = nomRaw.trim();
  if (nom.length > NOM_MAX) {
    return { ok: false, error: `Le nom est trop long (max ${NOM_MAX}).` };
  }

  const kind = parseKind(formData.get("kind"));
  if (!kind) {
    return { ok: false, error: "Type de salle invalide." };
  }

  const descRaw = formData.get("description");
  const description =
    typeof descRaw === "string" ? descRaw.trim().slice(0, DESC_MAX) : "";

  await connectDB();
  const doc = await Salle.findById(idRaw);
  if (!doc) {
    return { ok: false, error: "Salle introuvable." };
  }

  const slug = await allocateUniqueSlug(nom, String(doc._id));
  doc.nom = nom;
  doc.slug = slug;
  doc.kind = kind;
  doc.description = description;

  try {
    await doc.save();
  } catch (e: unknown) {
    if (isDuplicateKeyError(e)) {
      return { ok: false, error: "Conflit d’identifiant unique." };
    }
    throw e;
  }

  revalidatePath(SALLE_PATH);
  return { ok: true, message: "Salle mise à jour." };
}

export async function deleteSalleAction(salleId: string): Promise<SalleActionState> {
  const denied = await ensureSallePermission();
  if (denied) {
    return denied;
  }

  if (!mongoose.isValidObjectId(salleId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  await connectDB();
  const res = await Salle.deleteOne({ _id: salleId });
  if (res.deletedCount === 0) {
    return { ok: false, error: "Salle introuvable." };
  }

  revalidatePath(SALLE_PATH);
  return { ok: true, message: "Salle supprimée." };
}

export async function deleteSalleFormAction(
  _prev: SalleActionState | undefined,
  formData: FormData
): Promise<SalleActionState> {
  const raw = formData.get("salleId");
  if (typeof raw !== "string") {
    return { ok: false, error: "Identifiant manquant." };
  }
  return deleteSalleAction(raw);
}
