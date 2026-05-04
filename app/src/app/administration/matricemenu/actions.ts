"use server";

import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { MetierRole } from "@/lib/models/MetierRole";
import {
  MENU_VISIBILITY_GLOBAL_KEY,
  MenuVisibilityConfig,
} from "@/lib/models/MenuVisibilityConfig";
import {
  sanitizeMenuVisibilityByTile,
} from "@/lib/menuVisibility/loadRules";
import { PERMISSION_ADMIN_MATRICE_MENU } from "@/lib/permissions/keys";
import { revalidatePath } from "next/cache";

export type SaveMenuVisibilityState =
  | { ok: true }
  | { ok: false; error: string };

async function ensureMatricePermission(): Promise<SaveMenuVisibilityState | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Non connecté." };
  }
  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_ADMIN_MATRICE_MENU,
  ]);
  if (!allowed) {
    return { ok: false, error: "Permission refusée." };
  }
  return null;
}

export async function saveMenuVisibilityByTileAction(
  _prev: SaveMenuVisibilityState | undefined,
  formData: FormData
): Promise<SaveMenuVisibilityState> {
  const denied = await ensureMatricePermission();
  if (denied) {
    return denied;
  }

  const rawJson = formData.get("payload");
  if (typeof rawJson !== "string") {
    return { ok: false, error: "Payload manquant." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    return { ok: false, error: "JSON invalide." };
  }

  const byTile = sanitizeMenuVisibilityByTile(parsed);

  await connectDB();
  const validSlugs = new Set(
    (await MetierRole.find({}).select("slug").lean()).map((m) =>
      String(m.slug).trim().toLowerCase()
    )
  );

  for (const slugs of Object.values(byTile)) {
    const bad = slugs.filter((s) => !validSlugs.has(s.trim().toLowerCase()));
    if (bad.length > 0) {
      return {
        ok: false,
        error: `Rôles métier inconnus : ${bad.join(", ")}`,
      };
    }
  }

  await MenuVisibilityConfig.findOneAndUpdate(
    { singletonKey: MENU_VISIBILITY_GLOBAL_KEY },
    { $set: { byTile } },
    { upsert: true }
  );

  revalidatePath("/accueil");
  revalidatePath("/administration");
  revalidatePath("/administration/matricemenu");
  return { ok: true };
}
