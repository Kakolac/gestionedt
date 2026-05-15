import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { PeriodeVacances } from "@/lib/models/PeriodeVacances";
import { PERMISSION_GESTION_VACANCES } from "@/lib/permissions/keys";
import { GestionVacancesPanel } from "@/components/administration/GestionVacancesPanel";
import type { PeriodeVacancesRow } from "@/components/administration/GestionVacancesPanel";

export default async function GestionVacancesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_GESTION_VACANCES,
  ]);
  if (!allowed) {
    redirect("/administration");
  }

  await connectDB();
  const periodesLean = await PeriodeVacances.find({})
    .sort({ debut: 1, nom: 1 })
    .select("nom debut fin description")
    .lean();

  const rows: PeriodeVacancesRow[] = periodesLean.map((p) => ({
    id: String(p._id),
    nom: p.nom,
    debut: p.debut,
    fin: p.fin,
    description: (p.description ?? "").trim(),
  }));

  return (
    <main className="flex min-h-[40vh] flex-col gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
          Administration
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Gestion des vacances
        </h1>
        <p className="mt-2 max-w-[90vw] text-slate-600">
          Créez des périodes de vacances réutilisables qui pourront être sélectionnées dans
          les formations. Ces périodes sont centralisées et peuvent être partagées entre
          plusieurs formations. Vous pouvez également définir des périodes spécifiques
          directement dans chaque formation. Permission{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            {PERMISSION_GESTION_VACANCES}
          </code>
          .
        </p>
      </header>

      <GestionVacancesPanel rows={rows} />

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
