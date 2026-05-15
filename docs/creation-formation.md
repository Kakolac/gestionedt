# Création et gestion des formations

## Accès

- Route : **`/administration/creation-formation`**  
  (l’ancienne URL **`/administration/creation-contenu-pedagogique`** est **redirigée** vers celle-ci de façon permanente via [`next.config.ts`](../app/next.config.ts).)
- Permission **`feature.creation.formation`** (constante `PERMISSION_CREATION_FORMATION` dans [`app/src/lib/permissions/keys.ts`](../app/src/lib/permissions/keys.ts)).

---

## Documentation utilisateur

### Rôle du module

Une **formation** regroupe plusieurs **matières** dans un même bloc (ex. programme, semestre) avec, pour **chaque matière** :

- les **professeurs** qui interviennent sur cette matière dans ce bloc ;
- les **heures prévues** pour cette matière dans le bloc.

Une même **matière** (au sens référentiel) ne peut appartenir **qu’à une seule** formation à la fois.

### Créer une formation

1. Cliquer sur **« Nouvelle formation »**.
2. Renseigner le **nom** et la **description** du bloc.
3. Pour chaque matière à inclure, utiliser **« + Ajouter une matière »** :
   - choisir une **matière existante** (parmi celles encore libres) ou créer une **nouvelle matière** (elle sera enregistrée avec la formation) ;
   - indiquer les **heures prévues** pour cette matière dans la modale ;
   - cocher le ou les **professeurs** (filtrés selon la matière pour une matière existante) ;
   - valider **« Ajouter »**. Répéter pour d’autres matières.
4. Vous pouvez **ajuster les heures** directement dans la liste des lignes avant enregistrement.
5. La ligne **« Total du bloc »** affiche la **somme** des heures de toutes les matières (c’est ce total qui est stocké avec le nom `nombreHeures` côté base).
6. **« Créer la formation »** valide et enregistre.

### Modifier ou supprimer

- **Modifier** : même principe (ajouter / retirer des matières, changer profs ou heures par ligne). Au moins une matière doit rester dans le bloc.
- **Supprimer** : retire le regroupement ; les **matières** du référentiel ne sont pas supprimées.

### Lire la liste

Le tableau affiche pour chaque bloc : nom, description, **liste des matières avec leurs heures prévues**, professeurs regroupés, **total** d’heures.

---

## Modèle **`Formation`** (persistance)

Fichier : [`app/src/lib/models/Formation.ts`](../app/src/lib/models/Formation.ts)

Le modèle Mongoose s’appelle **`Formation`** ; la **collection MongoDB** reste historiquement **`contenupedagogiques`** (constante `FORMATION_MONGODB_COLLECTION`).

| Champ           | Description |
|-----------------|-------------|
| `nom`           | Intitulé du bloc (max 200 caractères). |
| `description`  | Texte libre (max 2000 caractères). |
| `lignes`       | Tableau d’objets `{ matiereId, professeurIds[], nombreHeuresPrevues }`. Chaque ligne = une matière dans ce bloc + intervenants sur cette ligne + **volume horaire prévu pour cette matière** (entier ≥ 0). Index **unique** sur `lignes.matiereId` : une matière ne peut figurer que dans **un** document. |
| `nombreHeures`  | **Somme** des `nombreHeuresPrevues` ; **recalculée** à chaque création / mise à jour serveur (pas de saisie séparée « total seul »). |
| `periodeVacancesIds` | Tableau d'`ObjectId` : références vers les **périodes de vacances réutilisables** du référentiel (collection `periodesvacances`). Ces périodes sont partagées entre formations. |
| `datesVacances` | Tableau d'objets `{ debut, fin, nom }` : **périodes spécifiques** à cette formation, définies localement (non réutilisables). |

Horodatage : `createdAt` / `updatedAt` (Mongoose `timestamps`).

**Contrainte planning — Périodes de vacances** : le moteur de planification respecte l'**union** des deux types de périodes (référentielles + spécifiques) : aucun cours ne sera placé pendant ces intervalles. Voir [gestion-vacances.md](./gestion-vacances.md) pour plus de détails sur le référentiel centralisé.

---

## Contrat formulaire : `lignesJson`

Les modales **création** / **modification** envoient, avec le formulaire, un champ caché **`lignesJson`** : un **tableau JSON** d’objets (pas un objet racine). Chaque entrée est **soit** une matière existante **soit** une nouvelle matière :

**Matière existante**

```json
{
  "existingMatiereId": "<ObjectId Mongo>",
  "professeurIds": ["<ObjectId>", "..."],
  "nombreHeuresPrevues": 24
}
```

**Nouvelle matière** (créée dans la même action serveur si besoin)

```json
{
  "nouveauNom": "Physique appliquée",
  "nouveauDescription": "optionnel",
  "professeurIds": [],
  "nombreHeuresPrevues": 40
}
```

Règles : pour une ligne, **exactement un** des deux modes (`existingMatiereId` **ou** `nouveauNom`, pas les deux). Chaque professeur d’une ligne « matière existante » doit avoir cette matière dans **`Professeur.matiereIds`**.

Champs de méta du bloc : **`nomFormation`**, **`descriptionFormation`**. Identifiant en édition / suppression : **`formationId`**.

---

## Gestion des périodes de vacances

Le système offre **deux mécanismes complémentaires** pour définir les périodes pendant lesquelles aucun cours ne doit être planifié :

### 1. Périodes référentielles (réutilisables)

