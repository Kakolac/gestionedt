import Link from "next/link";
import { auth } from "@/lib/auth";
import { AdministrationAccueilTile } from "@/components/accueil/AdministrationAccueilTile";
import { SignOutButton } from "@/components/SignOutButton";
import { resolveNavTileVisible } from "@/lib/menuVisibility/resolveNavTileVisible";
import { PERMISSION_ACCUEIL_ACCESS } from "@/lib/permissions/keys";

export default async function AccueilPage() {
  const session = await auth();
  const user = session?.user;
  const canDemo =
    session != null
      ? await resolveNavTileVisible(session, "accueil.admin_demo")
      : false;

  const canAdministration =
    session != null
      ? await resolveNavTileVisible(session, "accueil.administration")
      : false;

  const u = user as {
    name?: string | null;
    email?: string | null;
    role?: string;
    roleSlugs?: string[];
    permissions?: string[];
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
            AdAgile
          </p>
          <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            Accueil
          </h1>
          <p className="mt-2 text-slate-600">
            Bienvenue
            {u?.name ? `, ${u.name}` : u?.email ? `, ${u.email}` : ""}.
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="rounded-2xl border border-white/60 bg-white/80 p-6 shadow-[0_8px_30px_rgba(49,46,129,0.06)]">
        <h2 className="text-lg font-semibold text-slate-900">
          Session et rôles (aperçu)
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Ces informations servent à valider le branchement NextAuth + MongoDB.
          Vous pourrez les retirer ou les restreindre aux environnements de
          développement.
        </p>
        <dl className="mt-4 grid gap-2 text-sm text-slate-800">
          <div className="flex flex-wrap gap-2">
            <dt className="font-medium text-slate-500">Rôle legacy</dt>
            <dd>{u?.role ?? "—"}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-medium text-slate-500">Slugs Mongo</dt>
            <dd>{(u?.roleSlugs ?? []).join(", ") || "—"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-medium text-slate-500">Permissions (JWT)</dt>
            <dd className="font-mono text-xs leading-relaxed">
              {(u?.permissions ?? []).join(", ") || "—"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-medium text-slate-500">
              Permission accueil ({PERMISSION_ACCUEIL_ACCESS})
            </dt>
            <dd>accordée (sinon ce bloc ne s&apos;afficherait pas)</dd>
          </div>
        </dl>
      </section>

      {canAdministration ? (
        <section aria-label="Raccourcis">
          <h2 className="sr-only">Raccourcis</h2>
          <ul className="flex flex-wrap gap-4">
            <li className="min-w-[240px] flex-1 basis-64 max-w-sm">
              <AdministrationAccueilTile />
            </li>
          </ul>
        </section>
      ) : null}

      {canDemo ? (
        <p>
          <Link
            href="/admin-demo"
            className="font-medium text-indigo-600 underline-offset-4 hover:underline"
          >
            Page démo réservée (administration)
          </Link>
        </p>
      ) : null}
    </main>
  );
}
