# Authentification et rôles — contexte développement (dépôt gestionedt)

Ce document décrit **l’implémentation concrète** dans ce dépôt. Pour un patron réutilisable dans d’autres projets, voir [boilerplate-contexte-connexion.md](./boilerplate-contexte-connexion.md).

## Stack

- **Next.js** (App Router), sous-dossier [`app/`](../app/), sources dans `app/src/`.
- **Auth.js / NextAuth v5** (`next-auth@beta`) avec stratégie de session **JWT** et fournisseur **Credentials** (e-mail + mot de passe).
- **MongoDB** via **Mongoose** ; variable `MONGODB_URI`.

## Fichiers clés

| Fichier | Rôle |
|--------|------|
| [`app/src/lib/auth.ts`](../app/src/lib/auth.ts) | Configuration NextAuth : `handlers`, `auth`, `signIn`, `signOut`, `authorize`, callbacks JWT/session. |
| [`app/src/app/api/auth/[...nextauth]/route.ts`](../app/src/app/api/auth/[...nextauth]/route.ts) | Route `/api/auth/*`. |
| [`app/src/lib/mongodb.ts`](../app/src/lib/mongodb.ts) | `connectDB()` avec cache global. |
| [`app/src/lib/models/User.ts`](../app/src/lib/models/User.ts) | Utilisateur : `email`, `passwordHash` (`select: false`), `name`, `role` (legacy), **`roleSlugs`** (rôles de base directs), **`metierRoleSlugs`** (rôles métier ; expansion en base), **mix des deux autorisé**. |
| [`app/src/lib/models/Role.ts`](../app/src/lib/models/Role.ts) | Rôle **de base** : `slug`, `label`, `permissions[]`. |
| [`app/src/lib/models/MetierRole.ts`](../app/src/lib/models/MetierRole.ts) | Rôle **métier** (agrégat) : `slug`, `label`, `baseRoleSlugs[]` (références `Role.slug`). |
| [`app/src/lib/permissions/keys.ts`](../app/src/lib/permissions/keys.ts) | Constantes de permissions + `ROUTE_MATRIX_ROWS` (documentation des routes protégées). |
| [`app/src/lib/permissions/resolveForUser.ts`](../app/src/lib/permissions/resolveForUser.ts) | `roleSlugsForUser` (base directe seule), `metierRoleSlugsForUser`, **`effectiveBaseRoleSlugsForUser`** (base directe ∪ expansion métier), résolution des permissions. |
| [`app/src/lib/authz.ts`](../app/src/lib/authz.ts) | Permissions : `sessionHasAnyPermission`, `liveSessionHasAnyPermission`. **Rôles (slugs)** : `sessionRoleSlugs`, `sessionHasAnyRoleSlug`, `liveSessionRoleSlugs`, `liveSessionHasAnyRoleSlug` ; **`liveMetierRoleSlugs`** (slugs `MetierRole` en base) ; administrateur : `sessionIsAdministrator`, `liveSessionIsAdministrator`. |
| [`app/src/types/next-auth.d.ts`](../app/src/types/next-auth.d.ts) | Extension TypeScript de `Session` / `JWT`. |
| [`app/src/components/AuthSessionProvider.tsx`](../app/src/components/AuthSessionProvider.tsx) | `SessionProvider` client. |
| [`app/src/app/connexion/page.tsx`](../app/src/app/connexion/page.tsx) | Page de connexion ; redirige si déjà authentifié. |
| [`app/src/app/accueil/layout.tsx`](../app/src/app/accueil/layout.tsx) | Garde : session + `liveSessionHasAnyPermission` pour `feature.accueil.access`. |
| [`app/src/app/admin-demo/layout.tsx`](../app/src/app/admin-demo/layout.tsx) | Garde : `feature.admin.demo`. |
| [`app/src/app/administration/layout.tsx`](../app/src/app/administration/layout.tsx) | Garde : union `feature.administration.access`, `feature.administration.roles_metier`, `feature.administration.utilisateurs`. |
| [`app/src/app/administration/_actions/`](../app/src/app/administration/_actions/) | Actions serveur : création `MetierRole`, CRUD `User` (bcrypt, rôles). |
| [Documentation hub Administration](./administration-hub.md) | Routes `/administration`, permissions, garde-fous. |
| [`app/scripts/init/`](../app/scripts/init/) | `load-env.ts`, `seed-roles.ts`, `seed-metier-roles.ts`, `migrate-user-role-slugs.ts`, `migrate-renommage-formation.ts`, `create-admin.ts`. |

