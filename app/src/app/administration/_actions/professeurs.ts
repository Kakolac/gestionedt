"use server";

import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { Matiere } from "@/lib/models/Matiere";
import { Professeur } from "@/lib/models/Professeur";
import { parseContraintesJsonForSave } from "@/lib/professeurContraintes";
import { PERMISSION_CREATION_PROFESSEUR } from "@/lib/permissions/keys";
import { slugifyMetierLabel } from "@/lib/slugifyMetier";
import { revalidatePath } from "next/cache";

function isDuplicateKeyError(e: unknown): boolean {
  return typeof e === "object" && e != null && (e as { code?: number }).code === 11000;
}

export type ProfesseurActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const PROFESSEUR_PATH = "/administration/creation-professeur";
const NAME_MAX = 120;
const DESC_MAX = 2000;

function contraintesJsonFromForm(formData: FormData): string | null {
  const all = formData.getAll("contraintesJson");
  const strings = all.filter((v): v is string => typeof v === "string");
  if (strings.length === 0) {
    return null;
  }
  // En cas de doublons de nom (cas rare), garder la dernière valeur sérialisée.
  return strings[strings.length - 1] ?? null;
}

function parseMatiereIdsFromForm(formData: FormData): string[] {
  const raw = formData.getAll("matiereIds");
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") {
      continue;
    }
    const id = v.trim();
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

async function assertMatieresExist(
  ids: string[]
): Promise<ProfesseurActionState | null> {
  if (ids.length === 0) {
    return null;
  }
  await connectDB();
  const oidList = ids.map((id) => new mongoose.Types.ObjectId(id));
  const count = await Matiere.countDocuments({ _id: { $in: oidList } });
  if (count !== ids.length) {
    return {
      ok: false,
      error: "Une ou plusieurs matières ne sont pas reconnues (supprimées ou invalides).",
    };
  }
  return null;
}

function slugLabelFromParts(prenom: string, nom: string): string {
  const p = prenom.trim();
  const n = nom.trim();
  if (p && n) {
    return `${p} ${n}`;
  }
  return n || p || "professeur";
}

