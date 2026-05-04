import { loadEnv } from "./load-env.js";
loadEnv();

import { connectDB } from "../../src/lib/mongodb.js";
import { Role } from "../../src/lib/models/Role.js";
import {
  ALL_APP_PERMISSION_KEYS,
  PERMISSION_ADMIN_DEMO,
  PERMISSION_COORDINATEUR_FORMATION,
  PERMISSION_CREATION_CLASSE,
  PERMISSION_CREATION_CONTENU_PEDAGOGIQUE,
  PERMISSION_CREATION_ELEVE,
  PERMISSION_CREATION_MATIERE,
  PERMISSION_CREATION_PROFESSEUR,
  PERMISSION_CREATION_SALLE,
  ROLE_ADMIN_SLUG,
  ROLE_COORDINATEUR_FORMATION_SLUG,
  ROLE_CREATION_CLASSE_SLUG,
  ROLE_CREATION_CONTENU_PEDAGOGIQUE_SLUG,
  ROLE_CREATION_ELEVE_SLUG,
  ROLE_CREATION_MATIERE_SLUG,
  ROLE_CREATION_PROFESSEUR_SLUG,
  ROLE_CREATION_SALLE_SLUG,
  ROLE_USER_SLUG,
} from "../../src/lib/permissions/keys.js";

const SPECIALIZED_ROLES: ReadonlyArray<{
  slug: string;
  label: string;
  permissions: readonly string[];
}> = [
  {
    slug: ROLE_COORDINATEUR_FORMATION_SLUG,
    label: "Coordinateur formation",
    permissions: [PERMISSION_COORDINATEUR_FORMATION],
  },
  {
    slug: ROLE_CREATION_CLASSE_SLUG,
    label: "Création classe",
    permissions: [PERMISSION_CREATION_CLASSE],
  },
  {
    slug: ROLE_CREATION_ELEVE_SLUG,
    label: "Création élève",
    permissions: [PERMISSION_CREATION_ELEVE],
  },
  {
    slug: ROLE_CREATION_PROFESSEUR_SLUG,
    label: "Création professeur",
    permissions: [PERMISSION_CREATION_PROFESSEUR],
  },
  {
    slug: ROLE_CREATION_MATIERE_SLUG,
    label: "Création matière",
    permissions: [PERMISSION_CREATION_MATIERE],
  },
  {
    slug: ROLE_CREATION_CONTENU_PEDAGOGIQUE_SLUG,
    label: "Création contenu pédagogique",
    permissions: [PERMISSION_CREATION_CONTENU_PEDAGOGIQUE],
  },
  {
    slug: ROLE_CREATION_SALLE_SLUG,
    label: "Création salle",
    permissions: [PERMISSION_CREATION_SALLE],
  },
];

async function main() {
  await connectDB();

  const adminPermissions = [...ALL_APP_PERMISSION_KEYS];
  const userPermissions = ALL_APP_PERMISSION_KEYS.filter(
    (k) => k !== PERMISSION_ADMIN_DEMO
  );

  await Role.updateOne(
    { slug: ROLE_ADMIN_SLUG },
    {
      $set: {
        label: "Administrateur",
        permissions: adminPermissions,
      },
    },
    { upsert: true }
  );

  await Role.updateOne(
    { slug: ROLE_USER_SLUG },
    {
      $set: {
        label: "Utilisateur",
        permissions: userPermissions,
      },
    },
    { upsert: true }
  );

  for (const r of SPECIALIZED_ROLES) {
    await Role.updateOne(
      { slug: r.slug },
      {
        $set: {
          label: r.label,
          permissions: [...r.permissions],
        },
      },
      { upsert: true }
    );
  }

  const seededSlugs = [
    ROLE_ADMIN_SLUG,
    ROLE_USER_SLUG,
    ...SPECIALIZED_ROLES.map((r) => r.slug),
  ];
  console.log("Rôles initialisés :", seededSlugs.join(", "));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
