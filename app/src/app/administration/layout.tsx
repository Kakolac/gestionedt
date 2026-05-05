import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { ADMIN_SEGMENT_PERMISSIONS } from "@/lib/permissions/keys";

export default async function AdministrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    ...ADMIN_SEGMENT_PERMISSIONS,
  ]);

  if (!allowed) {
    redirect("/accueil");
  }

  return (
    <div className="mx-auto flex w-full max-w-[min(96vw,80rem)] flex-col gap-6 px-4 py-10">
      <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <Link
          href="/accueil"
          className="font-medium text-indigo-600 underline-offset-4 hover:underline"
        >
          Accueil
        </Link>
        <span aria-hidden>/</span>
        <Link
          href="/administration"
          className="font-medium text-indigo-600 underline-offset-4 hover:underline"
        >
          Administration
        </Link>
      </nav>
      {children}
    </div>
  );
}
