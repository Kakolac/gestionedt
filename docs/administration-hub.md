# Hub Administration — contexte développement

Ce document décrit le **hub `/administration`**, les permissions associées et les fichiers concernés dans le dépôt **gestionedt**.

## Parcours utilisateur

1. Après connexion, **`/accueil`** affiche une tuile **Administration** si l’utilisateur **voit** cette entrée au sens [`resolveNavTileVisible`](../app/src/lib/menuVisibility/resolveNavTileVisible.ts) (permissions live **et**, le cas échéant, [matrice visibilité × rôle métier](./matrice-visibilite-menus.md)).
2. La tuile mène au hub **`/administration`** : section **Raccourcis** avec des sous‑tuiles selon les droits **et**, le cas échéant, la matrice [`tiles.ts`](../app/src/lib/menuVisibility/tiles.ts) :
   - **Rôles métier** → **`/administration/roles-metier`** (liste ; création **`/administration/roles-metier/nouveau`**)
   - **Gestion des utilisateurs** → **`/administration/utilisateurs`**
   - **Création classe** → **`/administration/creation-classe`** (permission **`feature.creation.classe`** ; rôle de base **`création_classe`**)
   - **Création professeur** → **`/administration/creation-professeur`** (référentiel professeurs CRUD ; permission **`feature.creation.professeur`** ; rôle de base **`création_professeur`** — détail [`creation-gestion-professeurs.md`](./creation-gestion-professeurs.md))
   - **Création matière** → **`/administration/creation-matiere`** (référentiel matières CRUD ; permission **`feature.creation.matiere`** ; rôle de base **`création_matière`** — détail flux et modèle : [`creation-gestion-matieres.md`](./creation-gestion-matieres.md))
   - **Contenu pédagogique** → **`/administration/creation-contenu-pedagogique`** (fiches matière + intervenants + heures ; permission **`feature.creation.contenu_pedagogique`** ; rôle **`création_contenu_pédagogique`** — [`creation-contenu-pedagogique.md`](./creation-contenu-pedagogique.md))
   - **Création salle** → **`/administration/creation-salle`** (référentiel salles CRUD ; classique ou salle spécifique ; permission **`feature.creation.salle`** ; rôle **`création_salle`** — [`creation-gestion-salles.md`](./creation-gestion-salles.md))
   - **Matrice visibilité menus** → **`/administration/matricemenu`** (hors registre ; pas pilotée par la matrice elle‑même)
3. Chaque sous‑route métier est protégée par **sa permission dédiée** ; le **`layout.tsx`** du segment autorise l’entrée si **l’union** des permissions listées dans `ADMIN_SEGMENT_PERMISSIONS` (`keys.ts`) est satisfaite (dont création classe / professeur / matière / contenu pédagogique / salle, pour les comptes sans droit hub « pur » mais avec ces rôles de base ; liens directs possibles vers les gardes enfants).

## Permissions (`keys.ts`)

| Constante | Clé | Usage |
|-----------|-----|--------|
| `PERMISSION_ADMINISTRATION_ACCESS` | `feature.administration.access` | Tuile accueil + affichage du hub |
| `PERMISSION_ADMIN_ROLES_METIER` | `feature.administration.roles_metier` | Liste / création / modification / suppression de `MetierRole` |
| `PERMISSION_ADMIN_UTILISATEURS` | `feature.administration.utilisateurs` | Liste et CRUD utilisateurs |
| `PERMISSION_ADMIN_MATRICE_MENU` | `feature.administration.matricemenu` | Édition matrice visibilité tuiles |
| `PERMISSION_CREATION_CLASSE` | `feature.creation.classe` | Page hub + **`/administration/creation-classe`** |
| `PERMISSION_CREATION_PROFESSEUR` | `feature.creation.professeur` | Page hub + référentiel CRUD **`/administration/creation-professeur`** |
| `PERMISSION_CREATION_MATIERE` | `feature.creation.matiere` | Page hub + **`/administration/creation-matiere`** |
| `PERMISSION_CREATION_CONTENU_PEDAGOGIQUE` | `feature.creation.contenu_pedagogique` | Page hub + **`/administration/creation-contenu-pedagogique`** |
| `PERMISSION_CREATION_SALLE` | `feature.creation.salle` | Page hub + **`/administration/creation-salle`** |

Le rôle Mongo **`admin`** (seed [`seed-roles.ts`](../app/scripts/init/seed-roles.ts)) reçoit l’union **`ALL_APP_PERMISSION_KEYS`** : après ajout des clés, exécuter depuis **`app/`** :

```bash
npm run init:roles
```

pour réinjecter les permissions sur les documents `Role`.

## Fichiers principaux

