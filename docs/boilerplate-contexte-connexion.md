# Boilerplate — contexte connexion, NextAuth et rôles MongoDB

Document **portable** : vous pouvez le coller dans une règle Cursor, un wiki interne ou un prompt pour recréer le même patron dans un autre dépôt Next.js. Il est aligné sur l’implémentation de référence dans **gestionedt** (`app/src/`), sans dépendre d’un métier précis.

## Problème résolu

- Page **`/connexion`** (e-mail + mot de passe) branchée sur **MongoDB**.
- **NextAuth (Auth.js v5)** en **JWT**, fournisseur **Credentials**.
- **Rôles de base** : collection **`roles`** (`Role`) — `slug`, `label`, `permissions[]`.
- **Rôles métier (agrégats)** : collection séparée, p.ex. **`metierroles`** (`MetierRole`) — `slug`, `label`, **`baseRoleSlugs[]`** (références vers `roles.slug`), pour **composer** plusieurs rôles de base comme sur un modèle type « privilèges → rôle composé → attribution » (ex. inspiration vCenter).
- **Utilisateur** : **`roleSlugs[]`** = attribution **directe** de rôles de base ; **`metierRoleSlugs[]`** = attribution de rôles métier (**mix des deux autorisé**). Les permissions se calculent à partir des **slugs de base effectifs** (directs **∪** expansion des métiers). Le champ legacy **`role`** (`admin` | `user`) sert de **repli** quand `roleSlugs` est vide après normalisation.
- **Permissions** : chaînes stables (ex. `feature.accueil.access`) ; **union** des `permissions[]` des documents **`Role`** dont le `slug` figure parmi les **slugs de base effectifs**.
- **Gardes de routes** : dans des **`layout.tsx`** (ou pages) **serveur** avec `auth()` ; pas de dépendance à un **middleware Edge** qui importerait Mongoose ou bcrypt.

## Prérequis projet

- Next.js **App Router**, TypeScript, Tailwind (optionnel mais utile pour une UI type « Aurora glass »).
- Paquets : `next-auth@beta` (v5), `mongoose`, `bcryptjs`.
- Variables : `MONGODB_URI`, `AUTH_SECRET` (runtime production), `AUTH_URL`.

## Modèle de données MongoDB

### Collection `users`

- `email` (unique, normalisé minuscules).
- `passwordHash` (bcrypt ; **jamais** exposé au client — `select: false`, lecture explicite `+passwordHash` uniquement dans `authorize`).
- `name` (optionnel).
- `role` : `admin` | `user` (legacy ; défaut `user`) — **repli** si `roleSlugs` est vide après normalisation ; l’**union des droits** repose sur les documents **`roles`** et sur les **slugs de base effectifs** (voir ci-dessous).
- **`roleSlugs`** : `string[]` — slugs **`Role`** attribués **directement** (références `roles.slug`).
- **`metierRoleSlugs`** : `string[]` — slugs **`MetierRole`** ; chaque fiche métier porte une liste **`baseRoleSlugs`** qui s’**expand** en plusieurs slugs de base avant résolution des permissions.

**Comportement (rôles de base directs)** : si `roleSlugs` est **non vide** après normalisation (trim, minuscules, dédoublonnage), cette liste contribue aux slugs de base **directs**. Sinon, repli sur **`[role]`** (un seul slug implicite, p.ex. `user` ou `admin`).

**Comportement (expansion métier)** : pour chaque slug dans `metierRoleSlugs`, charger le document **`MetierRole`** correspondant et **fusionner** tous les `baseRoleSlugs` (normalisés, dédoublonnés) avec les slugs directs.

**Slugs de base effectifs** : ensemble dédoublonné normalisé des slugs **directs** **∪** l’union des **`baseRoleSlugs`** de tous les métiers assignés (`effectiveBaseRoleSlugs` dans le code de référence). C’est cette liste qui alimente **`Role.find({ slug: { $in } })`** et donc l’union des **permissions**.

Il doit exister **un document `roles` par slug de base** présent dans cette liste effective ; sinon l’union des permissions sera **incomplète** pour ce slug.

**Convention** : ne pas placer un **`MetierRole.slug`** dans **`users.roleSlugs`** — ce n’est pas un `Role.slug` et ne sera pas trouvé par `Role.find`. Réserver les slugs métier à **`users.metierRoleSlugs`**.

### Plusieurs rôles par utilisateur

