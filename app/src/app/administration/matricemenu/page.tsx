import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { MetierRole } from "@/lib/models/MetierRole";
import { getMenuVisibilityByTile } from "@/lib/menuVisibility/loadRules";
import { PERMISSION_ADMIN_MATRICE_MENU } from "@/lib/permissions/keys";
import { MenuVisibilityMatrix } from "@/app/administration/matricemenu/MenuVisibilityMatrix";

export default async function MatriceMenuPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_ADMIN_MATRICE_MENU,
  ]);
  if (!allowed) {
    redirect("/administration");
  }

  await connectDB();
  const [initialByTile, metiers] = await Promise.all([
    getMenuVisibilityByTile(),
    MetierRole.find({}).sort({ label: 1 }).select("slug label").lean(),
  ]);

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
          Matrice visibilité des menus
        </h1>
        <p className="mt-2 text-slate-600">
          Pilotez quels <strong>rôles métier</strong> voient les tuiles (accueil et
          hub). Les permissions applicatives restent nécessaires pour agir sur les
          routes.
        </p>
      </header>

      <MenuVisibilityMatrix
        key={JSON.stringify(initialByTile)}
        initialByTile={initialByTile}
        metierRoles={metierRoles}
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
