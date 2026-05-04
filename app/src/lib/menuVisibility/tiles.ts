import {
  ADMIN_SEGMENT_PERMISSIONS,
  PERMISSION_ADMIN_DEMO,
  PERMISSION_ADMIN_ROLES_METIER,
  PERMISSION_ADMIN_UTILISATEURS,
  PERMISSION_CREATION_CLASSE,
  PERMISSION_CREATION_FORMATION,
  PERMISSION_CREATION_MATIERE,
  PERMISSION_CREATION_PROFESSEUR,
  PERMISSION_CREATION_SALLE,
} from "@/lib/permissions/keys";

export type NavTileScope = "accueil" | "hub";

export type NavTileDefinition = {
  id: string;
  label: string;
  scope: NavTileScope;
  /** Au moins une de ces permissions doit être accordée (live) pour que la tuile soit éligible. */
  permissionKeys: readonly string[];
};

/**
 * Tuiles pilotées par la matrice de visibilité (rôles métier).
 * La tuile « Matrice menus » n’est pas listée : elle reste visible uniquement via sa permission dédiée.
 *
 * Nouvelle entrée pilotée par la matrice : ajouter ici puis brancher `resolveNavTileVisible`
 * dans les pages — voir `docs/matrice-visibilite-menus.md`.
 */
export const NAV_TILE_DEFINITIONS: readonly NavTileDefinition[] = [
  {
    id: "accueil.administration",
    label: "Administration (accueil)",
    scope: "accueil",
    permissionKeys: ADMIN_SEGMENT_PERMISSIONS,
  },
  {
    id: "accueil.admin_demo",
    label: "Démo administration (lien accueil)",
    scope: "accueil",
    permissionKeys: [PERMISSION_ADMIN_DEMO],
  },
  {
    id: "hub.roles_metier",
    label: "Rôles métier",
    scope: "hub",
    permissionKeys: [PERMISSION_ADMIN_ROLES_METIER],
  },
  {
    id: "hub.utilisateurs",
    label: "Gestion des utilisateurs",
    scope: "hub",
    permissionKeys: [PERMISSION_ADMIN_UTILISATEURS],
  },
  {
    id: "hub.creation_classe",
    label: "Création classe",
    scope: "hub",
    permissionKeys: [PERMISSION_CREATION_CLASSE],
  },
  {
    id: "hub.creation_professeur",
    label: "Création professeur",
    scope: "hub",
    permissionKeys: [PERMISSION_CREATION_PROFESSEUR],
  },
  {
    id: "hub.creation_matiere",
    label: "Création matière",
    scope: "hub",
    permissionKeys: [PERMISSION_CREATION_MATIERE],
  },
  {
    id: "hub.creation_formation",
    label: "Formation",
    scope: "hub",
    permissionKeys: [PERMISSION_CREATION_FORMATION],
  },
  {
    id: "hub.export_formation_json",
    label: "Export JSON formations",
    scope: "hub",
    permissionKeys: [PERMISSION_CREATION_FORMATION],
  },
  {
    id: "hub.creation_salle",
    label: "Création salle",
    scope: "hub",
    permissionKeys: [PERMISSION_CREATION_SALLE],
  },
] as const;

export const NAV_TILE_IDS = NAV_TILE_DEFINITIONS.map((t) => t.id);

export function navTileById(id: string): NavTileDefinition | undefined {
  return NAV_TILE_DEFINITIONS.find((t) => t.id === id);
}
