# Export JSON formations

## Pour l’utilisateur

1. Hub **Administration** → tuile **Export JSON formations** (visible si vous avez la permission **`feature.creation.formation`** *et*, le cas échéant, un [rôle métier autorisé pour cette ligne](./matrice-visibilite-menus.md) dans la matrice menus).
2. Page **`/administration/export-formation-json`** : cocher une ou plusieurs formations, puis **Télécharger le JSON**.
3. Le fichier contient des **données brutes** issues de MongoDB (documents tels que stockés, avec identifiants en chaîne hexadécimal et dates en ISO 8601), plus les **matières** et **professeurs** référencés dans les lignes des formations exportées.

Les **salles** ne sont pas développées en objets séparés : si une matière a des `salleIds`, ils restent sous forme d’identifiants dans le document matière exporté.

Limite technique : jusqu’à **80** formations par export ; fichier refusé au‑delà d’environ **800 000** caractères (réduire la sélection en cas de message d’erreur).

## Migration matrice (bases déjà existantes)

Sur une installation où **`MenuVisibilityConfig`** est déjà rempli sans la ligne **`hub.export_formation_json`**, la tuile peut rester invisible malgré la permission. Copier les mêmes rôles métier que pour la tuile Formation :

```bash
cd app && npm run migrate:hub-export-tile
```

(équivalent : `npx tsx scripts/init/migrate-hub-export-formation-tile.ts`)

Le script initialise **`hub.export_formation_json`** en dupliquant les slugs **`hub.creation_formation`**, ou **`[]`** + avertissement en console si la source est absente ou invalide. Réexécution : sans effet si la clé cible existe déjà.

Une alternative est de régler les cases à jour dans **`/administration/matricemenu`**.

## Contexte développement

| Fichier | Rôle |
|---------|------|
| [`app/src/lib/menuVisibility/tiles.ts`](../app/src/lib/menuVisibility/tiles.ts) | Définition registre **`hub.export_formation_json`** |
| [`app/src/app/administration/page.tsx`](../app/src/app/administration/page.tsx) | Rendu tuile hub via **`resolveNavTileVisible`** |
| [`app/src/components/administration/ExportFormationJsonHubTile.tsx`](../app/src/components/administration/ExportFormationJsonHubTile.tsx) | Lien vers la page export |
| [`app/src/app/administration/export-formation-json/page.tsx`](../app/src/app/administration/export-formation-json/page.tsx) | SSR liste formations + panneau client |
| [`app/src/components/administration/ExportFormationJsonPanel.tsx`](../app/src/components/administration/ExportFormationJsonPanel.tsx) | Cases à cocher + téléchargement |
| [`app/src/app/administration/_actions/exportFormationSnapshot.ts`](../app/src/app/administration/_actions/exportFormationSnapshot.ts) | Action serveur : charge `Formation`, déduit les **`Matiere`** et **`Professeur`**, agrège puis sérialise |
| [`app/src/lib/serialization/mongoLeanToJson.ts`](../app/src/lib/serialization/mongoLeanToJson.ts) | Sérialisation récursive `ObjectId` / `Date` |

### Structure du fichier exporté (`version` **1**)

- **`meta`** : `version`, `exportedAt` (ISO), `formationIdsRequested` (liste des `_id` demandés pour contrôle ; le payload contient les documents **`formations`** effectivement retrouvés).
- **`formations`** : documents lean collection **`Formation`** (nom Mongo historique **`contenupedagogiques`** ; modèle Mongoose `Formation`).
- **`matieres`** : tous les **`Matiere`** référencés par **`lignes[].matiereId`**, ainsi que les anciens champs **`matiereId` / `matiereIds`** s’ils existent encore sur une fiche.
- **`professeurs`** : tous les **`Professeur`** présents dans **`lignes[].professeurIds`** ou **`professeurIds`** legacy sur la formation.

Références manquantes (suppression en cascade partielle par exemple) : seuls les documents **trouvés** en base sont listés dans **`matieres`** et **`professeurs`** ; les identifiants orphelins restent cependant dans les documents **`formations`** retournés.

### Diff avec la page **Formation**

- **`/administration/creation-formation`** : CRUD et libellés enrichis dérivés pour l’interface.
- **`/administration/export-formation-json`** : lecture seule, pas de **`revalidatePath`**, destinée sauvegarde / audit hors produit ; pas de ré-import prévu dans le périmètre actuel.

## Voir aussi

- [Hub Administration](./administration-hub.md)
- [Création / gestion formations](./creation-formation.md)
- [Matrice visibilité des menus](./matrice-visibilite-menus.md)
