# Gestion des vacances

## Accès

- Route : **`/administration/gestion-vacances`**
- Permission **`feature.gestion.vacances`** (constante `PERMISSION_GESTION_VACANCES` dans [`app/src/lib/permissions/keys.ts`](../app/src/lib/permissions/keys.ts)).

---

## Documentation utilisateur

### Rôle du module

La **gestion des vacances** permet de créer un référentiel centralisé de **périodes de vacances réutilisables** qui peuvent être partagées entre plusieurs formations. Ce système offre deux niveaux de gestion :

1. **Périodes référentielles** (gérées dans ce module) : périodes centralisées réutilisables par toutes les formations
2. **Périodes spécifiques** (gérées dans chaque formation) : périodes locales propres à une formation particulière

### Avantages du système

- **Cohérence** : les périodes de vacances communes (Noël, Pâques, été, etc.) sont définies une seule fois
- **Réutilisabilité** : une même période peut être utilisée par plusieurs formations
- **Flexibilité** : possibilité d'ajouter des périodes spécifiques pour des formations particulières
- **Maintenance** : modification centralisée des périodes communes

### Créer une période de vacances

1. Cliquer sur **« + Nouvelle période »**.
2. Renseigner :
   - **Nom** : intitulé de la période (ex: "Vacances de Noël 2025")
   - **Date de début** : premier jour de vacances (YYYY-MM-DD)
   - **Date de fin** : dernier jour de vacances (YYYY-MM-DD)
   - **Description** (optionnel) : informations complémentaires
3. Valider **« Créer »**.

### Importer les vacances scolaires françaises

Pour importer automatiquement toutes les périodes de vacances scolaires françaises :

1. Cliquer sur **« Importer vacances françaises »**.
2. Sélectionner l'**année scolaire** (ex: 2025-2026).
3. Cliquer sur **« Importer »** pour lancer l'import.
4. Les périodes sont créées automatiquement (environ 15-20 périodes pour toutes les zones).

**Source des données** : API officielle du ministère de l'Éducation nationale (data.education.gouv.fr)

**Zones académiques incluses** :
- **Zone A** : Besançon, Bordeaux, Clermont-Ferrand, Dijon, Grenoble, Limoges, Lyon, Poitiers
- **Zone B** : Aix-Marseille, Amiens, Caen, Lille, Nancy-Metz, Nantes, Nice, Orléans-Tours, Reims, Rennes, Rouen, Strasbourg
- **Zone C** : Créteil, Montpellier, Paris, Toulouse, Versailles
- **Corse** : Ajaccio

**Note** : Les périodes communes à toutes les zones (Toussaint, Noël, été) sont importées une seule fois sans mention de zone. Les périodes déjà existantes sont automatiquement ignorées.

### Modifier une période

- Cliquer sur **« Modifier »** dans la ligne concernée.
- Mettre à jour les informations.
- Valider **« Mettre à jour »**.

**Important** : les modifications d'une période référentielle affectent toutes les formations qui l'utilisent.

### Supprimer une période

- Cliquer sur **« Supprimer »** dans la ligne concernée.
- Confirmer la suppression.

**Protection** : impossible de supprimer une période utilisée par au moins une formation. Il faut d'abord retirer la période des formations concernées.

### Utiliser les périodes dans une formation

Lors de la création ou modification d'une formation (contraintes de planification, section 5) :

1. **Périodes référentielles** : cocher les périodes à appliquer depuis la liste des périodes disponibles
2. **Périodes spécifiques** : cliquer sur **« + Ajouter une période spécifique »** pour créer une période locale

Les deux types de périodes s'additionnent : le moteur de planification respecte l'union de toutes les périodes (référentielles + spécifiques).

---

## Modèle **`PeriodeVacances`** (persistance)

Fichier : [`app/src/lib/models/PeriodeVacances.ts`](../app/src/lib/models/PeriodeVacances.ts)

| Champ | Description |
|-------|-------------|
| `nom` | Intitulé de la période (max 100 caractères). |
| `slug` | Identifiant unique dérivé du nom (lowercase, généré automatiquement). |
| `debut` | Date de début au format `YYYY-MM-DD`. |
| `fin` | Date de fin au format `YYYY-MM-DD` (doit être ≥ début). |
| `description` | Texte libre optionnel (max 500 caractères). |

Horodatage : `createdAt` / `updatedAt` (Mongoose `timestamps`).

Collection MongoDB : **`periodesvacances`**

---

## Lien avec les formations

### Modèle Formation

Le modèle [`Formation`](../app/src/lib/models/Formation.ts) contient désormais deux champs distincts pour les vacances :

| Champ | Type | Description |
|-------|------|-------------|
| `periodeVacancesIds` | `ObjectId[]` | Références vers les périodes du référentiel centralisé |
| `datesVacances` | `Object[]` | Périodes spécifiques à cette formation (définies localement) |