- **Source** : référentiel centralisé accessible via **`/administration/gestion-vacances`**
- **Sélection** : checkboxes dans la section **« Contraintes de planification — 5. Périodes de vacances »**
- **Champ persisté** : `periodeVacancesIds` (tableau d'`ObjectId`)
- **Champ formulaire** : `periodeVacancesIdsJson` (JSON des IDs sélectionnés)
- **Avantages** : 
  - Définition centralisée des vacances communes (Noël, Pâques, été, etc.)
  - Modification globale : une mise à jour de la période affecte toutes les formations qui l'utilisent
  - Réutilisabilité entre formations

### 2. Périodes spécifiques (locales)

- **Source** : définies directement dans chaque formation
- **Ajout** : bouton **« + Ajouter une période spécifique »** dans la même section
- **Champ persisté** : `datesVacances` (tableau d'objets `{ debut, fin, nom }`)
- **Champ formulaire** : `datesVacancesJson` (JSON des périodes locales)
- **Usage** : périodes propres à une formation (stage en entreprise, événement ponctuel, etc.)

### Affichage et distinction visuelle

Dans l'interface de gestion des contraintes :
- Les **périodes référentielles** s'affichent avec un fond gris et ne sont **pas modifiables** localement
- Les **périodes spécifiques** s'affichent avec un fond blanc et peuvent être **ajoutées/modifiées/supprimées**

### Comportement du moteur de planification

Le moteur respecte l'**union** des deux types : si une date est couverte par au moins une période (référentielle ou spécifique), aucun cours ne peut y être placé.

Pour plus de détails sur la gestion du référentiel centralisé, voir [gestion-vacances.md](./gestion-vacances.md).

---

## Actions serveur

Fichier : [`app/src/app/administration/_actions/formation.ts`](../app/src/app/administration/_actions/formation.ts)

| Action | Rôle |
|--------|------|
| `createFormationAction` | Création du document + éventuelles `Matiere` « nouvelles ». |
| `updateFormationAction` | Mise à jour par `formationId`. |
| `deleteFormationAction` / `deleteFormationFormAction` | Suppression du document. |

Validations notables (côté implémentation) :

- **`nombreHeuresPrevues`** par ligne : entier entre **0** et **50 000** (bornes `HEURES_MIN` / `HEURES_MAX`).
- **Total** : somme des lignes ≤ **50 000** ; ce total est écrit dans `nombreHeures`.
- Taille JSON : garde `MAX_JSON_CHARS` (400 000 caractères), nombre de lignes ≤ **120** (`MAX_LIGNES`).
- Unicité matière : pas de conflit avec une autre `Formation`.

Revalidation Next : chemins `/administration/creation-formation` et, si création de matière dans le flux, `/administration/creation-matiere`.

---

## Composants UI (référence code)

| Composant | Rôle |
|-----------|------|
| [`GestionFormationPanel.tsx`](../app/src/components/administration/GestionFormationPanel.tsx) | Tableau liste + boutons ouvrir création / modification / suppression. |
| [`CreerFormationModal.tsx`](../app/src/components/administration/CreerFormationModal.tsx) | Formulaire création + agrégation `lignesJson`. |
| [`ModifierFormationModal.tsx`](../app/src/components/administration/ModifierFormationModal.tsx) | Types `FormationRow` / `FormationLigneListe` ; édition. |
| [`AjouterLigneFormationModal.tsx`](../app/src/components/administration/AjouterLigneFormationModal.tsx) | Modale « une matière + heures + profs ». |

Page serveur (chargement des données, construction des `rows`) : [`creation-formation/page.tsx`](../app/src/app/administration/creation-formation/page.tsx).

---

## Ancien schéma et migration MongoDB (lignes)

Les premières versions pouvaient stocker un seul `matiereId` ou un tableau `matiereIds` à la racine. Pour aligner une base déjà peuplée, exécuter depuis **`app/`** :

```bash
npx tsx scripts/init/migrate-contenu-pedagogique-groupement.ts
```

Le script construit **`lignes`**, pose **`nombreHeuresPrevues: 0`** sur les lignes qu’il crée (à compléter dans l’UI), supprime les anciens champs racine obsolètes et assure l’index unique sur **`lignes.matiereId`**.

---

## Migration renommage « contenu pédagogique » → « formation »

Si la base a été créée **avant** le renommage des slugs / permissions / tuile matrice, exécuter depuis **`app/`** :

```bash
npx tsx scripts/init/migrate-renommage-formation.ts
```

Puis, si besoin, réinjecter les rôles seed :

```bash
npm run init:roles
npm run init:metier-roles
```

Sans cette étape, des utilisateurs ou la matrice peuvent encore référencer l’ancienne permission **`feature.creation.contenu_pedagogique`** ou la tuile **`hub.creation_contenu_pedagogique`**.

---

## Affichage « total » et données héritées

Si les **lignes** en base n’ont pas encore de `nombreHeuresPrevues` renseigné (ou uniquement des **0**), la **page liste** peut encore afficher comme total du tableau l’ancien champ **`nombreHeures`** du document (fallback), tant qu’aucune somme positive par ligne n’est saisie. Après édition et enregistrement, le total affiché correspond à la **somme des lignes**, alignée avec `nombreHeures` persisté.

---

## Limites connues

- Troncature visuelle dans le tableau (`line-clamp`) : détail complet dans la modale **Modifier**.
- Le champ **`nombreHeures`** seul ne doit pas être interprété comme source de vérité indépendante des lignes : après toute sauvegarde via l’UI actuelle, il reflète la somme des `nombreHeuresPrevues`.
