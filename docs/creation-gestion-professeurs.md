# Gestion des professeurs (référentiel)

## Accès

- Route : **`/administration/creation-professeur`**
- Contrôle : permission **`feature.creation.professeur`** (rôle de base **`création_professeur`**, voir [`authentification-et-roles.md`](./authentification-et-roles.md)).

## Modèle MongoDB

Collection Mongoose **`Professeur`** (`app/src/lib/models/Professeur.ts`) :

| Champ         | Description |
|---------------|-------------|
| `prenom`      | Prénom (optionnel ; chaîne vide autorisée). |
| `nom`         | Nom de famille (obligatoire). |
| `slug`        | Identifiant technique unique, dérivé de « Prénom Nom » (ou du seul nom) via `slugifyMetierLabel` ; suffixe numérique en cas de collision. |
| `description` | Notes ou contact libre (optionnel, max 2000 caractères côté actions). |
| `matiereIds`   | Liste d’`_id` **`Matiere`** (`ObjectId`). Aucune contrainte côté `Matiere` : la suppression d’une matière peut laisser des références obsolètes (affichage « réf. invalide(s) » tant que vous ne nettoyez pas le document ou ne réattribuez pas les cases). |
| `contraintes` | Liste de sous-documents décriant des **contraintes de planification** (référentiel ; pas encore appliquées par un moteur d’EDT). Voir [Contraintes](#contraintes-de-planification). |

Les horodatages `createdAt` / `updatedAt` sont gérés par Mongoose.

### Contraintes de planification

Chaque entrée du tableau **`contraintes`** comporte :

| Champ (commun) | Description |
|----------------|-------------|
| `kind` | Type stable de contrainte (voir ci-dessous). **Évolution** : ajouter un type = compléter schéma Mongoose, validation serveur (`parseContraintesJsonForSave`), UI (`ProfesseurContraintesEditor`) et cette documentation. |
| `priorite` | Entier. **Convention** : *plus la valeur est faible, plus la contrainte est prioritaire* pour un futur arbitrage d’emploi du temps (pondération / ordre de traitement laissés au moteur). |
| `actif` | Booléen : désactiver sans supprimer la règle. |

Types actuels (`kind`) et champs associés :

| `kind` | Signification | Champs spécifiques |
|--------|---------------|-------------------|
| `jours_travail` | Jours où l’enseignant souhaite travailler. | `joursSemaine` : tableau d’entiers **1 = lundi … 7 = dimanche** (aligné sur le jour ISO de la semaine). |
| `bloc_consecutif_matiere` | Sur une matière donnée, ne pas dépasser un nombre maximal d’**heures consécutives** (intention pour le futur solveur : *même jour*, créneaux consécutifs ; la durée réelle dépendra du grammaire des créneaux). | `matiereId` (`ObjectId`), `maxHeuresConsecutives` (1–12 côté validation). |
| `volume_jour_matiere` | Sur une matière, pas plus de **X cours le même jour**. Ici un « cours » = une **séance / créneau** jusqu’à précision du modèle EDT. | `matiereId`, `maxCoursParJour` (1–20 côté validation). |

Règles métier côté serveur (`app/src/lib/professeurContraintes.ts`, appelé depuis **`createProfesseurAction`** / **`updateProfesseurAction`**) :

- Au plus **une** contrainte **`jours_travail`** par professeur ; pour chaque **`matiereId`**, au plus **une** contrainte **`bloc_consecutif_matiere`** et **une** **`volume_jour_matiere`** (cohérence UI + validation serveur). Les types ou matières déjà pris sont grisés dans les listes ; « Ajouter une contrainte » se désactive lorsqu’il n’y a plus de combinaison libre (selon les matières cochées).
- Au plus **50** entrées par professeur.
- Pour les contraintes par matière, **`matiereId` doit figurer dans les `matiereIds` cochés** pour ce professeur dans le même formulaire (sinon erreur explicite).
- Sérialisation formulaire : champ caché **`contraintesJson`** (JSON tableau), produit par **`ProfesseurContraintesEditor`** (`app/src/components/administration/ProfesseurContraintesEditor.tsx`).

**Types partagés sans Mongoose** (importables dans les composants client) : **`app/src/lib/professeurContraintes.shared.ts`** (évite d’embarquer Mongoose dans le bundle client). La validation d’écriture et `leanWireFromContraintesDoc` restent dans **`professeurContraintes.ts`**.

**Affichage liste** : colonne *Contraintes* dans **`GestionProfesseursPanel`** (nombre actives / total).

### Affectation matières → professeurs

Côté **professeur** uniquement (**pas** de champ inverse sur **`Matiere`** pour garder les choses simples). Sélection sous forme de cases à cocher dans les modales, champs multiples du formulaire `matiereIds` ; **`assertMatieresExist`** vérifie en base avant écriture. Liste des options : chargement depuis **`creation-professeur/page.tsx`** (toutes les matières).

Composant partagé : **`ProfesseurMatieresChecklist`** (`app/src/components/administration/ProfesseurMatieresChecklist.tsx`).

Option **`onPickedChange`** : notifie la liste des `matiereIds` couramment cochés pour que **`ProfesseurContraintesEditor`** ne propose que ces matières dans les listes déroulantes des contraintes « par matière ».

**Soumission formulaire (Next.js / React)** : les contrôles avec l’attribut HTML **`disabled` ne sont pas inclus dans le `FormData`** envoyé à l’action serveur. Or `useActionState` passe souvent `pending` à `true` au moment du submit, ce qui désactivait les cases **matières** et vidait `matiereIds` côté serveur. Les modales utilisent donc **`freezeDuringSubmit`** (`pointer-events-none` sur la liste, sans `disabled` sur les cases) et **`readOnly`** (au lieu de `disabled`) sur les champs texte pendant l’envoi, pour garder une sérialisation correcte.

Les cases sont gérées en **état contrôlé** ; les valeurs réellement postées sont des **`input type="hidden"`** nommés `matiereIds` (voir **`ProfesseurMatieresChecklist`**). Raison : avec React 19 et un `<form action={serverAction}>`, les champs entièrement contrôlés peuvent être réinitialisés ou exclus du `FormData` au moment du submit — les hidden reflètent l’état React sans dépendre de la sérialisation native des cases.

Après création / mise à jour réussie, **`router.refresh()`** est appelé côté client pour recharger les données RSC : sinon le tableau et la modale peuvent garder d’anciennes props jusqu’à navigation.

**Persistance** : création et mise à jour écrivent explicitement **`matiereIds`** et **`contraintes`** (notamment via `Professeur.updateOne` + `$set`, complément à `revalidatePath`).

## Flux applicatif

1. La page serveur vérifie la session et la permission, charge les **professeurs** (y compris **`contraintes`**) et **toutes les matières** (options des cases à cocher), transmet **`rows`** + **`matiereOptions`** au panneau **`GestionProfesseursPanel`** (colonne *Matières* = jointure en lecture avec la liste courante ; id inconnu ⇒ libellé **« réf. invalide(s) »**).
2. **Création** : `CreerProfesseurModal` → **`createProfesseurAction`** (`app/src/app/administration/_actions/professeurs.ts`).
3. **Modification** : `ModifierProfesseurModal` → **`updateProfesseurAction`** (identifiant `professeurId` en champ caché).
4. **Suppression** : `SupprimerProfesseurConfirmModal` → **`deleteProfesseurFormAction`** / **`deleteProfesseurAction`**.

Après chaque mutation réussie : **`revalidatePath('/administration/creation-professeur')`**.

## Limites connues

- **Pas de liaison** encore avec un compte **`User`** (connexion) ni avec les **classes** ou l’**emploi du temps** ; les contraintes sont **stockées et éditées** mais **non vérifiées** automatiquement contre un EDT jusqu’à l’existence d’un moteur de planification.
- Les sens précis de « heures consécutives » et « cours » seront raffinés quand le modèle de créneaux / séances sera défini.

## Relation avec les classes

La page **`/administration/creation-classe`** ne gère pas encore de référentiel analogue en base. Le présent flux est aligné sur le patron **référentiel + CRUD** déjà utilisé pour les [**matières**](./creation-gestion-matieres.md).
