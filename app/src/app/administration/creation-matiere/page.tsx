import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import type { MatiereSalleMode } from "@/lib/models/Matiere";
import { Matiere } from "@/lib/models/Matiere";
import type { SalleKind } from "@/lib/models/Salle";
import { Salle } from "@/lib/models/Salle";
import { PERMISSION_CREATION_MATIERE } from "@/lib/permissions/keys";
import { leanWireFromMatiereContraintesDoc } from "@/lib/matiereContraintes";
import { GestionMatieresPanel } from "@/components/administration/GestionMatieresPanel";

export default async function CreationMatierePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_CREATION_MATIERE,
  ]);
  if (!allowed) {
    redirect("/administration");
  }

  await connectDB();
  const [matieresLean, sallesLean] = await Promise.all([
    Matiere.find({})
      .sort({ nom: 1 })
      .select("nom description salleMode salleIds contraintes")
      .lean(),
    Salle.find({}).sort({ nom: 1 }).select("nom kind").lean(),
  ]);

  const rows = matieresLean.map((m) => {
    const mode =
      m.salleMode === "liste" ? "liste" : "classique";
    const idsRaw = m.salleIds;
    const salleIds =
      Array.isArray(idsRaw) ? idsRaw.map((id) => String(id)) : [];
    return {
      id: String(m._id),
      nom: m.nom,
      description: (m.description ?? "").trim(),
      salleMode: mode as MatiereSalleMode,
      salleIds:
        mode === "liste" ? salleIds : [],
      contraintes: leanWireFromMatiereContraintesDoc(m.contraintes),
    };
  });

  const salleOptions = sallesLean.map((s) => ({
    id: String(s._id),
    nom: s.nom,
    kind: s.kind as SalleKind,
  }));

  return (
    <main className="flex min-h-[40vh] flex-col gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
          Administration
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Matières
        </h1>
        <p className="mt-2 max-w-[90vw] text-slate-600">
          Référencier les matières enseignées et, si besoin, les salles associées
          (mode classique ou liste de salles). Création, modification ou
          suppression. Accès réservé à la permission{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            {PERMISSION_CREATION_MATIERE}
          </code>
          .
        </p>
      </header>

      <GestionMatieresPanel rows={rows} salleOptions={salleOptions} />

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