### Résolution des périodes

Lors de l'affichage d'une formation, le système :
1. Charge les périodes référentielles via `periodeVacancesIds`
2. Charge les périodes locales depuis `datesVacances`
3. Affiche les deux types avec une distinction visuelle (référentielles avec fond gris, locales avec fond blanc)

---

## Actions serveur

### Actions CRUD des périodes

Fichier : [`app/src/app/administration/_actions/vacances.ts`](../app/src/app/administration/_actions/vacances.ts)

| Action | Rôle |
|--------|------|
| `createPeriodeVacancesAction` | Création d'une période (génération automatique du slug unique) |
| `updatePeriodeVacancesAction` | Mise à jour d'une période existante |
| `deletePeriodeVacancesAction` | Suppression avec vérification d'utilisation dans les formations |
| `deletePeriodeVacancesFormAction` | Wrapper pour suppression depuis formulaire |

### Action d'import des vacances françaises

Fichier : [`app/src/app/administration/_actions/importVacancesFrance.ts`](../app/src/app/administration/_actions/importVacancesFrance.ts)

| Action | Rôle |
|--------|------|
| `importVacancesFranceAction` | Importe les vacances scolaires françaises depuis l'API officielle |

#### Traitement des données API

1. **Appel API** : récupération via `data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire`
2. **Filtrage** : exclusion des périodes non-élèves (population différente de "-" ou "Élèves")
3. **Groupage** : regroupement par (description, zone) pour éviter doublons entre académies
4. **Conversion dates** : extraction du format ISO timestamp (`2025-10-17T22:00:00+00:00`) vers date simple (`2025-10-17`)
5. **Nommage** : construction automatique (ex: "Vacances de Noël 2025-2026 (Zone A)")
6. **Dédoublonnage** : vérification des périodes existantes par nom avant création
7. **Création** : insertion en base avec slug unique et description enrichie

#### Configuration et constantes

Fichier : [`app/src/lib/vacancesFrance.ts`](../app/src/lib/vacancesFrance.ts)

- URL de l'API
- Timeout de 10 secondes
- Définitions des zones académiques
- Liste des périodes communes à toutes les zones
- Helpers : `getAnneesDisponibles()`, `isAnneeScolaireValide()`, `isPeriodeNationale()`, `construireNomPeriode()`

### Validations

- **Dates** : `debut <= fin` (validation Mongoose + serveur)
- **Slug** : unicité garantie par génération incrémentale
- **Suppression** : interdite si la période est référencée par au moins une formation
- **Format année scolaire** : validation YYYY-YYYY (ex: 2025-2026)

---

## Actions serveur Formation (modifications)

Fichier : [`app/src/app/administration/_actions/formation.ts`](../app/src/app/administration/_actions/formation.ts)

Deux nouvelles fonctions :
- `parsePeriodeVacancesIdsJsonFromForm` : parse le JSON des IDs de périodes référentielles
- `validatePeriodeVacancesIds` : vérifie que tous les IDs existent dans la collection `periodesvacances`

Les actions `createFormationAction` et `updateFormationAction` gèrent maintenant :
- Le champ `periodeVacancesIdsJson` (IDs des périodes référentielles)
- Le champ `datesVacancesJson` (périodes locales, comme avant)

---

## Composants UI

| Composant | Rôle |
|-----------|------|
| [`GestionVacancesHubTile.tsx`](../app/src/components/administration/GestionVacancesHubTile.tsx) | Tuile pour le hub Administration |
| [`GestionVacancesPanel.tsx`](../app/src/components/administration/GestionVacancesPanel.tsx) | Panel principal avec liste et boutons CRUD + import |
| [`CreerPeriodeVacancesModal.tsx`](../app/src/components/administration/CreerPeriodeVacancesModal.tsx) | Modale de création manuelle |
| [`ModifierPeriodeVacancesModal.tsx`](../app/src/components/administration/ModifierPeriodeVacancesModal.tsx) | Modale d'édition |
| [`ImporterVacancesFranceModal.tsx`](../app/src/components/administration/ImporterVacancesFranceModal.tsx) | Modale d'import des vacances françaises |
| [`FormationContraintesEditor.tsx`](../app/src/components/administration/FormationContraintesEditor.tsx) | Section 5 : sélection périodes référentielles + gestion périodes locales |

### Composant FormationContraintesEditor (mise à jour)

Ce composant a été enrichi pour gérer les deux types de périodes :

**Props ajoutées** :
- `periodeVacancesOptions` : liste des périodes référentielles disponibles
- `defaultPeriodeVacancesIds` : IDs des périodes sélectionnées par défaut

**Rendu** :
- Checkboxes pour sélectionner les périodes référentielles (fond gris)
- Bouton pour ajouter des périodes spécifiques (fond blanc)
- Distinction visuelle entre les deux types

