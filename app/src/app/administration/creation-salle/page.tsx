import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import type { SalleKind } from "@/lib/models/Salle";
import { Salle } from "@/lib/models/Salle";
import { PERMISSION_CREATION_SALLE } from "@/lib/permissions/keys";
import { GestionSallesPanel } from "@/components/administration/GestionSallesPanel";

export default async function CreationSallePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_CREATION_SALLE,
  ]);
  if (!allowed) {
    redirect("/administration");
  }

  await connectDB();
  const docs = await Salle.find({})
    .sort({ nom: 1 })
    .select("nom kind description")
    .lean();

  const rows = docs.map((s) => ({
    id: String(s._id),
    nom: s.nom,
    kind: s.kind as SalleKind,
    description: s.description ?? "",
  }));

  return (
    <main className="flex min-h-[40vh] flex-col gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
          Administration
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Salles
        </h1>
        <p className="mt-2 max-w-[90vw] text-slate-600">
          Référencier les salles : classiques ou avec équipement pédagogique (salle
          spécifique). Création, modification ou suppression. Accès réservé à la
          permission{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            {PERMISSION_CREATION_SALLE}
          </code>
          .
        </p>
      </header>

      <GestionSallesPanel rows={rows} />

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
