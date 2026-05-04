import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { PERMISSION_ACCUEIL_ACCESS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";

export default async function AccueilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_ACCUEIL_ACCESS,
  ]);

  if (!allowed) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">Accès refusé</h1>
        <p className="text-slate-600">
          Votre compte est connecté mais n&apos;a pas la permission
          d&apos;accéder à l&apos;accueil. Contactez un administrateur ou
          vérifiez les rôles dans MongoDB (collection <code>roles</code>, champ{" "}
          <code>permissions</code>).
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
