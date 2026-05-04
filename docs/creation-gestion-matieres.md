# Gestion des matières (référentiel)

## Accès

- Route : `/administration/creation-matiere`
- Contrôle : permission `feature.creation.matiere` (rôle métier typique `création_matière`, voir [`authentification-et-roles.md`](./authentification-et-roles.md)).

## Modèle MongoDB

Collection Mongoose **`Matiere`** ([`app/src/lib/models/Matiere.ts`](../app/src/lib/models/Matiere.ts)) :

| Champ         | Description |
|---------------|-------------|
| `nom`         | Libellé affiché (obligatoire). |
| `slug`        | Identifiant technique unique, dérivé du nom (`slugifyMetierLabel`). En cas de collision, un suffixe numérique est ajouté (`base`, `base_1`, …). |
| `description` | Texte optionnel (max 2000 caractères côté actions). |
| `salleMode`   | **`classique`** ou **`liste`**. En mode **classique**, aucune liste de salles n’est stockée (comportement « salles classiques », sans choix précis dans le référentiel). En mode **liste**, une ou plusieurs salles sont référencées dans `salleIds`. |
| `salleIds`    | Tableau d’ObjectId **`Salle`**. Vide si `salleMode === "classique"` ; sinon au moins un identifiant valide après validation des actions serveur. |

Les horodatages `createdAt` / `updatedAt` sont gérés par Mongoose.

Les documents anciens sans `salleMode` / `salleIds` sont lus comme **classique** avec liste vide lors de l’affichage.

## Flux applicatif

1. La page serveur vérifie la session et la permission, charge **`Matiere`** triés par `nom` et **`Salle`** (`nom`, `kind`) pour alimenter le panneau et la checklist [`MatiereSallesChecklist`](../app/src/components/administration/MatiereSallesChecklist.tsx).
2. **Création** : `CreerMatiereModal` (mode salles + cases à cocher en mode liste) → `createMatiereAction` dans [`app/src/app/administration/_actions/matieres.ts`](../app/src/app/administration/_actions/matieres.ts).
3. **Modification** : `ModifierMatiereModal` → `updateMatiereAction` (`matiereId` caché, champs multiples `salleIds` via hidden comme pour les matières d’un professeur).
4. **Suppression** : `SupprimerMatiereConfirmModal` → `deleteMatiereFormAction` / `deleteMatiereAction`.

Après chaque mutation réussie, `revalidatePath('/administration/creation-matiere')` assure un rafraîchissement de la liste.

### Règles de validation (salles)

- Mode **classique** : `salleIds` est persisté vide.
- Mode **liste** : au moins une salle cochée ; chaque id doit exister dans la collection **`Salle`**.

La création de matière depuis le flux **contenu pédagogique** fixe explicitement `salleMode: "classique"` et `salleIds: []` (voir [`contenuPedagogique.ts`](../app/src/app/administration/_actions/contenuPedagogique.ts)).

## Limites connues

- La suppression retire uniquement la fiche dans le référentiel `Matiere` ; aucun lien avec des cours ou plannings n’est encore géré dans l’application (à prévoir lors de l’introduction de ces entités).
- Des **`Professeur`** peuvent référencer une matière via **`matiereIds`** ; après suppression du document **`Matiere`**, des ids orphelins peuvent rester côté professeur (voir [**gestion des professeurs**](./creation-gestion-professeurs.md)).
- Après **suppression d’une `Salle`**, des **`salleIds`** orphelins peuvent rester sur une **`Matiere`** en mode liste (même familie de limite que les matières côté professeur) ; un nettoyage ou une garde dédiée pourra être ajouté plus tard.
