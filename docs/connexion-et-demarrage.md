# Connexion et démarrage — guide utilisateur

## Objectif

Accéder à l’application **AdAgile** (projet dans le dossier [`app/`](../app/)) après configuration de la base MongoDB et des scripts d’initialisation.

## Prérequis

- **Node.js** (version compatible avec Next.js 16, voir le `package.json` du dossier `app/`).
- Une instance **MongoDB** accessible (locale ou distante).
- Fichier d’environnement : copier [`.env.local.example`](../.env.local.example) vers **`.env.local`** à la racine du dépôt **et/ou** `app/.env.local`, puis renseigner au minimum :
  - `MONGODB_URI`
  - `AUTH_SECRET` (obligatoire hors développement ; en local, générer avec `openssl rand -base64 32`)
  - `AUTH_URL` (ex. `http://localhost:3000`)

Les scripts CLI (`init:roles`, etc.) chargent d’abord `.env.local` à la racine du dépôt, puis `app/.env.local`, **sans écraser** une variable déjà définie.

## Initialiser les rôles et un administrateur

Dans le dossier **`app/`** :

```bash
npm install
npm run init:roles
npm run init:metier-roles
npm run migrate:role-slugs
npm run init:admin
```

Ordre recommandé pour une base neuve :

1. `init:roles` — crée ou met à jour les documents dans la collection Mongo **`roles`** (rôles de base) avec les permissions par défaut. **Après une mise à jour du code** ajoutant des clés dans [`keys.ts`](../app/src/lib/permissions/keys.ts) (ex. hub Administration), réexécutez cette commande pour réinjecter `ALL_APP_PERMISSION_KEYS` sur le rôle **`admin`**.
2. `init:metier-roles` — optionnel ; crée ou met à jour un **exemple** de document dans **`metierroles`** (`coordo_pedago` et ses `baseRoleSlugs`). Exécuter après `init:roles` pour que les slugs référencés existent.
3. `migrate:role-slugs` — si des utilisateurs n’ont pas encore de `roleSlugs`, ils sont initialisés à partir du champ **`role`** (un seul slug). Pour **plusieurs rôles de base** ou des **rôles métier**, complétez **`roleSlugs`** et/ou **`metierRoleSlugs`** dans Mongo (ou via un outil dédié).
4. `init:admin` — crée ou met à jour le compte administrateur ; assure aussi un **rôle métier bootstrap** `plateforme_admin` (base `admin`). Si la collection **`menuvisibilityconfigs`** n’a pas encore de grille utile (`byTile` absent ou sans aucune liste non vide), le script remplit **chaque tuile du registre** avec `plateforme_admin` uniquement, pour que le premier admin voie les menus (dont le hub Administration et la page matrice) sans être bloqué par le mode strict de la matrice. Une matrice déjà renseignée n’est **pas** écrasée.

Par défaut, `init:admin` utilise l’e-mail **`admin@localhost`** et le mot de passe **`admin`**. Vous pouvez surcharger avec `INIT_ADMIN_EMAIL` et `INIT_ADMIN_PASSWORD`. **En production**, utilisez un mot de passe fort et des variables d’environnement, pas les valeurs par défaut.

## Lancer l’application

Toujours depuis **`app/`** :

```bash
npm run dev
```

Puis ouvrir l’URL indiquée (souvent `http://localhost:3000`).

## Se connecter

1. Aller sur **`/connexion`** (la page d’accueil `/` redirige vers la connexion si vous n’êtes pas connecté).
2. Saisir l’e-mail et le mot de passe.
3. En cas d’échec, un message générique s’affiche : l’application ne révèle pas si l’adresse existe ou non.
4. Après succès, redirection vers **`/accueil`**.

## Parcours selon les droits

- **Accueil** (`/accueil`) : nécessite d’être connecté **et** d’avoir la permission `feature.accueil.access` dans MongoDB (via les rôles). Sans cette permission, un message « Accès refusé » s’affiche.
- **Page démo admin** (`/admin-demo`) : réservée aux comptes dont le rôle Mongo inclut la permission `feature.admin.demo` (le rôle seed **`admin`** l’a, le rôle **`user`** non).
- **Hub Administration** (`/administration`) : tuile sur `/accueil` si vous avez au moins une des permissions décrites dans [administration-hub.md](./administration-hub.md) ; après `init:roles` à jour, le compte **`init:admin`** y a accès.

## Déconnexion

Sur l’accueil (ou la page démo), utiliser le bouton **Déconnexion**.

## Limitations du périmètre actuel

- Pas d’OAuth, pas de page d’inscription, pas de réinitialisation de mot de passe par e-mail depuis l’UI.
- Pas de middleware Edge global : les protections sont assurées dans les **layouts** et pages serveur.

Pour le détail technique (NextAuth, JWT, modèles), voir [authentification-et-roles.md](./authentification-et-roles.md) et le document portable [boilerplate-contexte-connexion.md](./boilerplate-contexte-connexion.md).