async function ensureProfesseurPermission(): Promise<ProfesseurActionState | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Non connecté." };
  }
  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_CREATION_PROFESSEUR,
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
    base = "professeur";
  }
  let candidate = base;
  let n = 0;
  for (;;) {
    const existing = await Professeur.findOne({ slug: candidate })
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

export async function createProfesseurAction(
  _prev: ProfesseurActionState | undefined,
  formData: FormData
): Promise<ProfesseurActionState> {
  const denied = await ensureProfesseurPermission();
  if (denied) {
    return denied;
  }

  const nomRaw = formData.get("nom");
  if (typeof nomRaw !== "string" || !nomRaw.trim()) {
    return { ok: false, error: "Le nom de famille est obligatoire." };
  }
  const nom = nomRaw.trim();
  if (nom.length > NAME_MAX) {
    return { ok: false, error: `Le nom est trop long (max ${NAME_MAX}).` };
  }

  const prenomRaw = formData.get("prenom");
  const prenom =
    typeof prenomRaw === "string"
      ? prenomRaw.trim().slice(0, NAME_MAX)
      : "";

  const descRaw = formData.get("description");
  const description =
    typeof descRaw === "string" ? descRaw.trim().slice(0, DESC_MAX) : "";

  const matiereIds = parseMatiereIdsFromForm(formData);
  const invalidMatieres = await assertMatieresExist(matiereIds);
  if (invalidMatieres) {
    return invalidMatieres;
  }

  const contraintesParsed = parseContraintesJsonForSave(
    contraintesJsonFromForm(formData),
    matiereIds
  );
  if (!contraintesParsed.ok) {
    return { ok: false, error: contraintesParsed.error };
  }

  const slug = await allocateUniqueSlug(slugLabelFromParts(prenom, nom));

  await connectDB();
  try {
    await Professeur.create({
      nom,
      prenom,
      slug,
      description,
      matiereIds: matiereIds.map((id) => new mongoose.Types.ObjectId(id)),
      contraintes: contraintesParsed.contraintes,
    });
  } catch (e: unknown) {
    if (isDuplicateKeyError(e)) {
      return {
        ok: false,
        error: "Cette identité produit un identifiant technique déjà utilisé.",
      };
    }
    throw e;
  }

  revalidatePath(PROFESSEUR_PATH);
  return { ok: true, message: "Professeur créé." };
}

export async function updateProfesseurAction(
  _prev: ProfesseurActionState | undefined,
  formData: FormData
): Promise<ProfesseurActionState> {
  const denied = await ensureProfesseurPermission();
  if (denied) {
    return denied;
  }

  const idRaw = formData.get("professeurId");
  if (typeof idRaw !== "string" || !mongoose.isValidObjectId(idRaw)) {
    return { ok: false, error: "Identifiant de professeur invalide." };
  }

  const nomRaw = formData.get("nom");
  if (typeof nomRaw !== "string" || !nomRaw.trim()) {
    return { ok: false, error: "Le nom de famille est obligatoire." };
  }
  const nom = nomRaw.trim();
  if (nom.length > NAME_MAX) {
    return { ok: false, error: `Le nom est trop long (max ${NAME_MAX}).` };
  }

  const prenomRaw = formData.get("prenom");
  const prenom =
    typeof prenomRaw === "string"
      ? prenomRaw.trim().slice(0, NAME_MAX)
      : "";

  const descRaw = formData.get("description");
  const description =
    typeof descRaw === "string" ? descRaw.trim().slice(0, DESC_MAX) : "";

  const matiereIds = parseMatiereIdsFromForm(formData);
  const invalidMatieres = await assertMatieresExist(matiereIds);
  if (invalidMatieres) {
    return invalidMatieres;
  }

  const contraintesParsed = parseContraintesJsonForSave(
    contraintesJsonFromForm(formData),
    matiereIds
  );
  if (!contraintesParsed.ok) {
    return { ok: false, error: contraintesParsed.error };
  }

  await connectDB();
  const existing = await Professeur.findById(idRaw).select("_id").lean();
  if (!existing) {
    return { ok: false, error: "Professeur introuvable." };
  }

  const slug = await allocateUniqueSlug(
    slugLabelFromParts(prenom, nom),
    String(existing._id)
  );

  const oidList = matiereIds.map((id) => new mongoose.Types.ObjectId(id));

  try {
    const upd = await Professeur.updateOne(
      { _id: idRaw },
      {
        $set: {
          nom,
          prenom,
          slug,
          description,
          matiereIds: oidList,
          contraintes: contraintesParsed.contraintes,
        },
      }
    );
    if (upd.matchedCount === 0) {
      return { ok: false, error: "Professeur introuvable." };
    }
  } catch (e: unknown) {
    if (isDuplicateKeyError(e)) {
      return { ok: false, error: "Conflit d’identifiant unique." };
    }
    throw e;
  }

  revalidatePath(PROFESSEUR_PATH);
  return { ok: true, message: "Professeur mis à jour." };
}

export async function deleteProfesseurAction(
  professeurId: string
): Promise<ProfesseurActionState> {
  const denied = await ensureProfesseurPermission();
  if (denied) {
    return denied;
  }

  if (!mongoose.isValidObjectId(professeurId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  await connectDB();
  const res = await Professeur.deleteOne({ _id: professeurId });
  if (res.deletedCount === 0) {
    return { ok: false, error: "Professeur introuvable." };
  }

  revalidatePath(PROFESSEUR_PATH);
  return { ok: true, message: "Professeur supprimé." };
}

export async function deleteProfesseurFormAction(
  _prev: ProfesseurActionState | undefined,
  formData: FormData
): Promise<ProfesseurActionState> {
  const raw = formData.get("professeurId");
  if (typeof raw !== "string") {
    return { ok: false, error: "Identifiant manquant." };
  }
  return deleteProfesseurAction(raw);
}
