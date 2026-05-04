import { navTileById } from "@/lib/menuVisibility/tiles";
import type { MenuVisibilityByTile } from "@/lib/menuVisibility/loadRules";

function normalizeSlug(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Affichage des tuiles du registre : permissions **et** matrice obligatoires.
 *
 * - Pas d’entrée en base pour cette tuile, ou liste vide → **non visible** (même si les permissions sont OK).
 * - Utilisateur **sans** `metierRoleSlugs` → **non visible** pour ces tuiles.
 * - Sinon → visible si au moins un métier de l’utilisateur figure dans la liste enregistrée.
 *
 * Les gardes de routes / actions restent basées sur les permissions uniquement.
 */
export function isNavTileVisibleForUser(params: {
  tileId: string;
  permissionOk: boolean;
  liveMetierRoleSlugs: readonly string[];
  byTile: MenuVisibilityByTile;
}): boolean {
  if (!params.permissionOk) {
    return false;
  }
  const def = navTileById(params.tileId);
  if (!def) {
    return false;
  }

  const allowed = params.byTile[params.tileId];
  if (!allowed || allowed.length === 0) {
    return false;
  }

  const userMetiers = params.liveMetierRoleSlugs
    .map(normalizeSlug)
    .filter(Boolean);
  if (userMetiers.length === 0) {
    return false;
  }

  const allowSet = new Set(allowed.map(normalizeSlug));
  return userMetiers.some((m) => allowSet.has(m));
}
