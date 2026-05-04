import type { Session } from "next-auth";
import { liveMetierRoleSlugs, liveSessionHasAnyPermission } from "@/lib/authz";
import { getMenuVisibilityByTile } from "@/lib/menuVisibility/loadRules";
import { navTileById } from "@/lib/menuVisibility/tiles";
import { isNavTileVisibleForUser } from "@/lib/menuVisibility/visibility";

/** Tuile du registre : permissions live + matrice obligatoire (liste métier non vide + intersect utilisateur). */
export async function resolveNavTileVisible(
  session: Session | null,
  tileId: string
): Promise<boolean> {
  const def = navTileById(tileId);
  if (!session?.user || !def) {
    return false;
  }
  const [permissionOk, byTile, liveMetiers] = await Promise.all([
    liveSessionHasAnyPermission(session, [...def.permissionKeys]),
    getMenuVisibilityByTile(),
    liveMetierRoleSlugs(session),
  ]);
  return isNavTileVisibleForUser({
    tileId,
    permissionOk,
    liveMetierRoleSlugs: liveMetiers,
    byTile,
  });
}
