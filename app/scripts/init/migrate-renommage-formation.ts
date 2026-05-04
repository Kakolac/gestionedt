/**
 * Après le renommage **contenu pédagogique** → **formation** (slug rôle, clé permission,
 * id de tuile matrice), met à jour les documents MongoDB existants :
 *
 * - `roles` : slug `création_contenu_pédagogique` → `création_formation`, permission
 *   `feature.creation.contenu_pedagogique` → `feature.creation.formation` dans les tableaux ;
 * - `metierroles` : entrées de `baseRoleSlugs` ;
 * - `users` : entrées de `roleSlugs` ;
 * - `menuvisibilityconfigs` : clé `hub.creation_contenu_pedagogique` → `hub.creation_formation` dans `byTile`.
 *
 * Idempotent pour la plupart des cas (réexécuter après seed partiel).
 *
 * Usage : depuis **`app/`** — `npx tsx scripts/init/migrate-renommage-formation.ts`
 */
import { loadEnv } from "./load-env.js";

loadEnv();

import mongoose from "mongoose";
import { connectDB } from "../../src/lib/mongodb.js";
import { MenuVisibilityConfig } from "../../src/lib/models/MenuVisibilityConfig.js";
import { MetierRole } from "../../src/lib/models/MetierRole.js";
import { Role } from "../../src/lib/models/Role.js";
import { User } from "../../src/lib/models/User.js";

const OLD_PERM = "feature.creation.contenu_pedagogique";
const NEW_PERM = "feature.creation.formation";
const OLD_ROLE_SLUG = "création_contenu_pédagogique";
const NEW_ROLE_SLUG = "création_formation";
const OLD_LABEL = "Création contenu pédagogique";
const NEW_LABEL = "Création formation";
const OLD_TILE = "hub.creation_contenu_pedagogique";
const NEW_TILE = "hub.creation_formation";

async function patchPermissionsInRoles(): Promise<number> {
  const cursor = Role.find({ permissions: OLD_PERM }).cursor();
  let n = 0;
  for await (const doc of cursor) {
    doc.permissions = doc.permissions.map((p: string) =>
      p === OLD_PERM ? NEW_PERM : p
    );
    await doc.save();
    n += 1;
  }
  return n;
}

async function patchSpecializedRoleSlug(): Promise<void> {
  const bySlug = await Role.findOne({ slug: OLD_ROLE_SLUG });
  if (bySlug) {
    bySlug.slug = NEW_ROLE_SLUG;
    bySlug.label = NEW_LABEL;
    bySlug.permissions = bySlug.permissions.map((p: string) =>
      p === OLD_PERM ? NEW_PERM : p
    );
    await bySlug.save();
    return;
  }
  const byLabel = await Role.findOne({ label: OLD_LABEL });
  if (byLabel && byLabel.slug !== NEW_ROLE_SLUG) {
    byLabel.slug = NEW_ROLE_SLUG;
    byLabel.label = NEW_LABEL;
    byLabel.permissions = byLabel.permissions.map((p: string) =>
      p === OLD_PERM ? NEW_PERM : p
    );
    await byLabel.save();
  }
}

async function patchMetierBaseSlugs(): Promise<number> {
  const res = await MetierRole.updateMany(
    { baseRoleSlugs: OLD_ROLE_SLUG },
    { $set: { "baseRoleSlugs.$[elem]": NEW_ROLE_SLUG } },
    { arrayFilters: [{ elem: OLD_ROLE_SLUG }] }
  );
  return res.modifiedCount ?? 0;
}

async function patchUserRoleSlugs(): Promise<number> {
  const res = await User.updateMany(
    { roleSlugs: OLD_ROLE_SLUG },
    { $set: { "roleSlugs.$[elem]": NEW_ROLE_SLUG } },
    { arrayFilters: [{ elem: OLD_ROLE_SLUG }] }
  );
  return res.modifiedCount ?? 0;
}

async function patchMenuByTile(): Promise<void> {
  const docs = await MenuVisibilityConfig.find({}).lean();
  for (const d of docs) {
    const raw = d.byTile as Record<string, unknown> | undefined;
    if (!raw || typeof raw !== "object") continue;
    if (OLD_TILE in raw && !(NEW_TILE in raw)) {
      const v = raw[OLD_TILE];
      const next: Record<string, unknown> = { ...raw, [NEW_TILE]: v };
      delete next[OLD_TILE];
      await MenuVisibilityConfig.updateOne(
        { _id: d._id },
        { $set: { byTile: next } }
      );
    } else if (OLD_TILE in raw && NEW_TILE in raw) {
      const next: Record<string, unknown> = { ...raw };
      delete next[OLD_TILE];
      await MenuVisibilityConfig.updateOne(
        { _id: d._id },
        { $set: { byTile: next } }
      );
    }
  }
}

async function main(): Promise<void> {
  await connectDB();
  await patchSpecializedRoleSlug();
  const rolesPerm = await patchPermissionsInRoles();
  const metier = await patchMetierBaseSlugs();
  const users = await patchUserRoleSlugs();
  await patchMenuByTile();

  console.info(
    `Migration renommage formation : rôles avec permission remplacée (séries save) : ${rolesPerm}, MetierRole modifiés : ${metier}, User modifiés : ${users}.`
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
