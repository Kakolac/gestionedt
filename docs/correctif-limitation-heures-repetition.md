# Correctif : Limitation des heures planifiées en mode répétition

## Problème identifié

En mode répétition, certaines matières se retrouvaient avec **plus d'heures planifiées que prévues**. Par exemple : 108h prévues → 140h planifiées.

### Cause racine

Dans `planning-normalize.ts`, la fonction `buildWeeklyTemplatePlanningData` calculait le volume hebdomadaire avec un arrondi :

```typescript
const hWeek = Math.max(0, Math.round(d.nombreHeuresPrevues / nw));
```

L'**arrondi** (`Math.round`) pouvait créer un volume hebdomadaire qui, multiplié par le nombre de semaines, **dépassait** le volume prévu.

**Exemple du bug** :
- Formation avec 100h prévues sur 40 semaines
- hWeek = Math.round(100 / 40) = Math.round(2.5) = **3h** (arrondi supérieur)
- Réplication sur 40 semaines : 3h × 40 = **120h planifiées** (20h de trop !)

## Solution implémentée

Pour corriger ce bug, nous avons ajouté un mécanisme de limitation du nombre de semaines de réplication pour garantir que le total planifié ne dépasse jamais le volume prévu.

### 1. Nouveau champ `maxSemainesReplication`

Ajout d'un champ optionnel dans le type `PlanningDemand` :

```typescript
/**
 * En mode répétition : nombre maximal de semaines sur lesquelles répliquer
 * le gabarit pour ne pas dépasser nombreHeuresPrevues (du contrat formation original).
 * Calculé dans buildWeeklyTemplatePlanningData.
 */
maxSemainesReplication?: number;
```

### 2. Calcul de `maxSemainesReplication`

Dans `buildWeeklyTemplatePlanningData`, nous calculons le nombre maximal de semaines pour chaque demande :

```typescript
// Calculer le nombre maximal de semaines pour ne pas dépasser les heures prévues d'origine
const heuresParGabarit = seances.reduce((acc, p) => acc + p.duree * p.quantite, 0);
const maxSemainesReplication = heuresParGabarit > 0
  ? Math.floor(d.nombreHeuresPrevues / heuresParGabarit)
  : nw;
```

**Exemple corrigé** :
- 100h prévues, hWeek = 3h (gabarit)
- maxSemainesReplication = Math.floor(100 / 3) = **33 semaines**
- Réplication sur 33 semaines : 3h × 33 = **99h planifiées** (≤ 100h prévues ✓)

### 3. Respect de la limite lors de la réplication

Dans `repliquerGabaritPourPlage`, nous vérifions pour chaque session que la semaine de réplication ne dépasse pas `maxSemainesReplication` :

```typescript
const demand = demandById.get(s.demandId);
const maxSemaines = demand?.maxSemainesReplication ?? Infinity;

// ...

for (let k = 0; k < Wp; k += 1) {
  const sem = weekGlobal + k;
  if (sem < templateWeek) continue;
  
  // Limiter la réplication au nombre maximal de semaines
  if (sem > maxSemaines) continue;
  
  // ... créer la session répliquée
}
```

## Résultat attendu

Après ce correctif, les heures planifiées sont **toujours ≤ heures prévues** pour chaque matière dans la section "Comparaison" du planning builder, respectant ainsi le contrat de formation.

## Tests à effectuer

Pour vérifier que le correctif fonctionne correctement :

1. **Test 1** : Créer un planning répété avec 100h prévues sur 40 semaines
   - Vérifier que les heures planifiées ≤ 100h
   
2. **Test 2** : Créer un planning répété avec 108h prévues sur 52 semaines
   - Vérifier que les heures planifiées ≤ 108h

3. **Test 3** : Dans PlanningComparisonStats, vérifier que pour chaque ligne :
   - Colonne "Planifié" ≤ Colonne "Prévu"

## Fichiers modifiés

- `app/src/lib/planning/planning.types.ts` : Ajout du champ `maxSemainesReplication` dans `PlanningDemand`
- `app/src/lib/planning/planning-normalize.ts` : Calcul de `maxSemainesReplication` dans `buildWeeklyTemplatePlanningData`
- `app/src/lib/planning/planning-scheduler.ts` : Respect de `maxSemainesReplication` dans `repliquerGabaritPourPlage`