- **Mix** : un utilisateur peut cumuler **`roleSlugs`** (base directe) et **`metierRoleSlugs`** (paquets de bases) en même temps, p.ex. `roleSlugs: ["user", "création_matière"]` et `metierRoleSlugs: ["coordo_pedago"]`.
- Les **permissions effectives** sont l’**union** (sans doublon) des `permissions[]` des documents **`Role`** pour tous les slugs de **base** **effectifs** ; l’ordre dans les tableaux **n’a pas de sémantique**.
- Pour une **garde métier**, préférer **`liveSessionHasAnyPermission`** sur des **clés `feature.*`** plutôt que de tester des slugs, sauf si la règle est explicitement « appartenir au **rôle de base** X » (helpers **`sessionHasAnyRoleSlug`** / **`liveSessionHasAnyRoleSlug`** — ils s’appuient sur la liste **effective** exposée en session, voir § Cœur auth).
- Le champ **`role`** legacy reste **scalaire** ; en pratique on peut maintenir `roleSlugs` / `metierRoleSlugs` comme sources d’attribution, et garder `role` pour compatibilité ou affichage grossier.

### Collection `roles` (rôles de base)

Pour chaque **`slug`** présent dans les **slugs de base effectifs** d’un utilisateur, un document doit exister dans **`roles`**, sinon l’union des permissions sera **incomplète**.

- `slug` (unique, minuscules).
- `label` (affichage).
- `permissions` : liste de clés métier (`feature.*`, etc.).

### Collection `metierroles` (rôles métier agrégés)

- `slug` (unique, minuscules).
- `label` (affichage).
- **`baseRoleSlugs`** : liste de **`roles.slug`** à inclure pour tout utilisateur qui porte ce slug dans **`users.metierRoleSlugs`**.

### Amorçage

1. **Seed** des rôles de base (`admin`, `user`, éventuellement des rôles fins) avec des jeux de `permissions` cohérents.
2. **Seed optionnel** des rôles métier : après les **`roles`**, pour que chaque `baseRoleSlugs` référence des slugs existants.
3. **Migration** éventuelle : copier `role` → `roleSlugs` si le tableau est vide (`metierRoleSlugs` peut rester `[]`).
4. **Compte admin** outillage (script idempotent ; p.ex. liste explicite de tous les slugs de base sur `roleSlugs`, `metierRoleSlugs: []` si on veut du KISS côté premier compte).

## Cœur auth (NextAuth)

1. **Provider Credentials** : valider e-mail / mot de passe contre `users`, bcrypt.
2. Après succès : calculer les **`effectiveBaseRoleSlugs`** (directs depuis `roleSlugs` + repli legacy, **∪** expansion des **`metierRoleSlugs`** via **`MetierRole`**), puis requête du type `Role.find({ slug: { $in: effectiveBaseRoleSlugs } })`, **union** triée des `permissions`.
3. Retourner un objet utilisateur avec `id`, `email`, `name`, `role`, **`roleSlugs`** = **liste effective de slugs de base** (après expansion métier ; utile pour les garde-fous « au moins un slug de base X »), **`metierRoleSlugs`** = attributions métier **telles qu’en base** (pour UI / audit), et `permissions`.
4. **Callbacks** :
   - **jwt** : au premier tour (`user` présent), recopier `id`, `role`, `roleSlugs`, **`metierRoleSlugs`**, `permissions` dans le token.
   - **session** : exposer ces champs sous `session.user`.

**À ne pas confondre** : `session.user.metierRoleSlugs` liste les **paquets métier** attribués ; `session.user.roleSlugs` liste les **slugs `Role`** **après** expansion — pas les slugs `MetierRole`. Reconnexion nécessaire pour refléter un changement de ces tableaux dans le JWT ; les checks « live » en base peuvent rester alignés sans reconnecter si on relit Mongo dans les helpers dédiés.

## Autorisation applicative

### Deux niveaux utiles

| Besoin | Approche |
|--------|-----------|
| Affichage rapide, cohérent avec le **login** | Lire `session.user.permissions` / helpers **sans** aller en base. |
| Garde **alignée** sur Mongo à jour (changement de droits sans reconnecter) | **`liveSessionHasAnyPermission(session, keys)`** : recharge utilisateur + union des permissions. |
| Garde « au moins un **rôle de base** (slug `Role`) » | **`sessionHasAnyRoleSlug`** (JWT : `roleSlugs` = effectifs) ou **`liveSessionHasAnyRoleSlug`** (relecture + même expansion que les permissions). |
| Administrateur (slug `admin` ou `role` legacy) | **`sessionIsAdministrator`** / **`liveSessionIsAdministrator`**. |

