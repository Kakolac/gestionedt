/**
 * Sur **`contenupedagogiques`** :
 * - supprime les index racine obsolètes **`matiereId`** / **`matiereIds`** (ex. `matiereId_1`, qui provoque E11000 avec `dup key: { matiereId: null }` dès que plusieurs formations n’ont plus ce champ) ;
 * - supprime tout index **unique** sur **`lignes.matiereId`** ;
 * - assure un index **non unique** sur `lignes.matiereId`.
 *
 * Idempotent.
 *
 * Usage : depuis **`app/`** — `npx tsx scripts/init/migrate-formation-matiere-index-non-unique.ts`
 */
import { loadEnv } from "./load-env.js";

loadEnv();

import mongoose from "mongoose";
import { connectDB } from "../../src/lib/mongodb.js";
import { FORMATION_MONGODB_COLLECTION } from "../../src/lib/models/Formation.js";

const INDEX_FIELDS = { "lignes.matiereId": 1 } as const;

async function main(): Promise<void> {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Pas de connexion MongoDB.");
  }
  const coll = db.collection(FORMATION_MONGODB_COLLECTION);

  const legacyRoot = new Set(["matiereId", "matiereIds"]);
  const indexes = await coll.indexes();
  for (const ix of indexes) {
    const key = ix.key as Record<string, unknown>;
    const keys = Object.keys(key);
    const name = typeof ix.name === "string" ? ix.name : "";
    if (name.length === 0) continue;

    if (keys.length === 1 && legacyRoot.has(keys[0])) {
      await coll.dropIndex(name);
      // eslint-disable-next-line no-console
      console.log(`Index racine obsolète supprimé : ${name}`);
      continue;
    }

    if (keys.length === 1 && keys[0] === "lignes.matiereId" && ix.unique === true) {
      await coll.dropIndex(name);
      // eslint-disable-next-line no-console
      console.log(`Index unique supprimé : ${name}`);
    }
  }

  await coll.createIndex(INDEX_FIELDS, { unique: false });
  // eslint-disable-next-line no-console
  console.log(`Index non unique assuré sur lignes.matiereId (${FORMATION_MONGODB_COLLECTION}).`);
}

main()
  .then(() => mongoose.disconnect())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
    void mongoose.disconnect();
  });
