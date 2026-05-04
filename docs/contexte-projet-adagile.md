# Contexte projet AdAgile (gestionedt)

Document **cartographie** pour accélérer le travail sur le dépôt : structure, flux techniques, données MongoDB et liens vers la documentation détaillée. À lire en complément des règles Cursor [`.cursor/rules/projet-gestionedt.mdc`](../.cursor/rules/projet-gestionedt.mdc).

---

## 1. Nom et périmètre fonctionnel

- **Produit / base MongoDB** : AdAgile — organisation d’un **planning enseignant** (référentiels professeurs, matières, salles, formations = blocs de matières avec heures et intervenants).
- **Code applicatif** : dossier **`app/`** uniquement (Next.js App Router, TypeScript). La racine du dépôt contient surtout la doc, la config workspace et les exemples d’environnement.

---

## 2. Arborescence utile

| Emplacement | Contenu |
|-------------|---------|
| [`app/`](../app/) | Application Next.js (`package.json`, `next.config.ts`, `src/`) |
| [`app/src/app/`](../app/src/app/) | Routes App Router (`page.tsx`, `layout.tsx`, API) |
| [`app/src/components/`](../app/src/components/) | Composants React (dont `administration/`, `connexion/`, `layout/`) |
| [`app/src/lib/`](../app/src/lib/) | Auth, MongoDB, modèles Mongoose, permissions, visibilité menus |
| [`app/scripts/init/`](../app/scripts/init/) | Seeds et migrations CLI (`tsx`) |
| [`docs/`](./) | Documentation utilisateur et développement |

Les **modales** d’administration sont volontairement **un fichier par modale** sous `app/src/components/administration/` (convention projet).

---

## 3. Stack (référence)

Déclaré dans [`app/package.json`](../app/package.json) : **Next.js 16**, **React 19**, **NextAuth v5 (beta)** avec stratégie **JWT**, **Mongoose 9**, **Tailwind 4**, **TypeScript 5**, **bcryptjs**, **tsx** pour les scripts.

**Note Next.js** : le fichier [`app/AGENTS.md`](../app/AGENTS.md) rappelle que les conventions peuvent différer des versions antérieures ; en cas de doute, se référer à la doc embarquée dans `node_modules/next/dist/docs/`.

---

## 4. Environnement et chargement des `.env`

- **`MONGODB_URI`** : obligatoire pour l’app et les scripts.
- **`AUTH_SECRET`** (ou `NEXTAUTH_SECRET`) : obligatoire en production ; dev peut tolérer un secret de secours avec avertissement (voir [`app/src/lib/auth.ts`](../app/src/lib/auth.ts)).
- **`AUTH_URL`** : URL publique de l’app (ex. `http://localhost:3000`).

**Ordre de chargement** (variables déjà définies dans le shell ne sont pas écrasées par les fichiers dans cet ordre pour les scripts) :

1. `.env.local` à la **racine du dépôt**
2. `app/.env.local` (peut compléter ; selon le contexte Next, la config peut aussi prioriser `app/` — voir [`app/next.config.ts`](../app/next.config.ts) qui charge racine puis `app/` avec override sur le second fichier pour le bundler)

Les scripts utilisent [`app/scripts/init/load-env.ts`](../app/scripts/init/load-env.ts). Détail utilisateur : [connexion-et-demarrage.md](./connexion-et-demarrage.md).

---

## 5. Routes principales (App Router)

| Chemin | Rôle |
|--------|------|
| `/` | Redirection connexion / accueil selon session |
| `/connexion` | Connexion credentials |
| `/accueil` | Hub post-login ; garde `feature.accueil.access` ([`accueil/layout.tsx`](../app/src/app/accueil/layout.tsx)) |
| `/admin-demo` | Page démo ; permission `feature.admin.demo` |
| `/administration` | Hub administration ; layout : union `ADMIN_SEGMENT_PERMISSIONS` ([`administration/layout.tsx`](../app/src/app/administration/layout.tsx)) |
| `/administration/utilisateurs` | CRUD utilisateurs |
| `/administration/roles-metier` | Liste rôles métier ; `/nouveau`, `/[slug]/modifier` |
| `/administration/matricemenu` | Matrice visibilité tuiles × rôle métier |
| `/administration/creation-classe` | Création classe |
| `/administration/creation-professeur` | Référentiel professeurs |
| `/administration/creation-matiere` | Référentiel matières |
| `/administration/creation-formation` | Formations (blocs matières / heures / intervenants) |
| `/administration/creation-salle` | Référentiel salles |
| `POST/GET …` [`app/src/app/api/auth/[...nextauth]/route.ts`](../app/src/app/api/auth/[...nextauth]/route.ts) | Handler NextAuth |

