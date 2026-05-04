# Gestion des salles (référentiel)

## Accès

- Route : `/administration/creation-salle`
- Contrôle : permission `feature.creation.salle` (rôle métier typique `création_salle`, voir [`authentification-et-roles.md`](./authentification-et-roles.md)).
- Tuile hub **Création salle** : pilotée par la matrice [`hub.creation_salle`](../app/src/lib/menuVisibility/tiles.ts), en complément des permissions ; voir [`matrice-visibilite-menus.md`](./matrice-visibilite-menus.md).

## Modèle MongoDB

Collection Mongoose **`Salle`** ([`app/src/lib/models/Salle.ts`](../app/src/lib/models/Salle.ts)) :

| Champ           | Description |
|-----------------|-------------|
| `nom`           | Libellé affiché (obligatoire). |
| `slug`          | Identifiant technique unique, dérivé du nom (`slugifyMetierLabel`). En cas de collision, un suffixe numérique est ajouté (`base`, `base_1`, …). |
| `kind`          | **`classique`** ou **`specifique`**. Une **salle spécifique** est une salle avec équipement pédagogique (libellé UI : « Salle spécifique »). |
| `description`   | Texte optionnel (max 2000 caractères côté actions) ; utile notamment pour décrire l’équipement d’une salle spécifique. |

Les horodatages `createdAt` / `updatedAt` sont gérés par Mongoose.

## Flux applicatif

1. La page serveur vérifie la session et la permission, charge la liste triée par `nom`, passe les lignes au panneau client.
2. **Création** : `CreerSalleModal` → action serveur `createSalleAction` dans [`app/src/app/administration/_actions/salles.ts`](../app/src/app/administration/_actions/salles.ts).
3. **Modification** : `ModifierSalleModal` → `updateSalleAction` (identifiant `salleId` en champ caché).
4. **Suppression** : `SupprimerSalleConfirmModal` → `deleteSalleFormAction` / `deleteSalleAction`.

Après chaque mutation réussie, `revalidatePath('/administration/creation-salle')` assure un rafraîchissement de la liste.

## Limites connues

- La suppression retire uniquement la fiche dans le référentiel `Salle` ; aucun lien avec des cours ou plannings n’est encore géré dans l’application (à prévoir lors de l’introduction de ces entités).

## Initialisation

Après ajout de la permission en base de code, exécuter depuis **`app/`** :

```bash
npm run init:roles
```

pour mettre à jour les documents `Role` (dont le rôle spécialisé `création_salle`). Si la matrice de visibilité existe déjà, activer la ligne **Création salle** pour les rôles métier concernés dans `/administration/matricemenu`.
