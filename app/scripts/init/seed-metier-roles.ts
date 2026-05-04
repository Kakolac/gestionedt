import { loadEnv } from "./load-env.js";
loadEnv();

import { connectDB } from "../../src/lib/mongodb.js";
import { MetierRole } from "../../src/lib/models/MetierRole.js";
import {
  METIER_ROLE_COORDO_PEDAGO_SLUG,
  METIER_ROLE_INIT_ADMIN_SLUG,
  ROLE_ADMIN_SLUG,
  ROLE_COORDINATEUR_FORMATION_SLUG,
  ROLE_CREATION_CLASSE_SLUG,
  ROLE_CREATION_CONTENU_PEDAGOGIQUE_SLUG,
  ROLE_CREATION_ELEVE_SLUG,
} from "../../src/lib/permissions/keys.js";

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

  await MetierRole.updateOne(
    { slug: METIER_ROLE_COORDO_PEDAGO_SLUG },
    {
      $set: {
        label: "Coordinateur pédagogique (exemple)",
        baseRoleSlugs: [
          ROLE_COORDINATEUR_FORMATION_SLUG,
          ROLE_CREATION_CLASSE_SLUG,
          ROLE_CREATION_CONTENU_PEDAGOGIQUE_SLUG,
          ROLE_CREATION_ELEVE_SLUG,
        ],
      },
    },
    { upsert: true }
  );

  console.log(
    "Rôles métier init :",
    METIER_ROLE_INIT_ADMIN_SLUG,
    "(agrégat admin pour matrice / init:admin) ;",
    METIER_ROLE_COORDO_PEDAGO_SLUG,
    "(exemple coordo pédagogique ; les utilisateurs peuvent mixer base + métier via users.roleSlugs et users.metierRoleSlugs)"
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