**Redirect permanent** : `/administration/creation-contenu-pedagogique` → `/administration/creation-formation` ([`next.config.ts`](../app/next.config.ts)).

---

## 6. Authentification et session

- **Provider** : Credentials ; hash **bcrypt** ; utilisateur lu dans Mongo ([`User`](../app/src/lib/models/User.ts)).
- **Session** : JWT ; le callback enrichit `roleSlugs`, `metierRoleSlugs`, `permissions` au login ([`auth.ts`](../app/src/lib/auth.ts)).
- **Résolution des permissions** : [`app/src/lib/permissions/resolveForUser.ts`](../app/src/lib/permissions/resolveForUser.ts) — union des rôles **de base** (`Role`) issus de `roleSlugs` et de l’expansion des **`MetierRole.baseRoleSlugs`**.
- **Autorisations côté serveur** : [`app/src/lib/authz.ts`](../app/src/lib/authz.ts) — fonctions `sessionHas*` (JWT) vs `liveSession*` (relecture Mongo pour refléter les changements de rôles sans déconnexion).

Typage session : [`app/src/types/next-auth.d.ts`](../app/src/types/next-auth.d.ts).

Documentation détaillée : [authentification-et-roles.md](./authentification-et-roles.md), [boilerplate-contexte-connexion.md](./boilerplate-contexte-connexion.md).

---

## 7. Permissions et clés

- **Source de vérité des chaînes** : [`app/src/lib/permissions/keys.ts`](../app/src/lib/permissions/keys.ts) (`PERMISSION_*`, slugs de rôles, `ADMIN_SEGMENT_PERMISSIONS`, `ALL_APP_PERMISSION_KEYS`, `ROUTE_MATRIX_ROWS`).
- **Entrée `/administration/*`** : au moins **une** permission parmi `ADMIN_SEGMENT_PERMISSIONS` (layout).
- **Affichage des tuiles** (accueil / hub admin) : permissions **et** [matrice de visibilité](./matrice-visibilite-menus.md) (`MenuVisibilityConfig.byTile` + registre [`tiles.ts`](../app/src/lib/menuVisibility/tiles.ts), résolution [`resolveNavTileVisible.ts`](../app/src/lib/menuVisibility/resolveNavTileVisible.ts)).

Après ajout de clés dans `keys.ts`, réexécuter **`npm run init:roles`** depuis `app/` pour réinjecter les permissions sur le rôle seed `admin`.

---

## 8. MongoDB — connexion et modèles

- Connexion singleton / cache : [`app/src/lib/mongodb.ts`](../app/src/lib/mongodb.ts) (`connectDB()`).

Collections **logiques** (noms Mongoose par défaut sauf mention) :

| Modèle | Fichier | Notes |
|--------|---------|--------|
| `User` | [`models/User.ts`](../app/src/lib/models/User.ts) | `passwordHash` (select false), `roleSlugs`, `metierRoleSlugs`, champ legacy `role` (`admin` \| `user`) |
| `Role` | [`models/Role.ts`](../app/src/lib/models/Role.ts) | `slug`, `label`, `permissions[]` |
| `MetierRole` | [`models/MetierRole.ts`](../app/src/lib/models/MetierRole.ts) | `slug`, `baseRoleSlugs[]` |
| `MenuVisibilityConfig` | [`models/MenuVisibilityConfig.ts`](../app/src/lib/models/MenuVisibilityConfig.ts) | Singleton `singletonKey: global` ; `byTile` : id tuile → slugs métier |
| `Professeur` | [`models/Professeur.ts`](../app/src/lib/models/Professeur.ts) | Contraintes / matières (voir doc professeurs) |
| `Matiere` | [`models/Matiere.ts`](../app/src/lib/models/Matiere.ts) | Liens salles éventuels |
| `Salle` | [`models/Salle.ts`](../app/src/lib/models/Salle.ts) | |
| `Formation` | [`models/Formation.ts`](../app/src/lib/models/Formation.ts) | **Collection Mongo conservée** : `contenupedagogiques` ; lignes `matiereId` + `professeurIds` + `nombreHeuresPrevues` |

