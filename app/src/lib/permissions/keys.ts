/** Slug Mongo du rôle administrateur (garde matrice / droits privilégiés). */
export const MONGO_ADMIN_ROLE_SLUG = "admin" as const;

export const ROLE_ADMIN_SLUG = MONGO_ADMIN_ROLE_SLUG;
export const ROLE_USER_SLUG = "user" as const;

export const ROLE_COORDINATEUR_FORMATION_SLUG = "coordinateur_formation" as const;
export const ROLE_CREATION_CLASSE_SLUG = "création_classe" as const;
export const ROLE_CREATION_ELEVE_SLUG = "création_éléve" as const;
export const ROLE_CREATION_PROFESSEUR_SLUG = "création_professeur" as const;
export const ROLE_CREATION_MATIERE_SLUG = "création_matière" as const;
export const ROLE_CREATION_CONTENU_PEDAGOGIQUE_SLUG =
  "création_contenu_pédagogique" as const;
export const ROLE_CREATION_SALLE_SLUG = "création_salle" as const;

/** Slugs attribués au compte init admin : cumul de tous les rôles applicatifs (seed). */
export const ALL_ADMIN_ACCOUNT_ROLE_SLUGS = [
  ROLE_ADMIN_SLUG,
  ROLE_USER_SLUG,
  ROLE_COORDINATEUR_FORMATION_SLUG,
  ROLE_CREATION_CLASSE_SLUG,
  ROLE_CREATION_ELEVE_SLUG,
  ROLE_CREATION_PROFESSEUR_SLUG,
  ROLE_CREATION_MATIERE_SLUG,
  ROLE_CREATION_CONTENU_PEDAGOGIQUE_SLUG,
  ROLE_CREATION_SALLE_SLUG,
] as const;

/** Slug d’exemple pour le seed des rôles métier (agrégat de rôles de base). */
export const METIER_ROLE_COORDO_PEDAGO_SLUG = "coordo_pedago" as const;

/**
 * Rôle métier attribué au compte créé par `init:admin` : permet de passer les filtres
 * de la matrice de visibilité tout en agrégeant le rôle de base `admin`.
 */
export const METIER_ROLE_INIT_ADMIN_SLUG = "plateforme_admin" as const;

/** Accès à l’espace /accueil après connexion. */
export const PERMISSION_ACCUEIL_ACCESS = "feature.accueil.access" as const;

/** Page exemple réservée aux administrateurs (seed). */
export const PERMISSION_ADMIN_DEMO = "feature.admin.demo" as const;

export const PERMISSION_COORDINATEUR_FORMATION =
  "feature.coordinateur_formation" as const;
export const PERMISSION_CREATION_CLASSE = "feature.creation.classe" as const;
export const PERMISSION_CREATION_ELEVE = "feature.creation.eleve" as const;
export const PERMISSION_CREATION_PROFESSEUR =
  "feature.creation.professeur" as const;
export const PERMISSION_CREATION_MATIERE = "feature.creation.matiere" as const;

export const PERMISSION_CREATION_CONTENU_PEDAGOGIQUE =
  "feature.creation.contenu_pedagogique" as const;
export const PERMISSION_CREATION_SALLE = "feature.creation.salle" as const;

/** Hub /administration et tuile correspondante sur /accueil. */
export const PERMISSION_ADMINISTRATION_ACCESS =
  "feature.administration.access" as const;

/** Création / édition / suppression de rôles métier (`/administration/roles-metier`). */
export const PERMISSION_ADMIN_ROLES_METIER =
  "feature.administration.roles_metier" as const;

/** Gestion des utilisateurs (/administration/utilisateurs). */
export const PERMISSION_ADMIN_UTILISATEURS =
  "feature.administration.utilisateurs" as const;

/** Gestion de la matrice visibilité × rôle métier (/administration/matricemenu). */
export const PERMISSION_ADMIN_MATRICE_MENU =
  "feature.administration.matricemenu" as const;

