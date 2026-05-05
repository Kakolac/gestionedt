import mongoose from "mongoose";
import { FORMATION_MONGODB_COLLECTION } from "@/lib/models/Formation";

/** Champs racine avant le schéma `lignes[]` : leurs index (surtout uniques) bloquent plusieurs docs avec valeur absente (`matiereId: null`). */
const LEGACY_ROOT_INDEX_FIELDS = new Set(["matiereId", "matiereIds"]);

/**
 * À la première connexion Mongo du process :
 * - supprime les index **racine** obsolètes `matiereId` / `matiereIds` (ex. `matiereId_1`) ;
 * - remplace l’index **unique** multi-clé `lignes.matiereId` par un index non unique (réutilisation d’une matière entre formations).
 *
 * Idempotent.
 */
export async function ensureFormationMatiereIndexNonUnique(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  const coll = db.collection(FORMATION_MONGODB_COLLECTION);
  const indexes = await coll.indexes();

  for (const ix of indexes) {
    const key = ix.key as Record<string, unknown> | undefined;
    const keys = key != null ? Object.keys(key) : [];
    const name = typeof ix.name === "string" ? ix.name : "";

    if (
      keys.length === 1 &&
      LEGACY_ROOT_INDEX_FIELDS.has(keys[0]) &&
      name.length > 0
    ) {
      await coll.dropIndex(name);
      console.warn(
        `[mongodb] Index racine obsolète supprimé sur ${FORMATION_MONGODB_COLLECTION} (${name}, champ ${keys[0]}).`
      );
      continue;
    }

    if (
      keys.length === 1 &&
      keys[0] === "lignes.matiereId" &&
      ix.unique === true &&
      name.length > 0
    ) {
      await coll.dropIndex(name);
      console.warn(
        `[mongodb] Index unique obsolète supprimé sur ${FORMATION_MONGODB_COLLECTION} (${name}).`
      );
    }
  }

  await coll.createIndex({ "lignes.matiereId": 1 }, { unique: false });
}
