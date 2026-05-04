import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import {
  ExportFormationJsonPanel,
  type FormationExportOption,
} from "@/components/administration/ExportFormationJsonPanel";
import { connectDB } from "@/lib/mongodb";
import { Formation } from "@/lib/models/Formation";
import { Matiere } from "@/lib/models/Matiere";
import { PERMISSION_CREATION_FORMATION } from "@/lib/permissions/keys";

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
    typeof f.nom === "string" && f.nom.trim().length > 0
      ? f.nom.trim()
      : "";
  if (nom.length > 0) {
    return nom;
  }
  const mids = matiereIdsFromFormationLean(f);
  if (mids.length === 1) {
    return nomMatiere.get(mids[0]) ?? "Formation";
  }
  if (mids.length > 1) {
    return mids
      .map((id) => nomMatiere.get(id) ?? "?")
      .join(", ");
  }
  return `Formation ${String(f._id ?? "").slice(-8)}`;
}

export default async function ExportFormationJsonPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_CREATION_FORMATION,
  ]);
  if (!allowed) {
    redirect("/administration");
  }

  await connectDB();

  const [fichesLean, matsLean] = await Promise.all([
    Formation.find({}).lean().exec(),
    Matiere.find({}).select("nom").lean().exec(),
  ]);

  const nomMatiere = new Map<string, string>();
  for (const m of matsLean) {
    nomMatiere.set(String(m._id), m.nom);
  }

  const options: FormationExportOption[] = fichesLean
    .map((raw) => {
      const f = raw as unknown as Record<string, unknown>;
      const id = String((raw as { _id: unknown })._id ?? "");
      return {
        id,
        label: labelFormationPourListe(f, nomMatiere),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));

  return (
    <main className="flex min-h-[35vh] flex-col gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
          Administration
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Export JSON formations
        </h1>
        <p className="mt-2 max-w-[92vw] text-slate-600">
          Export brut des données MongoDB : pour chaque formation choisie, le fichier
          inclut les documents formation, ainsi que les&nbsp;
          <strong>matières</strong> et <strong>professeurs</strong> référencés dans les
          lignes (les salles éventuelles restent sous forme d&apos;identifiants dans les
          fiches matière). Permission{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            {PERMISSION_CREATION_FORMATION}
          </code>
          .
        </p>
      </header>

      <ExportFormationJsonPanel options={options} />

      <p className="text-sm">
        <Link
          href="/administration"
          className="font-medium text-indigo-600 underline-offset-4 hover:underline"
        >
          Retour au hub Administration
        </Link>
      </p>
    </main>
  );
}
