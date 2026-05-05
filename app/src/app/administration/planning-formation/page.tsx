import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { PlanningFormationPanel } from "@/components/administration/PlanningFormationPanel";
import { listFormationOptionsForAdmin } from "@/lib/formation/listFormationExportOptions";
import { PERMISSION_CREATION_FORMATION } from "@/lib/permissions/keys";

export const metadata = {
  title: "Planning formation | Administration",
  description:
    "Sélection de formations et génération du planning à partir des données du référentiel.",
};

export default async function PlanningFormationPage() {
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

  const options = await listFormationOptionsForAdmin();

  return (
    <main className="flex w-full min-w-0 max-w-none flex-col gap-8">
      <header className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
          Administration
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Planning formation
        </h1>
        <p className="mt-2 max-w-[92vw] text-slate-600">
          Sélectionnez une ou plusieurs formations, ou importez un JSON exporté : les
          données sont les mêmes que pour l&apos;export (formations, matières et
          professeurs référencés dans les lignes). Le placement reste une{" "}
          <strong>proposition</strong> (algorithme glouton V1). Permission{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            {PERMISSION_CREATION_FORMATION}
          </code>
          .
        </p>
      </header>

      <PlanningFormationPanel options={options} />

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
