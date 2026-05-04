import { connectDB } from "@/lib/mongodb";
import {
  MENU_VISIBILITY_GLOBAL_KEY,
  MenuVisibilityConfig,
} from "@/lib/models/MenuVisibilityConfig";
import { NAV_TILE_IDS } from "@/lib/menuVisibility/tiles";

function normalizeSlug(s: string): string {
  return s.trim().toLowerCase();
}

export type MenuVisibilityByTile = Record<string, string[]>;

export function sanitizeMenuVisibilityByTile(raw: unknown): MenuVisibilityByTile {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const o = raw as Record<string, unknown>;
  const out: MenuVisibilityByTile = {};
  for (const tileId of NAV_TILE_IDS) {
    const v = o[tileId];
    if (!Array.isArray(v)) {
      continue;
    }
    const slugs = [
      ...new Set(
        v
          .filter((x): x is string => typeof x === "string")
          .map(normalizeSlug)
          .filter(Boolean)
      ),
    ];
    if (slugs.length > 0) {
      out[tileId] = slugs;
    }
  }
  return out;
}

export async function getMenuVisibilityByTile(): Promise<MenuVisibilityByTile> {
  await connectDB();
  const doc = await MenuVisibilityConfig.findOne({
    singletonKey: MENU_VISIBILITY_GLOBAL_KEY,
  })
    .select("byTile")
    .lean();
  if (!doc?.byTile) {
    return {};
  }
  return sanitizeMenuVisibilityByTile(doc.byTile);
}