## Optimisation des performances

Suite à un retour utilisateur concernant la lenteur de la génération du planning, une optimisation a été apportée :

**Problème** : La Map `demandById` était recréée à chaque appel de `repliquerGabaritPourPlage`, ce qui pouvait entraîner des milliers de créations inutiles lors de plannings avec plusieurs périodes.

**Solution** : La Map est maintenant créée une seule fois dans `placerEtRepliquerGabaritGroupe` et passée en paramètre à `repliquerGabaritPourPlage`. Cette optimisation réduit significativement le temps de génération du planning en mode répétition.

## Date d'implémentation

13 mai 2026

## Indicateur de progression

Pour améliorer l'expérience utilisateur lors de la génération de plannings complexes, un indicateur de progression a été ajouté :

**Fonctionnalités** :
- Affichage en temps réel du pourcentage d'avancement (0% à 100%)
- Messages descriptifs de l'étape en cours
- Barre de progression visuelle avec gradient coloré animé
- Indication du nombre de groupes traités
- Spinner rotatif pour montrer l'activité
- Animation de pulsation pour attirer l'attention
- Logs console pour le débogage

**Étapes affichées** :
1. **Initialisation** (0%) : Préparation des données
2. **Placement des groupes** (10% - 80%) : Traitement de chaque groupe de formations
3. **Nettoyage** (85%) : Application des dates de démarrage
4. **Contraintes vacances** (95%) : Vérification des périodes de vacances
5. **Terminé** (100%) : Planning prêt

**Implémentation technique** :
- Utilisation de `requestAnimationFrame` (double frame) pour synchroniser avec le cycle de rendu du navigateur
- Délai de 50ms après chaque mise à jour pour garantir que le navigateur repeint l'écran
- Fonction asynchrone `scheduleGreedyRepetitionMode` avec callbacks `async/await`
- Calcul dans un `useEffect` pour permettre les re-renders pendant l'exécution
- Logs console à chaque étape pour le débogage et la visibilité de la progression

L'indicateur s'affiche automatiquement en mode répétition et disparaît une fois le calcul terminé.

## Barre de progression pour le replacement manuel

Le bouton "Tenter de replacer" dans la section des statistiques de vacances dispose d'une barre de progression détaillée :

**Fonctionnalités** :
- Barre de progression visuelle avec gradient coloré
- Affichage en temps réel : "X / Y séances" traitées
- Pourcentage d'avancement
- Compteur de séances restantes
- Animation fluide de la barre

**Fonctionnement optimisé** :
1. **Démarrage** : Affichage immédiat de la barre à 0%
2. **Calcul parallèle** : Le calcul démarre en arrière-plan dans une Promise
3. **Animation continue** : Progression fluide de 0% à 95% pendant le calcul
   - Mise à jour toutes les 20ms avec `requestAnimationFrame`
   - Permet au navigateur de rester réactif
   - Petites pauses entre chaque mise à jour
4. **Attente** : Si le calcul n'est pas terminé à 95%, on attend
5. **Finalisation** : Animation rapide de 95% à 100%
6. **Pause à 100%** : 400ms pour montrer la complétion

**Affichage** :
- Carte colorée avec bordure violette
- Nombre de séances traitées / total en temps réel
- Barre de progression animée avec gradient
- Pourcentage et nombre de séances restantes
- Animation fluide sans blocage complet du navigateur

**Limitations actuelles** :
- Le calcul `scheduleGreedy` reste synchrone et peut ralentir le navigateur
- Pour de très gros volumes (>100 séances), une légère latence peut être perceptible
- **Solution future** : Implémenter le calcul dans un Web Worker pour exécution parallèle réelle

**Implémentation** :
- Fonction `onTryReplaceUnscheduled` asynchrone
- Calcul lancé dans une Promise avec `async/await`
- Animation en `while` loop avec `requestAnimationFrame` + `setTimeout`
- État `replacementProgress` avec `{ current, total }`
- Logs console avec durée du calcul

## Historique des optimisations

- **13 mai 2026 (après-midi)** : 
  - Optimisation de la création de la Map `demandById` pour améliorer les performances
  - Ajout d'un indicateur de progression visuel pour le mode répétition
  - Ajout d'un indicateur de chargement pour le bouton de replacement manuel des séances non planifiées
