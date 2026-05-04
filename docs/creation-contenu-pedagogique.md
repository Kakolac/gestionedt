# Création et gestion des contenus pédagogiques

## Accès

- Route : **`/administration/creation-contenu-pedagogique`**
- Permission **`feature.creation.contenu_pedagogique`** (`PERMISSION_CREATION_CONTENU_PEDAGOGIQUE`).

## Modèle **`ContenuPedagogique`**

[`app/src/lib/models/ContenuPedagogique.ts`](../../app/src/lib/models/ContenuPedagogique.ts)

Un **contenu pédagogique** est un regroupement nommé qui porte :

| Champ           | Description |
|-----------------|-------------|
| `nom`           | Intitulé du bloc (ex. programme, module commun). |
| `description`  | Texte libre présentant le regroupement. |
| `lignes`       | Tableau d’**objets** `{ matiereId, professeurIds[], nombreHeuresPrevues }` : pour **chaque** matière du bloc, les professeurs qui interviennent **sur cette matière** dans ce regroupement et le **volume horaire prévu pour cette matière** (entier ≥ 0). Une matière ne peut être présente que dans **un** document (`lignes.matiereId` index unique multi-clé). |
| `nombreHeures`  | **Somme** des `nombreHeuresPrevues` des lignes ; recalculée à chaque enregistrement (cohérence avec les lignes). |

Côté formulaire (création / modification), le client envoie un champ caché **`lignesJson`** : tableau JSON d’objets — soit `{ existingMatiereId, professeurIds, nombreHeuresPrevues }`, soit `{ nouveauNom, nouveauDescription?, professeurIds, nombreHeuresPrevues }` (nouvelle matière créée dans la même requête si besoin). Pour une **matière existante**, chaque professeur doit avoir cette matière sur sa fiche (`Professeur.matiereIds`).

## Ancien schéma (migration)

Les premières versions stockaient un seul `matiereId` unique par document. Pour aligner une base déjà peuplée, exécuter depuis **`app/`** :

```bash
npx tsx scripts/init/migrate-contenu-pedagogique-groupement.ts
```

Le script construit **`lignes`** à partir d’un ancien `matiereId` ou d’un tableau `matiereIds`, en répartissant les **`professeurIds`** racine sur chaque ligne, initialise **`nombreHeuresPrevues`** à `0` par ligne (à compléter ensuite dans l’UI), supprime les champs obsolètes et pose l’index unique sur **`lignes.matiereId`** (en retirant les anciens index `matiereId` / `matiereIds` si présents).

Sans migration, Mongoose peut refuser lecture/écriture cohérente avec le nouveau schéma sur d’anciens documents.

## UI

- **Liste** : nom, extrait description, matières avec détail **heures prévues par matière**, intervenants, **total** d’heures (colonne « Heures »).
- **Création** : nom, description ; bouton **« Ajouter une matière »** ouvre une modale : **matière existante** ou **nouvelle matière**, **heures prévues pour cette matière**, puis le ou les **professeurs** ; **Ajouter** accumule les lignes (modifiables dans la liste, dont les heures) ; total du bloc affiché comme somme des lignes.
- **Modification** : mêmes règles pour enrichir / retirer des lignes ; les matières déjà utilisées par un **autre** contenu ne sont pas proposées pour une nouvelle ligne (celles déjà sur la fiche restent éditables).

## Actions serveur

[`app/src/app/administration/_actions/contenuPedagogique.ts`](../../app/src/app/administration/_actions/contenuPedagogique.ts)

- Création / mise à jour : parse de **`lignesJson`**, résolution des lignes (création des matières « nouvelles » si besoin), contrôle que les **matières existantes** ne sont pas déjà dans un autre contenu, validation que les professeurs choisis **pour une ligne** sont bien rattachés à la matière de cette ligne dans le référentiel, validation des heures par ligne et du total.

## Limites connues

- `line-clamp` dans le tableau tronque l’affichage ; détail complet dans la modale « Modifier ».
- Données migrées sans saisie manuelle : `nombreHeuresPrevues` à `0` par ligne jusqu’à édition ; le **total** affiché peut encore refléter l’ancien `nombreHeures` document tant que les lignes restent à 0 (fallback liste).