## Plusieurs rôles par utilisateur

### Rôles de base et rôles métier

- **Rôle de base** : document Mongo dans la collection **`roles`** (`Role`). Le champ **`users.roleSlugs`** liste des slugs **directement** attribués (`Role.slug`), en plus du repli sur le champ legacy **`role`** si `roleSlugs` est vide (voir [`roleSlugsForUser`](../app/src/lib/permissions/resolveForUser.ts)).
- **Rôle métier** : document dans **`metierroles`** (`MetierRole`). Le champ **`users.metierRoleSlugs`** liste des slugs métier ; chaque document métier définit **`baseRoleSlugs`**, qui s’**expand** en plusieurs slugs de base avant de charger les permissions.

**Mix** : un même utilisateur peut avoir en parallèle des entrées dans **`roleSlugs`** (base directe) **et** dans **`metierRoleSlugs`**. Les permissions effectives sont l’union des **`Role.permissions`** pour tous les slugs de base **effectifs** :

`effectiveBaseRoleSlugs` = dédoublonnage normalisé de `(roleSlugs directs ∪ ⋃ expansion(metierRoleSlugs))`.

Voir [`effectiveBaseRoleSlugsForUser`](../app/src/lib/permissions/resolveForUser.ts).

Pour les gardes **par permission**, utiliser `liveSessionHasAnyPermission` / `sessionHasAnyPermission`. Pour une règle du type « au moins un des **rôles de base** A ou B », utiliser [`sessionHasAnyRoleSlug` / `liveSessionHasAnyRoleSlug`](../app/src/lib/authz.ts) : la session expose **`roleSlugs` comme liste de slugs de base effectifs** (après expansion métier au login). Les slugs **métier** attribués tels quels sont dans **`session.user.metierRoleSlugs`** (JWT), pour l’UI ou l’audit.

**Convention** : ne pas mettre un slug **`MetierRole.slug`** dans **`users.roleSlugs`** : il ne correspond pas à un document `Role` et ne serait pas trouvé par `Role.find`. Réservé à **`users.metierRoleSlugs`**.

### Hub Administration (UI)

Depuis **`/accueil`**, une tuile ouvre le hub **`/administration`** (rôles métier : liste, création, modification ; gestion des utilisateurs et mots de passe ; matrice de visibilité des menus). Détail des permissions et fichiers : **[administration-hub.md](./administration-hub.md)**. **Affichage des tuiles** : **[matrice-visibilite-menus.md](./matrice-visibilite-menus.md)** (filtre optionnel par rôle métier, les routes restent protégées par `feature.*`).

### Rôles de base seed (paquets de permissions)

Le script [`seed-roles.ts`](../app/scripts/init/seed-roles.ts) crée notamment les documents **`Role`** suivants (slug Mongo) et leurs permissions associées dans [`keys.ts`](../app/src/lib/permissions/keys.ts) :

| Slug | Permission |
|------|------------|
| `coordinateur_formation` | `feature.coordinateur_formation` |
| `création_classe` | `feature.creation.classe` |
| `création_éléve` | `feature.creation.eleve` |
| `création_professeur` | `feature.creation.professeur` |
| `création_matière` | `feature.creation.matiere` |
| `création_formation` | `feature.creation.formation` |
| `création_salle` | `feature.creation.salle` |

Le rôle **`admin`** reçoit l’union de **toutes** les clés `ALL_APP_PERMISSION_KEYS` (incluant les permissions du hub Administration après ajout dans [`keys.ts`](../app/src/lib/permissions/keys.ts)). Le rôle **`user`** du seed reçoit **les mêmes clés sauf** `feature.admin.demo` : un compte avec **`roleSlugs` vide** et **`role: "user"`** (défaut du schéma) se voit donc **à peu près** les mêmes droits applicatifs que « utilisateur générique », pas un compte vide de permissions — voir aussi la FAQ dans [matrice-visibilite-menus.md](./matrice-visibilite-menus.md). Le compte **[`init:admin`](../app/scripts/init/create-admin.ts)** fixe `roleSlugs` à **`ALL_ADMIN_ACCOUNT_ROLE_SLUGS`** (cumul des slugs **de base** : `admin`, `user` et ceux du tableau ci-dessus), **`metierRoleSlugs`** à `[]`, et `role` à `admin`. Ainsi l’admin a tous les slugs de base listés explicitement. Pour d’autres comptes : éditer **`users.roleSlugs`**, **`users.metierRoleSlugs`**, ou les deux (mix). Réexécuter `init:admin` met à jour le document pour l’e-mail configuré.

