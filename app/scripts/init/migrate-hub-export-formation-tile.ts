/**
 * Initialise la visibilité matrice pour la tuile **Export JSON formations** (`hub.export_formation_json`)
 * sur les configs existantes : copie les slugs `MetierRole` de **`hub.creation_formation`**
 * lorsque `hub.export_formation_json` est absent. Sinon ne modifie rien pour ce document (idempotent).
 *
 * Sans cette étape sur une base déjà peuplée, la nouvelle tuile reste invisible côté matrice jusqu’à
 * configuration manuelle dans `/administration/matricemenu`.
 *
 * Usage : depuis **`app/`** — `npx tsx scripts/init/migrate-hub-export-formation-tile.ts`
 * ou `npm run migrate:hub-export-tile`.
 */
import { loadEnv } from "./load-env.js";

loadEnv();

import mongoose from "mongoose";
import { connectDB } from "../../src/lib/mongodb.js";
import { MenuVisibilityConfig } from "../../src/lib/models/MenuVisibilityConfig.js";

const SOURCE_TILE = "hub.creation_formation";
const TARGET_TILE = "hub.export_formation_json";

async function main(): Promise<void> {
  await connectDB();

  const docs = await MenuVisibilityConfig.find({}).lean();
  let updated = 0;

  for (const d of docs) {
    const raw = d.byTile as Record<string, unknown> | undefined;
    if (!raw || typeof raw !== "object") {
      continue;
    }
    if (TARGET_TILE in raw) {
      continue;
    }

    const source = raw[SOURCE_TILE];
    const next: Record<string, unknown> = { ...raw };
    if (Array.isArray(source) && source.every((x) => typeof x === "string")) {
      next[TARGET_TILE] = [...source];
    } else {
      next[TARGET_TILE] = [];
      console.warn(
        `[migrate-hub-export-tile] Config ${String(d._id)} : pas de liste valide pour ${SOURCE_TILE}, ${TARGET_TILE} → [].`
      );
    }

    await MenuVisibilityConfig.updateOne({ _id: d._id }, { $set: { byTile: next } });
    updated += 1;
  }

  console.info(
    `Migration tuile export JSON : ${updated} document(s) MenuVisibilityConfig mis à jour.`
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