---

## 9. Server Actions administration

Fichiers sous [`app/src/app/administration/_actions/`](../app/src/app/administration/_actions/) :

- `users.ts`, `metierRoles.ts`, `professeurs.ts`, `matieres.ts`, `formation.ts`, `salles.ts`

Chaque domaine métier est généralement couvert par une page sous `creation-*` ou `utilisateurs` / `roles-metier` / `matricemenu`.

---

## 10. Scripts npm et migrations manuelles

Commandes définies dans **`app/package.json`** :

| Script | Effet |
|--------|--------|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run init:roles` | Seed collection `roles` |
| `npm run init:metier-roles` | Seed exemple `metierroles` |
| `npm run migrate:role-slugs` | Initialise `roleSlugs` depuis `role` legacy |
| `npm run init:admin` | Compte admin + rôle métier `plateforme_admin` ; matrice vide → pré-remplissage |

**Scripts non aliasés** (lancer depuis `app/` avec `npx tsx …`) :

| Fichier | Rôle |
|---------|------|
| [`migrate-renommage-formation.ts`](../app/scripts/init/migrate-renommage-formation.ts) | Données existantes : renommage contenu pédagogique → formation (roles, users, matrice) |
| [`migrate-contenu-pedagogique-groupement.ts`](../app/scripts/init/migrate-contenu-pedagogique-groupement.ts) | Schéma `Formation` : normalisation vers tableau `lignes` |

---

## 11. Configuration Next notable

[`app/next.config.ts`](../app/next.config.ts) :

- **`turbopack.root`** : répertoire `app/` pour ancrer Turbopack si un lockfile existe au-dessus.
- Chargement explicit des `.env.local` racine puis `app/`.
- **Redirect** ancienne route formation / contenu pédagogique.

---

## 12. Conventions UI et projet

- **KISS**, fichiers **par responsabilité**, réponses et doc utilisateur en **français**.
- Préférence projet pour les layouts en **`vh` / `vw`** sur les écrans principaux (vérifier les composants existants avant d’introduire d’autres unités).
- **Ne pas supprimer** une fonctionnalité sans accord explicite du demandeur.

---

## 13. Index de la documentation (`docs/`)

| Fichier | Contenu |
|---------|---------|
| [connexion-et-demarrage.md](./connexion-et-demarrage.md) | Prérequis, `.env`, ordre `init`, lancement |
| [authentification-et-roles.md](./authentification-et-roles.md) | Modèle de rôles, JWT, garde-fous |
| [administration-hub.md](./administration-hub.md) | Hub `/administration`, tableau des permissions, fichiers |
| [matrice-visibilite-menus.md](./matrice-visibilite-menus.md) | Tuiles × métier, checklist nouvelle tuile |
| [creation-gestion-professeurs.md](./creation-gestion-professeurs.md) | Référentiel professeurs |
| [creation-gestion-matieres.md](./creation-gestion-matieres.md) | Référentiel matières |
| [creation-formation.md](./creation-formation.md) | Formations (ex-contenu pédagogique) |
| [creation-gestion-salles.md](./creation-gestion-salles.md) | Salles |
| [boilerplate-contexte-connexion.md](./boilerplate-contexte-connexion.md) | Patron portable auth (autres projets) |

---

## 14. Maintenance de ce document

Lors d’un **nouveau domaine métier** (route, permission, tuile matrice, collection Mongo), mettre à jour :

1. [`keys.ts`](../app/src/lib/permissions/keys.ts) et éventuellement `ROUTE_MATRIX_ROWS`
2. [`tiles.ts`](../app/src/lib/menuVisibility/tiles.ts) + doc [matrice-visibilite-menus.md](./matrice-visibilite-menus.md)
3. **Ce fichier** (sections 5, 7–8, 10) pour garder une carte à jour pour les agents et les développeurs.