**Exemple de rôle métier** : après `npm run init:metier-roles`, un document **`MetierRole`** `coordo_pedago` regroupe plusieurs **`baseRoleSlugs`** (voir [`seed-metier-roles.ts`](../app/scripts/init/seed-metier-roles.ts)). Un utilisateur peut n’avoir que `metierRoleSlugs: ["coordo_pedago"]`, ou ajouter en plus des entrées dans `roleSlugs` pour d’autres rôles de base.

## Flux de connexion

1. L’utilisateur soumet le formulaire client [`ConnexionForm.tsx`](../app/src/components/connexion/ConnexionForm.tsx) (`signIn` avec `redirect: false`).
2. NextAuth appelle `authorize` : chargement du `User` avec `+passwordHash`, **bcrypt.compare**.
3. Si succès, **`effectiveBaseRoleSlugsForUser`** calcule les slugs **de base** effectifs ( **`roleSlugs`** directs **∪** expansion des **`metierRoleSlugs`** ) ; **`resolvePermissionsForUserDoc`** charge les documents **`Role`** correspondants et calcule l’**union** des `permissions`.
4. Les callbacks copient `id`, `role`, **`roleSlugs`** (liste **effective** de base, pour les garde-fous par slug), **`metierRoleSlugs`** (attributions métier telles quelles), et `permissions` dans le **JWT** puis la **session** côté client.

## JWT figé vs permissions « live »

- **`session.user.permissions`** reflète l’union des droits **au moment du login**.
- Les **layouts** sensibles (ex. [`accueil/layout.tsx`](../app/src/app/accueil/layout.tsx)) utilisent **`liveSessionHasAnyPermission`**, qui **relit MongoDB** via `resolvePermissionsForUserById` pour refléter un changement de rôle sans imposer systématiquement une reconnexion.
- Pour afficher des libellés issus uniquement du JWT, utiliser **`sessionHasAnyPermission`**.

## Variables d’environnement

Par défaut, Next ne lit les `.env*` que dans **`app/`**. Ce dépôt charge aussi **`.env.local` à la racine du dépôt** (puis **`app/.env.local`**, qui prévaut pour une même clé) au démarrage via [`app/next.config.ts`](../app/next.config.ts), pour rester aligné avec la convention décrite dans les règles du projet.

En production, **`AUTH_SECRET`** (ou `NEXTAUTH_SECRET`) est **obligatoire**. Pendant `next build`, Next exécute du code avec `NODE_ENV=production` sans secret : `auth.ts` utilise un secret factice **uniquement** lorsque `NEXT_PHASE` vaut `phase-production-build`, afin de ne pas casser la compilation. En **runtime** production (`next start`), un secret réel est requis.

Si le log indique encore « AUTH_SECRET absent » en dev : vérifiez que la variable est bien **renseignée** (pas une ligne vide) dans l’un des deux `.env.local`.

## Scripts

Exécutés depuis **`app/`** : `npm run init:roles`, `npm run init:metier-roles` (optionnel, exemple de rôle métier), `npm run migrate:role-slugs`, `npm run init:admin`. Voir [connexion-et-demarrage.md](./connexion-et-demarrage.md).

## UI connexion

Composants sous `app/src/components/connexion/` : fond [`ConnexionBackdrop.tsx`](../app/src/components/connexion/ConnexionBackdrop.tsx), structure [`ConnexionShell.tsx`](../app/src/components/connexion/ConnexionShell.tsx), carte [`ConnexionFormCard.tsx`](../app/src/components/connexion/ConnexionFormCard.tsx). Tokens décrits dans l’inspiration [`inspiration/connexion-design.md`](../inspiration/connexion-design.md) (implémentation réécrite ici).

## Évolutions

- Ajouter une permission : constante dans `keys.ts`, mettre à jour `ROUTE_MATRIX_ROWS`, **seed** ou mise à jour manuelle de `roles.permissions`, garde dans un **`layout.tsx`**, puis documentation.
