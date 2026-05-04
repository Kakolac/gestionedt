import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { Matiere } from "@/lib/models/Matiere";
import { Professeur } from "@/lib/models/Professeur";
import { PERMISSION_CREATION_PROFESSEUR } from "@/lib/permissions/keys";
import { leanWireFromContraintesDoc } from "@/lib/professeurContraintes";
import { GestionProfesseursPanel } from "@/components/administration/GestionProfesseursPanel";

export default async function CreationProfesseurPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_CREATION_PROFESSEUR,
  ]);
  if (!allowed) {
    redirect("/administration");
  }

  await connectDB();
  const [docs, matiereDocs] = await Promise.all([
    Professeur.find({})
      .sort({ nom: 1, prenom: 1 })
      .select("prenom nom description matiereIds contraintes")
      .lean(),
    Matiere.find({}).sort({ nom: 1 }).select("_id nom").lean(),
  ]);

  const matiereOptions = matiereDocs.map((m) => ({
    id: String(m._id),
    nom: m.nom,
  }));

  const rows = docs.map((p) => ({
    id: String(p._id),
    prenom: p.prenom ?? "",
    nom: p.nom,
    description: p.description ?? "",
    matiereIds: (Array.isArray(p.matiereIds) ? p.matiereIds : []).map(
      (mid: unknown) => String(mid).trim()
    ),
    contraintes: leanWireFromContraintesDoc(p.contraintes),
  }));

  return (
    <main className="flex min-h-[40vh] flex-col gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
          Administration
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Professeurs
        </h1>
        <p className="mt-2 max-w-[90vw] text-slate-600">
          Référentiel enseignants avec affectation à une ou plusieurs matières
          ({` `}
          <Link
            href="/administration/creation-matiere"
            className="font-medium text-indigo-600 underline-offset-4 hover:underline"
          >
            référentiel matières
          </Link>
          ). Accès réservé à la permission{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            {PERMISSION_CREATION_PROFESSEUR}
          </code>
          .
        </p>
      </header>

      <GestionProfesseursPanel rows={rows} matiereOptions={matiereOptions} />

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
