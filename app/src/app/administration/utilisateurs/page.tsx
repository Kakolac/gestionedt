import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { MetierRole } from "@/lib/models/MetierRole";
import { Role } from "@/lib/models/Role";
import { User } from "@/lib/models/User";
import { PERMISSION_ADMIN_UTILISATEURS } from "@/lib/permissions/keys";
import { UtilisateursPanel } from "@/components/administration/UtilisateursPanel";

export default async function UtilisateursPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_ADMIN_UTILISATEURS,
  ]);
  if (!allowed) {
    redirect("/administration");
  }

  await connectDB();
  const [users, roles, metiers] = await Promise.all([
    User.find({}).sort({ email: 1 }).lean(),
    Role.find({}).sort({ label: 1 }).select("slug label").lean(),
    MetierRole.find({}).sort({ label: 1 }).select("slug label").lean(),
  ]);

  const rows = users.map((u) => ({
    id: String(u._id),
    email: u.email,
    name: u.name ?? "",
    roleSlugs: [...(u.roleSlugs ?? [])],
    metierRoleSlugs: [...(u.metierRoleSlugs ?? [])],
  }));

  const baseRoles = roles.map((r) => ({
    slug: String(r.slug),
    label: String(r.label),
  }));

  const metierRoles = metiers.map((m) => ({
    slug: String(m.slug),
    label: String(m.label),
  }));

  return (
    <main className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
          Administration
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Gestion des utilisateurs
        </h1>
        <p className="mt-2 text-slate-600">
          Créez des comptes, définissez mot de passe et rôles de base ou métier.
          Les modifications de droits sont prises en compte sans reconnecter
          l&apos;utilisateur cible (garde « live »).
        </p>
      </header>

      <UtilisateursPanel
        rows={rows}
        baseRoles={baseRoles}
        metierRoles={metierRoles}
        currentUserId={session.user.id ?? ""}
      />

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
