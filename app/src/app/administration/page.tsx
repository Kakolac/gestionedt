import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { CreerClasseHubTile } from "@/components/administration/CreerClasseHubTile";
import { CreerFormationHubTile } from "@/components/administration/CreerFormationHubTile";
import { ExportFormationJsonHubTile } from "@/components/administration/ExportFormationJsonHubTile";
import { PlanningFormationHubTile } from "@/components/administration/PlanningFormationHubTile";
import { CreerMatiereHubTile } from "@/components/administration/CreerMatiereHubTile";
import { CreerSalleHubTile } from "@/components/administration/CreerSalleHubTile";
import { CreerProfesseurHubTile } from "@/components/administration/CreerProfesseurHubTile";
import { CreerRoleMetierHubTile } from "@/components/administration/CreerRoleMetierHubTile";
import { GestionUtilisateursHubTile } from "@/components/administration/GestionUtilisateursHubTile";
import { GestionVacancesHubTile } from "@/components/administration/GestionVacancesHubTile";
import { MatriceMenuHubTile } from "@/components/administration/MatriceMenuHubTile";
import { resolveNavTileVisible } from "@/lib/menuVisibility/resolveNavTileVisible";
import {
  PERMISSION_ADMINISTRATION_ACCESS,
  PERMISSION_ADMIN_MATRICE_MENU,
} from "@/lib/permissions/keys";

export default async function AdministrationHubPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const [
    canHub,
    showMetierTile,
    showUsersTile,
    showCreationClasseTile,
    showCreationProfesseurTile,
    showCreationMatiereTile,
    showFormationTile,
    showExportFormationJsonTile,
    showPlanningFormationTile,
    showCreationSalleTile,
    showGestionVacancesTile,
    canMatrice,
  ] = await Promise.all([
    liveSessionHasAnyPermission(session, [PERMISSION_ADMINISTRATION_ACCESS]),
    resolveNavTileVisible(session, "hub.roles_metier"),
    resolveNavTileVisible(session, "hub.utilisateurs"),
    resolveNavTileVisible(session, "hub.creation_classe"),
    resolveNavTileVisible(session, "hub.creation_professeur"),
    resolveNavTileVisible(session, "hub.creation_matiere"),
    resolveNavTileVisible(session, "hub.creation_formation"),
    resolveNavTileVisible(session, "hub.export_formation_json"),
    resolveNavTileVisible(session, "hub.planning_formation"),
    resolveNavTileVisible(session, "hub.creation_salle"),
    resolveNavTileVisible(session, "hub.gestion_vacances"),
    liveSessionHasAnyPermission(session, [PERMISSION_ADMIN_MATRICE_MENU]),
  ]);

  const hasAnyShortcut =
    showMetierTile ||
    showUsersTile ||
    showCreationClasseTile ||
    showCreationProfesseurTile ||
    showCreationMatiereTile ||
    showFormationTile ||
    showExportFormationJsonTile ||
    showPlanningFormationTile ||
    showCreationSalleTile ||
    showGestionVacancesTile ||
    canMatrice;

  if (!canHub && !hasAnyShortcut) {
    redirect("/accueil");
  }

  return (
    <main className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
          Administration
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Hub
        </h1>
        <p className="mt-2 text-slate-600">
          Choisissez une action. Les entrées affichées dépendent de vos droits et,
          le cas échéant, de la matrice visibilité × rôle métier.
        </p>
      </header>

      <section aria-label="Raccourcis">
        <ul className="flex flex-wrap gap-4">
          {showMetierTile ? (
            <li className="min-w-[240px] flex-1 basis-64 max-w-sm">
              <CreerRoleMetierHubTile />
            </li>
          ) : null}
          {showUsersTile ? (
            <li className="min-w-[240px] flex-1 basis-64 max-w-sm">
              <GestionUtilisateursHubTile />
            </li>
          ) : null}
          {showCreationClasseTile ? (
            <li className="min-w-[240px] flex-1 basis-64 max-w-sm">
              <CreerClasseHubTile />
            </li>
          ) : null}
          {showCreationProfesseurTile ? (
            <li className="min-w-[240px] flex-1 basis-64 max-w-sm">
              <CreerProfesseurHubTile />
            </li>
          ) : null}
          {showCreationMatiereTile ? (
            <li className="min-w-[240px] flex-1 basis-64 max-w-sm">
              <CreerMatiereHubTile />
            </li>
          ) : null}
          {showFormationTile ? (
            <li className="min-w-[240px] flex-1 basis-64 max-w-sm">
              <CreerFormationHubTile />
            </li>
          ) : null}
          {showExportFormationJsonTile ? (
            <li className="min-w-[240px] flex-1 basis-64 max-w-sm">
              <ExportFormationJsonHubTile />
            </li>
          ) : null}
          {showPlanningFormationTile ? (
            <li className="min-w-[240px] flex-1 basis-64 max-w-sm">
              <PlanningFormationHubTile />
            </li>
          ) : null}
          {showCreationSalleTile ? (
            <li className="min-w-[240px] flex-1 basis-64 max-w-sm">
              <CreerSalleHubTile />
            </li>
          ) : null}
          {showGestionVacancesTile ? (
            <li className="min-w-[240px] flex-1 basis-64 max-w-sm">
              <GestionVacancesHubTile />
            </li>
          ) : null}
          {canMatrice ? (
            <li className="min-w-[240px] flex-1 basis-64 max-w-sm">
              <MatriceMenuHubTile />
            </li>
          ) : null}
        </ul>
      </section>

      {!hasAnyShortcut ? (
        <p className="text-sm text-slate-600">
          Vous pouvez ouvrir ce hub, mais aucune action n&apos;est disponible.
          Demandez les droits nécessaires ou la permission{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            {PERMISSION_ADMIN_MATRICE_MENU}
          </code>{" "}
          pour la matrice des menus.
        </p>
      ) : null}

      <p className="text-sm">
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
