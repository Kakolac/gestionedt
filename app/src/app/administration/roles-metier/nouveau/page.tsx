import Link from "next/link";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { PERMISSION_ADMIN_ROLES_METIER } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Role } from "@/lib/models/Role";
import { CreerRoleMetierForm } from "@/components/administration/CreerRoleMetierForm";

export default async function NouveauRoleMetierPage() {
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
  const roles = await Role.find({})
    .sort({ label: 1 })
    .select("slug label")
    .lean();

  const baseRoles = roles.map((r) => ({
    slug: String(r.slug),
    label: String(r.label),
  }));

  return (
    <main className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
          Administration
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Créer un rôle métier
        </h1>
        <p className="mt-2 text-slate-600">
          Un rôle métier regroupe plusieurs rôles de base existants (droits
          combinés pour les utilisateurs qui le portent).
        </p>
      </header>

      <CreerRoleMetierForm baseRoles={baseRoles} />

      <p className="flex flex-wrap gap-4 text-sm">
        <Link
          href="/administration/roles-metier"
          className="font-medium text-indigo-600 underline-offset-4 hover:underline"
        >
          Retour à la liste des rôles métier
        </Link>
        <Link
          href="/administration"
          className="font-medium text-indigo-600 underline-offset-4 hover:underline"
        >
          Hub Administration
        </Link>
      </p>
    </main>
  );
}
