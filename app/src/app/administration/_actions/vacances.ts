"use server";

import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { PeriodeVacances } from "@/lib/models/PeriodeVacances";
import { Formation } from "@/lib/models/Formation";
import { PERMISSION_GESTION_VACANCES } from "@/lib/permissions/keys";
import { slugifyMetierLabel } from "@/lib/slugifyMetier";
import { revalidatePath } from "next/cache";

function isDuplicateKeyError(e: unknown): boolean {
  return typeof e === "object" && e != null && (e as { code?: number }).code === 11000;
}

export type VacancesActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const VACANCES_PATH = "/administration/gestion-vacances";
const FORMATION_PATH = "/administration/creation-formation";

const NOM_MAX = 100;
const DESC_MAX = 500;

async function ensureVacancesPermission(): Promise<VacancesActionState | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Non connecté." };
  }
  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_GESTION_VACANCES,
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
  if (!base) base = "vacances";
  let candidate = base;
  let n = 0;
  for (;;) {
    const existing = await PeriodeVacances.findOne({ slug: candidate })
      .select("_id")
      .lean();
    if (!existing) return candidate;
    if (excludeMongooseId && String(existing._id) === excludeMongooseId) {
      return candidate;
    }
    n += 1;
    candidate = `${base}_${n}`;
  }
}

function parseNomDesc(formData: FormData):
  | { ok: true; nom: string; description: string }
  | { ok: false; error: string } {
  const nomRaw = formData.get("nom");
  if (typeof nomRaw !== "string" || !nomRaw.trim()) {
    return { ok: false, error: "Indiquez le nom de la période de vacances." };
  }
  const nom = nomRaw.trim().slice(0, NOM_MAX);
  const descRaw = formData.get("description");
  const description =
    typeof descRaw === "string" ? descRaw.trim().slice(0, DESC_MAX) : "";
  return { ok: true, nom, description };
}

function parseDates(formData: FormData):
  | { ok: true; debut: string; fin: string }
  | { ok: false; error: string } {
  const debutRaw = formData.get("debut");
  const finRaw = formData.get("fin");

  if (typeof debutRaw !== "string" || !debutRaw.trim()) {
    return { ok: false, error: "Indiquez la date de début." };
  }
  if (typeof finRaw !== "string" || !finRaw.trim()) {
    return { ok: false, error: "Indiquez la date de fin." };
  }

  const debut = debutRaw.trim().slice(0, 10);
  const fin = finRaw.trim().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(debut)) {
    return {
      ok: false,
      error: "Date de début invalide (format AAAA-MM-JJ).",
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fin)) {
    return {
      ok: false,
      error: "Date de fin invalide (format AAAA-MM-JJ).",
    };
  }
  if (debut > fin) {
    return {
      ok: false,
      error: "La date de fin doit être postérieure ou égale à la date de début.",
    };
  }

  return { ok: true, debut, fin };
}

export async function createPeriodeVacancesAction(
  _prev: VacancesActionState | undefined,
  formData: FormData
): Promise<VacancesActionState> {
  const denied = await ensureVacancesPermission();
  if (denied) return denied;

  const meta = parseNomDesc(formData);
  if (!meta.ok) return meta;
  const { nom, description } = meta;

  const dates = parseDates(formData);
  if (!dates.ok) return dates;
  const { debut, fin } = dates;

  await connectDB();
  const slug = await allocateUniqueSlug(nom);

  try {
    await PeriodeVacances.create({
      nom,
      slug,
      debut,
      fin,
      description,
    });
  } catch (e: unknown) {
    if (isDuplicateKeyError(e)) {
      return {
        ok: false,
        error: "Une période avec ce slug existe déjà (conflit).",
      };
    }
    throw e;
  }

  revalidatePath(VACANCES_PATH);
  revalidatePath(FORMATION_PATH);
  return { ok: true, message: "Période de vacances créée." };
}

export async function updatePeriodeVacancesAction(
  _prev: VacancesActionState | undefined,
  formData: FormData
): Promise<VacancesActionState> {
  const denied = await ensureVacancesPermission();
  if (denied) return denied;

  const idRaw = formData.get("periodeId");
  if (typeof idRaw !== "string" || !mongoose.isValidObjectId(idRaw.trim())) {
    return { ok: false, error: "Identifiant invalide." };
  }
  const periodeId = idRaw.trim();

  const meta = parseNomDesc(formData);
  if (!meta.ok) return meta;
  const { nom, description } = meta;

  const dates = parseDates(formData);
  if (!dates.ok) return dates;
  const { debut, fin } = dates;

  await connectDB();
  const doc = await PeriodeVacances.findById(periodeId);
  if (!doc) return { ok: false, error: "Période introuvable." };

  const slug = await allocateUniqueSlug(nom, periodeId);

  doc.nom = nom;
  doc.slug = slug;
  doc.debut = debut;
  doc.fin = fin;
  doc.description = description;

  try {
    await doc.save();
  } catch (e: unknown) {
    if (isDuplicateKeyError(e)) {
      return {
        ok: false,
        error: "Impossible de mettre à jour (conflit de slug).",
      };
    }
    throw e;
  }

  revalidatePath(VACANCES_PATH);
  revalidatePath(FORMATION_PATH);
  return { ok: true, message: "Période mise à jour." };
}

export async function deletePeriodeVacancesAction(
  periodeId: string
): Promise<VacancesActionState> {
  const denied = await ensureVacancesPermission();
  if (denied) return denied;

  if (!mongoose.isValidObjectId(periodeId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  await connectDB();

  const oid = new mongoose.Types.ObjectId(periodeId);
  const count = await Formation.countDocuments({
    periodeVacancesIds: oid,
  });

  if (count > 0) {
    return {
      ok: false,
      error: `Cette période est utilisée par ${count} formation(s). Suppression impossible.`,
    };
  }

  const res = await PeriodeVacances.deleteOne({ _id: periodeId });
  if (res.deletedCount === 0) {
    return { ok: false, error: "Période introuvable." };
  }

  revalidatePath(VACANCES_PATH);
  revalidatePath(FORMATION_PATH);
  return { ok: true, message: "Période supprimée." };
}

export async function deletePeriodeVacancesFormAction(
  _prev: VacancesActionState | undefined,
  formData: FormData
): Promise<VacancesActionState> {
  const raw = formData.get("periodeId");
  if (typeof raw !== "string") {
    return { ok: false, error: "Identifiant manquant." };
  }
  return deletePeriodeVacancesAction(raw);
}
