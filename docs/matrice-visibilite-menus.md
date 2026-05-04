# Matrice visibilité des menus — contexte développement

Ce document décrit la **couche d’affichage** des tuiles (accueil et hub Administration), **distincte** des permissions applicatives `feature.*` utilisées pour les **gardes de routes** et les **actions serveur**.

## À retenir (nouvelle tuile ou nouveau lien menu)

**Oui :** tant que les lignes de la matrice sont dérivées du registre **`NAV_TILE_DEFINITIONS`**, **chaque nouvelle entrée de navigation** que vous voulez pouvoir **masquer par rôle métier** depuis `/administration/matricemenu` doit être **ajoutée explicitement** dans ce registre ([`app/src/lib/menuVisibility/tiles.ts`](../app/src/lib/menuVisibility/tiles.ts)), puis **branchée** dans les pages avec **`resolveNavTileVisible`** (voir checklist ci‑dessous).

Sans cette étape, la tuile peut exister dans l’UI via **`feature.*`** seuls pour les **routes**, mais **pas** dans la matrice : elle restera **masquée** dans les menus pilotés par **`resolveNavTileVisible`** tant que la ligne correspondante n’est pas renseignée en base avec au moins un rôle métier coché (voir [Comportement](#comportement)).

Les **colonnes** de la matrice restent **dynamiques** : ce sont les documents **`MetierRole`** en base.

Exemple d’identifiants stables `id` côté hub (registre `NAV_TILE_DEFINITIONS`) : `hub.creation_matiere`, `hub.creation_salle`, `hub.export_formation_json` (export brut des formations depuis l’Administration), etc. — la liste à jour est dans [`app/src/lib/menuVisibility/tiles.ts`](../app/src/lib/menuVisibility/tiles.ts).

### Checklist développeur — nouvelle tuile / lien pilotable par la matrice

1. **Permission(s)**  
   Déclarer la ou les clés dans [`keys.ts`](../app/src/lib/permissions/keys.ts), **`ROUTE_MATRIX_ROWS`**, puis **`npm run init:roles`** si besoin de réinjecter les droits sur le rôle `admin`.

2. **Registre** — fichier [`tiles.ts`](../app/src/lib/menuVisibility/tiles.ts)  
   Ajouter un objet dans **`NAV_TILE_DEFINITIONS`** avec :
   - **`id`** : identifiant **stable** (ex. `accueil.mon_module`), utilisé en clé dans Mongo `MenuVisibilityConfig.byTile` ;
   - **`label`** : libellé affiché dans la matrice (FR) ;
   - **`scope`** : `accueil` ou `hub` (si nouveau type de regroupement, élargir le type `NavTileScope` dans le même fichier) ;
   - **`permissionKeys`** : liste des `feature.*` nécessaires pour que la tuile soit **éligible** (comme aujourd’hui pour les gardes).

3. **Rendu conditionnel**  
   Là où la tuile ou le lien est rendu (`page.tsx` accueil, hub, etc.), remplacer un simple `liveSessionHasAnyPermission` par **`resolveNavTileVisible(session, "<id>")`** pour tenir compte à la fois des permissions **et** de la matrice.

4. **Tuiles « métier » (non dans la matrice)**  
   Certaines entrées peuvent volontairement rester **hors** registre (ex. la tuile qui ouvre la page matrice elle‑même) : elles ne sont alors régies que par **`feature.*`**.

5. **Documentation**  
   Mettre à jour ce fichier ou [administration-hub.md](./administration-hub.md) si le parcours utilisateur change.

## FAQ — Je pensais n’avoir aucun droit mais je peux encore ouvrir des pages

### 1. Permissions `feature.*` (rôle Mongo `user` seed, champ legacy `role`)

Les **menus** pilotés par **`resolveNavTileVisible`** exigent désormais **matrice + rôle métier** (voir [Comportement](#comportement)). En revanche, les **layouts / routes** continuent de tester **`liveSessionHasAnyPermission`**.

Un compte avec **`role: "user"`** et **`roleSlugs` vide** se voit encore attribuer le slug **`user`** ([`roleSlugsForUser`](../app/src/lib/permissions/resolveForUser.ts)), et le document **`Role`** `user` du seed porte presque **toutes** les `feature.*` sauf la démo admin — vous pouvez donc **atteindre une URL** si vous la connaissez, même sans tuile au menu.

### 2. Matrice vide ou compte sans rôle métier

Sans ligne renseignée pour une tuile, ou sans **`metierRoleSlugs`** sur l’utilisateur, les entrées du **registre** restent **masquées** à l’écran (voir [Comportement](#comportement)).

## Idée produit

- **Permissions (`feature.*`)** : ce que l’utilisateur **peut faire** (accès route, mutation, etc.) — inchangé conceptuellement.
- **Matrice `MenuVisibilityConfig`** : pour chaque entrée du **registre** (`NAV_TILE_DEFINITIONS`), **qui** peut voir la tuile ; une ligne sans case cochée ou un utilisateur sans **`metierRoleSlugs`** ⇒ **pas d’affichage** au menu (voir [Comportement](#comportement)), **en complément** des permissions.

**Important** : masquer une tuile dans la matrice **ne désactive pas** les protections sur les URLs ni les server actions. Un lien direct vers une route reste soumis aux layouts et aux vérifications `liveSessionHasAnyPermission`.

## Comportement

Pour chaque entrée du registre [`NAV_TILE_DEFINITIONS`](../app/src/lib/menuVisibility/tiles.ts), une tuile ou lien n’est affiché(e) que si **les trois** conditions suivantes sont réunies :

1. **`liveSessionHasAnyPermission`** est vrai pour au moins une des **`permissionKeys`** de la définition (droits applicatifs « faire » / garde cohérente avec les routes).
2. **`MenuVisibilityConfig.byTile[tileId]`** existe en base et contient **au moins un** slug `MetierRole` (aucune case cochée pour cette ligne → **aucune visibilité** pour cette tuile).
3. L’utilisateur a **au moins un** **`metierRoleSlugs`** présent dans cette liste (compte **sans** rôle métier → **aucune visibilité** pour ces entrées du registre).

**Première installation** : tant qu’aucune configuration n’a été enregistrée pour une ligne, les tuiles correspondantes **ne s’affichent pas**. Après **`npm run init:admin`**, le compte seed reçoit le métier **`plateforme_admin`** et, si la grille était vide, une ligne par tuile du registre avec ce slug — ce qui débloque l’accès aux menus et à **`/administration/matricemenu`** (permission **`feature.administration.matricemenu`** toujours requise). Sans ce bootstrap, un utilisateur avec la permission mais sans métier ni lignes en base resterait sans entrées visibles sur l’accueil.

La tuile **« Matrice visibilité menus »** sur le hub **n’est pas** pilotée par cette matrice : elle dépend uniquement de `feature.administration.matricemenu`.

## Permission

| Constante | Clé |
|-----------|-----|
| `PERMISSION_ADMIN_MATRICE_MENU` | `feature.administration.matricemenu` |

Édition : **`/administration/matricemenu`** (après `npm run init:roles` pour injecter la clé sur le rôle seed **`admin`**).

## Fichiers

| Fichier | Rôle |
|---------|------|
| [`app/src/lib/models/MenuVisibilityConfig.ts`](../app/src/lib/models/MenuVisibilityConfig.ts) | Schéma Mongoose singleton |
| [`app/src/lib/menuVisibility/tiles.ts`](../app/src/lib/menuVisibility/tiles.ts) | Identifiants stables et permissions minimales par tuile |
| [`app/src/lib/menuVisibility/loadRules.ts`](../app/src/lib/menuVisibility/loadRules.ts) | Lecture + normalisation `byTile` |
| [`app/src/lib/menuVisibility/visibility.ts`](../app/src/lib/menuVisibility/visibility.ts) | Règle booléenne affichage |
| [`app/src/lib/menuVisibility/resolveNavTileVisible.ts`](../app/src/lib/menuVisibility/resolveNavTileVisible.ts) | Orchestration async (permissions live + métier + config) |
| [`app/src/lib/authz.ts`](../app/src/lib/authz.ts) | `liveMetierRoleSlugs` |
| [`app/src/app/administration/matricemenu/`](../app/src/app/administration/matricemenu/) | Page UI + action `saveMenuVisibilityByTileAction` |

## Voir aussi

- [Hub Administration](./administration-hub.md)
- [Authentification et rôles](./authentification-et-roles.md)
