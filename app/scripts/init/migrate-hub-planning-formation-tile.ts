/**
 * Initialise la visibilité matrice pour la tuile **Planning formation** (`hub.planning_formation`)
 * sur les configs existantes : copie les slugs de **`hub.export_formation_json`** si présents,
 * sinon ceux de **`hub.creation_formation`**, lorsque `hub.planning_formation` est absent.
 *
 * Usage : depuis **`app/`** — `npx tsx scripts/init/migrate-hub-planning-formation-tile.ts`
 * ou `npm run migrate:hub-planning-tile`.
 */
import { loadEnv } from "./load-env.js";

loadEnv();

import mongoose from "mongoose";
import { connectDB } from "../../src/lib/mongodb.js";
import { MenuVisibilityConfig } from "../../src/lib/models/MenuVisibilityConfig.js";

const TARGET_TILE = "hub.planning_formation";
const PREFER_SOURCE = "hub.export_formation_json";
const FALLBACK_SOURCE = "hub.creation_formation";

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

    const prefer = raw[PREFER_SOURCE];
    const fallback = raw[FALLBACK_SOURCE];
    let sourceList: unknown = prefer;
    if (!Array.isArray(prefer) || !prefer.every((x) => typeof x === "string")) {
      sourceList = fallback;
    }

    const next: Record<string, unknown> = { ...raw };
    if (Array.isArray(sourceList) && sourceList.every((x) => typeof x === "string")) {
      next[TARGET_TILE] = [...sourceList];
    } else {
      next[TARGET_TILE] = [];
      console.warn(
        `[migrate-hub-planning-tile] Config ${String(d._id)} : pas de liste valide pour ${PREFER_SOURCE} ni ${FALLBACK_SOURCE}, ${TARGET_TILE} → [].`
      );
    }

    await MenuVisibilityConfig.updateOne({ _id: d._id }, { $set: { byTile: next } });
    updated += 1;
  }

  console.info(
    `Migration tuile planning formation : ${updated} document(s) MenuVisibilityConfig mis à jour.`
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
