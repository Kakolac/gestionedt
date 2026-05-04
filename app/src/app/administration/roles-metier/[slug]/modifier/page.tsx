import Link from "next/link";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { PERMISSION_ADMIN_ROLES_METIER } from "@/lib/permissions/keys";
import { redirect, notFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { MetierRole } from "@/lib/models/MetierRole";
import { Role } from "@/lib/models/Role";
import { ModifierRoleMetierForm } from "@/components/administration/ModifierRoleMetierForm";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ModifierRoleMetierPage({ params }: Props) {
  const { slug: slugParam } = await params;
  const slug = decodeURIComponent(slugParam).trim().toLowerCase();

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
  const [metier, roles] = await Promise.all([
    MetierRole.findOne({ slug }).select("slug label baseRoleSlugs").lean(),
    Role.find({}).sort({ label: 1 }).select("slug label").lean(),
  ]);

  if (!metier) {
    notFound();
  }

  const baseRoles = roles.map((r) => ({
    slug: String(r.slug),
    label: String(r.label),
  }));

  const initialBaseRoleSlugs = Array.isArray(metier.baseRoleSlugs)
    ? metier.baseRoleSlugs.map((s: unknown) => String(s))
    : [];

  return (
    <main className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
          Administration
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Modifier un rôle métier
        </h1>
        <p className="mt-2 text-slate-600">
          Ajustez le libellé et les rôles de base agrégés pour ce métier.
        </p>
      </header>

      <ModifierRoleMetierForm
        metierSlug={String(metier.slug)}
        initialLabel={String(metier.label)}
        initialBaseRoleSlugs={initialBaseRoleSlugs}
        baseRoles={baseRoles}
      />

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