**Champs cachés générés** :
- `periodeVacancesIdsJson` : JSON des IDs sélectionnés
- `datesVacancesJson` : JSON des périodes locales

---

## Page serveur

Fichier : [`app/src/app/administration/creation-formation/page.tsx`](../app/src/app/administration/creation-formation/page.tsx)

**Modifications** :
1. Chargement des périodes depuis `PeriodeVacances.find({})`
2. Construction de `periodeVacancesOptions` (id, nom, debut, fin)
3. Résolution des `periodeVacancesIds` dans chaque `FormationRow`
4. Passage des options à `GestionFormationPanel`

---

## Scripts d'initialisation

### Rôles et permissions

Après installation, exécuter depuis **`app/`** :

```bash
npm run init:roles
```

Cela ajoute la permission **`feature.gestion.vacances`** au rôle `admin` du seed.

### Migration de la matrice

Pour une base déjà peuplée, exécuter :

```bash
npx tsx scripts/init/migrate-hub-gestion-vacances-tile.ts
```

Ce script initialise la visibilité de la tuile `hub.gestion_vacances` dans la matrice en copiant les slugs de `hub.creation_formation`.

---

## Architecture de données

### Flux de création

```
User → CreerPeriodeVacancesModal
     → createPeriodeVacancesAction
     → slugifyMetierLabel (génération slug)
     → PeriodeVacances.create()
     → revalidatePath(/administration/gestion-vacances)
```

### Flux d'utilisation dans une formation

```
User sélectionne périodes → FormationContraintesEditor
                          → periodeVacancesIdsJson (hidden input)
                          → createFormationAction / updateFormationAction
                          → validatePeriodeVacancesIds
                          → Formation.create() / doc.save()
```

### Flux de suppression (avec garde-fou)

```
User → deletePeriodeVacancesAction
     → Formation.countDocuments({ periodeVacancesIds: oid })
     → si count > 0 : erreur "utilisée par N formation(s)"
     → sinon : PeriodeVacances.deleteOne()
```

### Flux d'import des vacances françaises

```
User → ImporterVacancesFranceModal (sélection année)
     → importVacancesFranceAction(anneeScolaire)
     → fetchVacancesFromAPI (appel API avec timeout)
     → grouperPeriodes (filtrage population + groupage par description/zone)
     → Pour chaque période groupée :
        → Conversion dates ISO → YYYY-MM-DD
        → Vérification doublon par nom
        → allocateUniqueSlug (génération slug unique)
        → PeriodeVacances.create()
     → revalidatePath(/administration/gestion-vacances)
     → Retour : {ok: true, message: "X période(s) importée(s) (Y ignorée(s))"}
```

---

## Limites et contraintes

### Protection de suppression

Une période référentielle ne peut pas être supprimée si elle est utilisée par au moins une formation. Le message d'erreur indique le nombre de formations concernées.

### Modification des périodes

Les modifications d'une période référentielle (dates, nom) affectent **toutes les formations** qui l'utilisent. Il n'y a pas d'historisation : la modification est immédiate et globale.

### Slug unique

Le slug est généré automatiquement lors de la création et peut être modifié lors de l'édition si le nom change. En cas de conflit, un suffixe numérique est ajouté (`_1`, `_2`, etc.).

### Format des dates

Les dates sont stockées au format `YYYY-MM-DD` (ISO 8601 date-only) et interprétées en UTC date-only. L'affichage utilise `toLocaleDateString("fr-FR")` avec un offset neutre (`T12:00`).

---

## Cas d'usage

### Vacances scolaires nationales

Créer une période "Vacances de Noël 2025-2026" (du 20/12/2025 au 05/01/2026) dans le référentiel, puis la sélectionner dans toutes les formations concernées.

### Formation avec stage en entreprise

Pour une formation avec un stage spécifique du 15/03/2026 au 15/05/2026 :
1. Sélectionner les périodes de vacances nationales (référentielles)
2. Ajouter une période spécifique "Stage en entreprise" pour cette formation

### Modification d'une période nationale

Si les dates de vacances de Noël changent, modifier la période référentielle : toutes les formations qui l'utilisent sont automatiquement mises à jour.

### Import initial pour nouvelle année scolaire

1. Ouvrir "Gestion des vacances"
2. Cliquer sur "Importer vacances françaises"
3. Sélectionner l'année scolaire (ex: 2025-2026)
4. L'import crée automatiquement ~15-20 périodes pour toutes les zones
5. Ces périodes sont ensuite disponibles pour sélection dans toutes les formations

---

## Voir aussi

- [Administration Hub](./administration-hub.md)
- [Création et gestion des formations](./creation-formation.md)
- [Matrice visibilité des menus](./matrice-visibilite-menus.md)