Les gardes **métier** restent en principe basées sur des **permissions** (`feature.*`) plutôt que sur des slugs, sauf règle explicite « appartenir au **rôle de base** X ».

### Garde par slug de **rôle de base** (optionnel)

Exemple : « accès réservé aux comptes qui ont le rôle de base **formateur** ou **validateur** » (ce sont des **`Role.slug`**) : passer la liste à **`sessionHasAnyRoleSlug`** ou **`liveSessionHasAnyRoleSlug`**. Si l’accès doit suivre un **nom métier** (`MetierRole.slug`), soit tester **`session.user.metierRoleSlugs`** explicitement, soit n’utiliser que des **permissions** ou des slugs de base déjà inclus dans le paquet métier.

### Administrateur « plateforme »

Souvent : `session.user.role === "admin"` **ou** présence du slug de base `admin` dans **`session.user.roleSlugs`** (liste **effective**, donc inchangé si `admin` vient uniquement d’un rôle métier qui l’inclut dans `baseRoleSlugs`) — voir **`sessionIsAdministrator`** / **`liveSessionIsAdministrator`**. Avec un mix base + métier, le slug `admin` peut coexister avec d’autres slugs de base dans la session.

### Nouvelle permission (workflow)

1. Ajouter une **constante** de permission (une seule clé partagée entre UI et route).
2. Documenter la route dans une table type `ROUTE_MATRIX_ROWS` (même si la matrice UI n’existe pas encore).
3. Mettre à jour le **seed** des **`roles`** ou les documents Mongo pour inclure la clé sur les bons `slug`. Pour attribuer des paquets à plusieurs personnes, soit lister des **`roles.slug`** dans **`users.roleSlugs`**, soit regrouper ces slugs dans un **`MetierRole.baseRoleSlugs`** et assigner **`users.metierRoleSlugs`**, soit **mixer** les deux.
4. **Layout** du segment `app/` : `await auth()`, puis `liveSessionHasAnyPermission` (ou `sessionHasAnyPermission` si vous acceptez le JWT courant).
5. **API** / **Server Actions** sensibles : ne pas se fier au seul masquage UI — revérifier `auth()` + permission.

## UI page `/connexion`

Découper en fichiers **distincts** (maintenabilité) :

- Fond décoratif (halos statiques).
- Enveloppe (titre, sous-titre, hiérarchie typographique).
- Carte formulaire (champs contrôlés ou non, message d’erreur avec `role="alert"`).
- Composant client : **`signIn("credentials", { redirect: false })`**, erreur **générique**, `router.push` + `router.refresh()` après succès.

**Tokens visuels** (exemple Tailwind) : fond `bg-gradient-to-br from-indigo-50 via-white to-sky-50`, titre en dégradé `from-indigo-700 via-fuchsia-600 to-sky-600`, carte `rounded-2xl border border-white/60 bg-white/92`, CTA `from-indigo-500 to-fuchsia-500`.

Accessibilité : bouton **`type="submit"`**, état chargement, **pas** de message différent si l’e-mail est inconnu (anti-énumération).

## Pièges courants

- **Middleware Edge** + import de `mongoose` / `bcrypt` dans la même config que l’auth : risque d’échec ou de bundle incompatible. Préférer les **layouts serveur** jusqu’à une config auth « edge-safe » scindée.
- **`next build`** avec `NODE_ENV=production` : le module `auth` ne doit **pas** exiger `AUTH_SECRET` pendant la phase de build (secret factice **uniquement** si `NEXT_PHASE === 'phase-production-build'`), tout en **exigeant** un vrai secret au **runtime** `next start`.
- Oublier les documents **`roles`** : utilisateurs sans union de permissions.
- **`roleSlugs` / expansion métier** : chaque slug de **base** effectif doit avoir un document **`roles`** ; un **`metierRoleSlugs`** sans document **`MetierRole`** ou avec des **`baseRoleSlugs`** invalides réduit silencieusement les droits.
- **Confondre slug métier et slug de base** : mettre un **`MetierRole.slug`** dans **`users.roleSlugs`** ne charge aucun `Role` — utiliser **`users.metierRoleSlugs`**.

## Références dans ce dépôt

- Guide utilisateur : [connexion-et-demarrage.md](./connexion-et-demarrage.md).
- Détail fichiers : [authentification-et-roles.md](./authentification-et-roles.md).
- Inspiration visuelle et flux historiques : [`inspiration/`](../inspiration/) (ne pas copier le code tel quel dans d’autres contextes si votre convention impose du « neuf » ; s’en inspirer).
