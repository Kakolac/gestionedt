import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { PERMISSION_ADMIN_DEMO } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";

export default async function AdminDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_ADMIN_DEMO,
  ]);

  if (!allowed) {
    redirect("/accueil");
  }

  return <>{children}</>;
}
