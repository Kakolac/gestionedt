import { loadEnv } from "./load-env.js";
loadEnv();

import bcrypt from "bcryptjs";
import { connectDB } from "../../src/lib/mongodb.js";
import {
  MenuVisibilityConfig,
  MENU_VISIBILITY_GLOBAL_KEY,
} from "../../src/lib/models/MenuVisibilityConfig.js";
import { MetierRole } from "../../src/lib/models/MetierRole.js";
import { User } from "../../src/lib/models/User.js";
import { NAV_TILE_IDS } from "../../src/lib/menuVisibility/tiles.js";
import {
  ALL_ADMIN_ACCOUNT_ROLE_SLUGS,
  METIER_ROLE_INIT_ADMIN_SLUG,
  ROLE_ADMIN_SLUG,
} from "../../src/lib/permissions/keys.js";

const email =
  process.env.INIT_ADMIN_EMAIL?.trim().toLowerCase() || "admin@localhost";
const password = process.env.INIT_ADMIN_PASSWORD || "admin";

function isByTileEffectivelyEmpty(byTile: unknown): boolean {
  if (!byTile || typeof byTile !== "object") {
    return true;
  }
  const o = byTile as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    const v = o[key];
    if (Array.isArray(v) && v.length > 0) {
      return false;
    }
  }
  return true;
}

async function main() {
  await connectDB();

  await MetierRole.updateOne(
    { slug: METIER_ROLE_INIT_ADMIN_SLUG },
    {
      $set: {
        label: "Accès plateforme (bootstrap admin)",
        baseRoleSlugs: [ROLE_ADMIN_SLUG],
      },
    },
    { upsert: true }
  );

  const cfg = await MenuVisibilityConfig.findOne({
    singletonKey: MENU_VISIBILITY_GLOBAL_KEY,
  }).lean();

  if (!cfg || isByTileEffectivelyEmpty(cfg.byTile)) {
    const byTile: Record<string, string[]> = {};
    for (const id of NAV_TILE_IDS) {
      byTile[id] = [METIER_ROLE_INIT_ADMIN_SLUG];
    }
    await MenuVisibilityConfig.findOneAndUpdate(
      { singletonKey: MENU_VISIBILITY_GLOBAL_KEY },
      { $set: { byTile } },
      { upsert: true }
    );
    console.log(
      "Matrice visibilité : valeurs par défaut créées (toutes les tuiles du registre → plateforme_admin)."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        passwordHash,
        name: "Administrateur",
        role: "admin",
        roleSlugs: [...ALL_ADMIN_ACCOUNT_ROLE_SLUGS],
        metierRoleSlugs: [METIER_ROLE_INIT_ADMIN_SLUG],
      },
    },
    { upsert: true }
  );

  console.log(`Compte admin prêt : ${email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
