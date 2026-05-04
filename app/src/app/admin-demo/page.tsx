import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { PERMISSION_ADMIN_DEMO } from "@/lib/permissions/keys";

export default function AdminDemoPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          Démo — route protégée
        </h1>
        <SignOutButton />
      </header>
      <p className="text-slate-600">
        Cette page requiert la permission{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">
          {PERMISSION_ADMIN_DEMO}
        </code>{" "}
        (rôle <strong>admin</strong> après <code>npm run init:roles</code> /
        seed).
      </p>
      <p>
        <Link
          href="/accueil"
          className="font-medium text-indigo-600 underline-offset-4 hover:underline"
        >
          Retour à l&apos;accueil
        </Link>
      </p>
    </main>
  );
}
