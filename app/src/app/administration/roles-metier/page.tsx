import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { MetierRole } from "@/lib/models/MetierRole";
import {
  METIER_ROLE_INIT_ADMIN_SLUG,
  PERMISSION_ADMIN_ROLES_METIER,
} from "@/lib/permissions/keys";
import { RolesMetierListe } from "@/components/administration/RolesMetierListe";

export default async function RolesMetierIndexPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_ADMIN_ROLES_METIER,
  ]);
  if (!allowed) {
    redirect("/administration");
  }

  await connectDB();
  const metiers = await MetierRole.find({})
    .sort({ label: 1 })
    .select("slug label baseRoleSlugs")
    .lean();

  const rows = metiers.map((m) => ({
    slug: String(m.slug),
    label: String(m.label),
    baseRoleSlugs: Array.isArray(m.baseRoleSlugs)
      ? m.baseRoleSlugs.map(String)
      : [],
    deletable: String(m.slug) !== METIER_ROLE_INIT_ADMIN_SLUG,
  }));

  return (
    <main className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
          Administration
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Rôles métier
        </h1>
        <p className="mt-2 text-slate-600">
          Liste des agrégats de rôles de base. Créez un nouveau rôle ou modifiez
          les existants ; le slug technique reste fixe après création.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/administration/roles-metier/nouveau"
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:to-fuchsia-500"
        >
          Créer un rôle métier
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">
          Aucun rôle métier en base. Utilisez le bouton ci-dessus ou{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            npm run init:metier-roles
          </code>
          .
        </p>
      ) : (
        <RolesMetierListe roles={rows} />
      )}

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