/** Union pour entrée sur le segment /administration* (layout). */
export const ADMIN_SEGMENT_PERMISSIONS = [
  PERMISSION_ADMINISTRATION_ACCESS,
  PERMISSION_ADMIN_ROLES_METIER,
  PERMISSION_ADMIN_UTILISATEURS,
  PERMISSION_ADMIN_MATRICE_MENU,
  PERMISSION_CREATION_CLASSE,
  PERMISSION_CREATION_PROFESSEUR,
  PERMISSION_CREATION_MATIERE,
  PERMISSION_CREATION_CONTENU_PEDAGOGIQUE,
  PERMISSION_CREATION_SALLE,
] as const;

export const ROUTE_MATRIX_ROWS = [
  {
    permissionKey: PERMISSION_ACCUEIL_ACCESS,
    routeLabel: "Accueil authentifié",
    routePath: "/accueil",
    scopeNote: "Hub post-connexion ; tuile ou entrée future.",
  },
  {
    permissionKey: PERMISSION_ADMIN_DEMO,
    routeLabel: "Démo administration",
    routePath: "/admin-demo",
    scopeNote: "Exemple de route protégée par permission (admin en seed).",
  },
  {
    permissionKey: PERMISSION_COORDINATEUR_FORMATION,
    routeLabel: "Coordinateur formation",
    routePath: "(à brancher)",
    scopeNote: "Rôle métier coordinateur_formation.",
  },
  {
    permissionKey: PERMISSION_CREATION_CLASSE,
    routeLabel: "Création de classe",
    routePath: "/administration/creation-classe",
    scopeNote: "Rôle métier création_classe ; tuile hub Administration.",
  },
  {
    permissionKey: PERMISSION_CREATION_ELEVE,
    routeLabel: "Création d’élève",
    routePath: "(à brancher)",
    scopeNote: "Rôle métier création_éléve.",
  },
  {
    permissionKey: PERMISSION_CREATION_PROFESSEUR,
    routeLabel: "Création de professeur",
    routePath: "/administration/creation-professeur",
    scopeNote: "Rôle de base création_professeur ; tuile hub + référentiel CRUD.",
  },
  {
    permissionKey: PERMISSION_CREATION_MATIERE,
    routeLabel: "Création de matière",
    routePath: "/administration/creation-matiere",
    scopeNote: "Rôle métier création_matière ; tuile hub Administration.",
  },
  {
    permissionKey: PERMISSION_CREATION_CONTENU_PEDAGOGIQUE,
    routeLabel: "Création de contenu pédagogique",
    routePath: "/administration/creation-contenu-pedagogique",
    scopeNote:
      "Rôle création_contenu_pédagogique ; fiches matière + professeurs + heures.",
  },
  {
    permissionKey: PERMISSION_CREATION_SALLE,
    routeLabel: "Création de salle",
    routePath: "/administration/creation-salle",
    scopeNote:
      "Rôle création_salle ; référentiel salles CRUD ; tuile hub Administration.",
  },
  {
    permissionKey: PERMISSION_ADMINISTRATION_ACCESS,
    routeLabel: "Hub Administration",
    routePath: "/administration",
    scopeNote: "Tuile accueil ; entrée hub Administration.",
  },
  {
    permissionKey: PERMISSION_ADMIN_ROLES_METIER,
    routeLabel: "Rôles métier",
    routePath: "/administration/roles-metier",
    scopeNote:
      "Liste, création (/nouveau), modification ; suppression nettoie utilisateurs et matrice.",
  },
  {
    permissionKey: PERMISSION_ADMIN_UTILISATEURS,
    routeLabel: "Gestion des utilisateurs",
    routePath: "/administration/utilisateurs",
    scopeNote: "Sous-menu hub Administration.",
  },
  {
    permissionKey: PERMISSION_ADMIN_MATRICE_MENU,
    routeLabel: "Matrice visibilité menus",
    routePath: "/administration/matricemenu",
    scopeNote:
      "Tuiles affichées selon rôles métier ; n’emplit pas les gardes de routes.",
  },
] as const;

export const ALL_APP_PERMISSION_KEYS = [
  ...new Set(ROUTE_MATRIX_ROWS.map((r) => r.permissionKey)),
] as readonly string[];
