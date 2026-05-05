import { connectDB } from "@/lib/mongodb";
import { Formation } from "@/lib/models/Formation";
import { Matiere } from "@/lib/models/Matiere";

export type FormationListOption = { id: string; label: string };

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

function labelFormationPourListe(
  f: Record<string, unknown>,
  nomMatiere: Map<string, string>
): string {
  const nom =
    typeof f.nom === "string" && f.nom.trim().length > 0 ? f.nom.trim() : "";
  if (nom.length > 0) {
    return nom;
  }
  const mids = matiereIdsFromFormationLean(f);
  if (mids.length === 1) {
    return nomMatiere.get(mids[0]) ?? "Formation";
  }
  if (mids.length > 1) {
    return mids.map((id) => nomMatiere.get(id) ?? "?").join(", ");
  }
  return `Formation ${String(f._id ?? "").slice(-8)}`;
}

/** Formations en base, triées par libellé (pour export JSON, planning, etc.). */
export async function listFormationOptionsForAdmin(): Promise<
  FormationListOption[]
> {
  await connectDB();
  const [fichesLean, matsLean] = await Promise.all([
    Formation.find({}).lean().exec(),
    Matiere.find({}).select("nom").lean().exec(),
  ]);

  const nomMatiere = new Map<string, string>();
  for (const m of matsLean) {
    nomMatiere.set(String(m._id), m.nom);
  }

  return fichesLean
    .map((raw) => {
      const f = raw as unknown as Record<string, unknown>;
      const id = String((raw as { _id: unknown })._id ?? "");
      return {
        id,
        label: labelFormationPourListe(f, nomMatiere),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}