| Fichier | Rôle |
|---------|------|
| [`app/src/lib/permissions/keys.ts`](../app/src/lib/permissions/keys.ts) | Constantes + `ROUTE_MATRIX_ROWS` |
| [`app/src/app/administration/layout.tsx`](../app/src/app/administration/layout.tsx) | Auth ; entrée si union `ADMIN_SEGMENT_PERMISSIONS` |
| [`app/src/app/administration/page.tsx`](../app/src/app/administration/page.tsx) | Hub ; tuiles conditionnelles (matrice × rôle métier sauf Matrice menus) |
| [`app/src/app/administration/creation-classe/page.tsx`](../app/src/app/administration/creation-classe/page.tsx) | Création classe (garde **`feature.creation.classe`**) |
| [`app/src/app/administration/creation-professeur/page.tsx`](../app/src/app/administration/creation-professeur/page.tsx) | Référentiel professeurs CRUD (garde **`feature.creation.professeur`**) |
| [`app/src/app/administration/_actions/professeurs.ts`](../app/src/app/administration/_actions/professeurs.ts) | Actions serveur `Professeur` (création, mise à jour, suppression) |
| [`app/src/app/administration/creation-matiere/page.tsx`](../app/src/app/administration/creation-matiere/page.tsx) | Référentiel matières CRUD (garde **`feature.creation.matiere`**) |
| [`app/src/app/administration/_actions/matieres.ts`](../app/src/app/administration/_actions/matieres.ts) | Actions serveur `Matiere` |
| [`app/src/app/administration/creation-contenu-pedagogique/page.tsx`](../app/src/app/administration/creation-contenu-pedagogique/page.tsx) | Contenus pédagogiques (regroupements matières ; **`feature.creation.contenu_pedagogique`**) |
| [`app/src/app/administration/_actions/contenuPedagogique.ts`](../app/src/app/administration/_actions/contenuPedagogique.ts) | CRUD `ContenuPedagogique` + création matière depuis ce flux |
| [`app/src/app/administration/creation-salle/page.tsx`](../app/src/app/administration/creation-salle/page.tsx) | Référentiel salles CRUD (garde **`feature.creation.salle`**) |
| [`app/src/app/administration/_actions/salles.ts`](../app/src/app/administration/_actions/salles.ts) | Actions serveur `Salle` |
| [`app/src/app/administration/matricemenu/page.tsx`](../app/src/app/administration/matricemenu/page.tsx) | Matrice visibilité |
| [`app/src/app/administration/roles-metier/page.tsx`](../app/src/app/administration/roles-metier/page.tsx) | Liste des rôles métier |
| [`app/src/app/administration/roles-metier/nouveau/page.tsx`](../app/src/app/administration/roles-metier/nouveau/page.tsx) | Page création rôle métier |
| [`app/src/app/administration/roles-metier/[slug]/modifier/page.tsx`](../app/src/app/administration/roles-metier/[slug]/modifier/page.tsx) | Page modification (slug fixe) |
| [`app/src/app/administration/utilisateurs/page.tsx`](../app/src/app/administration/utilisateurs/page.tsx) | Liste utilisateurs |
| [`app/src/app/administration/_actions/metierRoles.ts`](../app/src/app/administration/_actions/metierRoles.ts) | Actions serveur `MetierRole` (création, mise à jour, suppression) |
| [`app/src/app/administration/_actions/users.ts`](../app/src/app/administration/_actions/users.ts) | Actions CRUD `User` |
| [`app/src/lib/slugifyMetier.ts`](../app/src/lib/slugifyMetier.ts) | Génération de slug à partir du libellé |
| [`app/src/components/accueil/AdministrationAccueilTile.tsx`](../app/src/components/accueil/AdministrationAccueilTile.tsx) | Tuile `/accueil` |
| [`app/src/components/administration/*.tsx`](../app/src/components/administration/) | Tuiles hub, formulaires, modales utilisateurs |

## Données

- **Rôle métier** : collection **`metierroles`** ; champs `slug` (immuable après création), `label`, `baseRoleSlugs[]` (références aux slugs **`roles.slug`**). Le slug initial est dérivé du nom à la création ; il ne doit pas entrer en collision avec un document **`Role`** ni **`MetierRole`** existant.
- **Utilisateur** : voir [authentification-et-roles.md](./authentification-et-roles.md). Mot de passe hashé avec **bcrypt** (comme la connexion). Le champ legacy **`role`** est mis à **`admin`** si les slugs de base effectifs incluent **`admin`**, sinon **`user`**.

## Garde-fous métier (rôles métier)

- Le slug **`plateforme_admin`** (bootstrap `init:admin`) **ne peut pas être supprimé** depuis l’UI ni via l’action serveur (erreur explicite).
- La **suppression** d’un rôle métier retire ce slug des **`metierRoleSlugs`** des utilisateurs et des listes **`MenuVisibilityConfig.byTile`** ; une ligne de matrice qui ne contiendrait plus aucun métier est retirée du document (mode strict : pas de visibilité pour cette tuile).

## Garde-fous métier (utilisateurs)

- Impossible de **supprimer son propre compte**.
- Impossible de **supprimer** ou de **retirer le rôle admin** au **dernier** compte disposant du slug de base **`admin`** dans ses slugs effectifs (voir `effectiveBaseRoleSlugsForUser`).

## Matrice visibilité des menus

Pour restreindre **l’affichage** des tuiles par **rôle métier**, voir **[matrice-visibilite-menus.md](./matrice-visibilite-menus.md)** (checklist : ajout au registre [`tiles.ts`](../app/src/lib/menuVisibility/tiles.ts) + `resolveNavTileVisible` pour chaque nouvelle entrée pilotée).

## Voir aussi

- [Gestion des salles (référentiel)](./creation-gestion-salles.md)
- [Matrice visibilité des menus](./matrice-visibilite-menus.md)
- [Authentification et rôles](./authentification-et-roles.md)
- [Connexion et démarrage](./connexion-et-demarrage.md)
