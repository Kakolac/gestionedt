"use server";

import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { ContenuPedagogique } from "@/lib/models/ContenuPedagogique";
import { Matiere } from "@/lib/models/Matiere";
import { Professeur } from "@/lib/models/Professeur";
import { PERMISSION_CREATION_CONTENU_PEDAGOGIQUE } from "@/lib/permissions/keys";
import { slugifyMetierLabel } from "@/lib/slugifyMetier";
import { revalidatePath } from "next/cache";

function isDuplicateKeyError(e: unknown): boolean {
  return typeof e === "object" && e != null && (e as { code?: number }).code === 11000;
}

export type ContenuPedagogiqueActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const CONTENU_PATH = "/administration/creation-contenu-pedagogique";
const MATIERE_PATH = "/administration/creation-matiere";

const NOM_CONTENU_MAX = 200;
const DESC_CONTENU_MAX = 2000;
const NOM_MAT_MAX = 200;
const DESC_MAT_MAX = 2000;
const HEURES_MIN = 0;
const HEURES_MAX = 50000;

const MAX_LIGNES = 120;
const MAX_JSON_CHARS = 400_000;

async function ensureContenuPermission(): Promise<ContenuPedagogiqueActionState | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Non connecté." };
  }
  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_CREATION_CONTENU_PEDAGOGIQUE,
  ]);
  if (!allowed) {
    return { ok: false, error: "Permission refusée." };
  }
  return null;
}

async function assertProfesseursExist(
  ids: string[]
): Promise<ContenuPedagogiqueActionState | null> {
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
): Promise<Extract<ContenuPedagogiqueActionState, { ok: false }> | null> {
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

async function assertMatiereIdsPasDejaDansAutreContenu(
  matiereOids: mongoose.Types.ObjectId[],
  excludeContenuId?: string
): Promise<ContenuPedagogiqueActionState | null> {
  if (matiereOids.length === 0) return null;
  await connectDB();
  const filter: Record<string, unknown> = {
    "lignes.matiereId": { $in: matiereOids },
  };
  if (excludeContenuId && mongoose.isValidObjectId(excludeContenuId.trim())) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeContenuId.trim()) };
  }
  const conflit = await ContenuPedagogique.findOne(filter).select("_id").lean();
  if (conflit != null) {
    return {
      ok: false,
      error:
        "Une ou plusieurs matières sont déjà rattachées à un autre contenu pédagogique.",
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
): number | ContenuPedagogiqueActionState {
  const sum = lignes.reduce((s, l) => s + l.nombreHeuresPrevues, 0);
  if (sum > HEURES_MAX) {
    return {
      ok: false,
      error: `Le total d’heures du contenu ne peut pas dépasser ${HEURES_MAX}.`,
    };
  }
  return sum;
}

function parseContenuNomDesc(formData: FormData):
  | { ok: true; nom: string; description: string }
  | { ok: false; error: string } {
  const nomRaw = formData.get("nomContenu");
  if (typeof nomRaw !== "string" || !nomRaw.trim()) {
    return { ok: false, error: "Indiquez le nom du contenu pédagogique." };
  }
  const nom = nomRaw.trim().slice(0, NOM_CONTENU_MAX);
  const descRaw = formData.get("descriptionContenu");
  const description =
    typeof descRaw === "string" ? descRaw.trim().slice(0, DESC_CONTENU_MAX) : "";
  return { ok: true, nom, description };
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
    return { ok: false, error: "Trop de lignes dans le contenu." };
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

export async function createContenuPedagogiqueAction(
  _prev: ContenuPedagogiqueActionState | undefined,
  formData: FormData
): Promise<ContenuPedagogiqueActionState> {
  const denied = await ensureContenuPermission();
  if (denied) return denied;

  const meta = parseContenuNomDesc(formData);
  if (!meta.ok) return meta;
  const { nom, description } = meta;

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

  const allMid = mongooseLignes.map((x) => x.matiereId);
  const conflitExterne = await assertMatiereIdsPasDejaDansAutreContenu(allMid, undefined);
  if (conflitExterne) return conflitExterne;

  if (aCreeMatiere) {
    revalidatePath(MATIERE_PATH);
  }

  try {
    await ContenuPedagogique.create({
      nom,
      description,
      lignes: mongooseLignes,
      nombreHeures: totalHeures,
    });
  } catch (e: unknown) {
    if (isDuplicateKeyError(e)) {
      return {
        ok: false,
        error:
          "Impossible d’enregistrer : une matière est déjà dans un autre contenu.",
      };
    }
    throw e;
  }

  revalidatePath(CONTENU_PATH);
  return { ok: true, message: "Contenu pédagogique enregistré." };
}

export async function updateContenuPedagogiqueAction(
  _prev: ContenuPedagogiqueActionState | undefined,
  formData: FormData
): Promise<ContenuPedagogiqueActionState> {
  const denied = await ensureContenuPermission();
  if (denied) return denied;

  const meta = parseContenuNomDesc(formData);
  if (!meta.ok) return meta;
  const { nom, description } = meta;

  const idRaw = formData.get("contenuPedagogiqueId");
  if (
    typeof idRaw !== "string" ||
    !mongoose.isValidObjectId(idRaw.trim())
  ) {
    return { ok: false, error: "Identifiant de fiche invalide." };
  }
  const cid = idRaw.trim();

  const parsedLignes = parseLignesJsonFromForm(formData);
  if (!parsedLignes.ok) return parsedLignes;

  await connectDB();
  const doc = await ContenuPedagogique.findById(cid);
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

  const allMid = mongooseLignes.map((x) => x.matiereId);
  const conflitExterne = await assertMatiereIdsPasDejaDansAutreContenu(allMid, cid);
  if (conflitExterne) return conflitExterne;

  if (aCreeMatiere) {
    revalidatePath(MATIERE_PATH);
  }

  doc.nom = nom;
  doc.description = description;
  doc.lignes = mongooseLignes;
  doc.nombreHeures = totalHeures;

  try {
    await doc.save();
  } catch (e: unknown) {
    if (isDuplicateKeyError(e)) {
      return {
        ok: false,
        error:
          "Conflit : une matière est déjà utilisée dans un autre contenu pédagogique.",
      };
    }
    throw e;
  }

  revalidatePath(CONTENU_PATH);
  return { ok: true, message: "Fiche mise à jour." };
}

export async function deleteContenuPedagogiqueAction(
  contenuPedagogiqueId: string
): Promise<ContenuPedagogiqueActionState> {
  const denied = await ensureContenuPermission();
  if (denied) return denied;

  if (!mongoose.isValidObjectId(contenuPedagogiqueId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  await connectDB();
  const res = await ContenuPedagogique.deleteOne({ _id: contenuPedagogiqueId });
  if (res.deletedCount === 0) {
    return { ok: false, error: "Fiche introuvable." };
  }

  revalidatePath(CONTENU_PATH);
  return { ok: true, message: "Fiche supprimée." };
}

export async function deleteContenuPedagogiqueFormAction(
  _prev: ContenuPedagogiqueActionState | undefined,
  formData: FormData
): Promise<ContenuPedagogiqueActionState> {
  const raw = formData.get("contenuPedagogiqueId");
  if (typeof raw !== "string") {
    return { ok: false, error: "Identifiant manquant." };
  }
  return deleteContenuPedagogiqueAction(raw);
}
