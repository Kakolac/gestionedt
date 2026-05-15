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
- Le calcul `scheduleGreedy` reste synchrone et bloque le thread principal
- Pour de gros volumes (>50 séances), le navigateur peut afficher "La page ne répond pas"
- **C'est normal** : Un message d'avertissement s'affiche pour rassurer l'utilisateur
- L'utilisateur doit simplement attendre sans fermer l'onglet
- Le calcul se termine généralement en quelques secondes

**Message d'avertissement automatique** :
Quand la progression atteint ~40% (juste avant le calcul intensif), un message s'affiche :
```
⏳ Calcul intensif en cours...
Le navigateur peut afficher "La page ne répond pas" - c'est normal, 
veuillez patienter sans fermer l'onglet.
```

**Solution future pour éliminer complètement le blocage** :
- Implémenter le calcul dans un **Web Worker**
- Exécution dans un thread séparé (parallélisme réel)
- Aucun impact sur l'UI, aucun message "page ne répond pas"
- Complexité d'implémentation importante (sérialisation des données, communication inter-threads)
- Ou : Réécrire `scheduleGreedy` en mode asynchrone avec yields périodiques

**Implémentation** :
- Fonction `onTryReplaceUnscheduled` asynchrone
- Calcul lancé dans une Promise avec `async/await`
- Animation en `while` loop avec `requestAnimationFrame` + `setTimeout`
- État `replacementProgress` avec `{ current, total }`
- Logs console avec durée du calcul

## Optimisation finale : découpage de `scheduleGreedy` pour éviter le blocage navigateur (13 mai 2026)

### Problématique
Malgré les indicateurs de progression, le navigateur affichait toujours "La page ne répond pas" pendant les calculs intensifs car `scheduleGreedy` était entièrement synchrone et bloquait le thread principal.

### Solution implémentée : découpage en "pulses"
`scheduleGreedy` a été transformé en fonction **asynchrone** avec des pauses périodiques pour rendre la main au navigateur :

#### 1. Modification de la signature
```typescript
// Avant
export function scheduleGreedy(
  data: PlanningData,
  grid: PlanningGridConfig,
  options?: ScheduleGreedyOptions
): PlanningData

// Après
export async function scheduleGreedy(
  data: PlanningData,
  grid: PlanningGridConfig,
  options?: ScheduleGreedyOptions
): Promise<PlanningData>
```

#### 2. Ajout de pauses dans la boucle principale
```typescript
if (bestU > 0) {
  const totalOrders = orders.length;
  for (let i = 1; i < totalOrders; i += 1) {
    const cand = greedyPlaceOrdered(...);
    // ... logique de placement ...
    
    // Pause tous les 2 itérations pour rendre la main au navigateur
    if (options?.onProgress && i % 2 === 0) {
      const progress = i / totalOrders;
      await options.onProgress(progress, `Tentative ${i}/${totalOrders} - ${bestU} séances restantes`);
    }
  }
}
```

Le callback `onProgress` utilise `await new Promise(resolve => setTimeout(resolve, 0))` pour rendre la main au navigateur entre chaque itération.

#### 3. Propagation de l'asynchronisme
Toutes les fonctions appelant `scheduleGreedy` ont été rendues asynchrones :
- `placerEtRepliquerGabaritGroupe` → `async`
- `placerSessionsNonPlanifieesCible` → `async`
- `repairPlanningVacancesEtDemarrage` → `async`
- `repairPlanningAvecVacances` → `async`
- `completerPlanningAvecSessionsNonPlanifiees` → `async`

#### 4. Harmonisation des callbacks de progression
Tous les callbacks `onProgress` utilisent maintenant la même signature :
```typescript
onProgress?: (progress: number, message: string) => Promise<void>
```
Où `progress` est entre 0 et 1 (0% à 100%).

### Résultat
✅ **Le navigateur ne bloque plus** grâce aux pauses périodiques  
✅ **L'indicateur de progression reste fluide** pendant tout le calcul  
✅ **Le message d'avertissement a été retiré** (devenu inutile)  
✅ **L'expérience utilisateur est grandement améliorée**

### Note technique
Cette solution découpe le travail synchrone en "tranches" avec des pauses asynchrones (`setTimeout(0)`) entre chaque tranche. Le navigateur peut ainsi :
- Mettre à jour l'interface utilisateur
- Traiter les événements utilisateur
- Afficher la progression en temps réel

Pour des calculs encore plus longs, une migration vers Web Workers reste possible mais n'est plus urgente avec ce découpage. Le découpage tous les 2 itérations (`i % 2 === 0`) offre un bon équilibre entre réactivité et performance.

## Historique des optimisations

- **13 mai 2026 (après-midi)** : 
  - Optimisation de la création de la Map `demandById` pour améliorer les performances
  - Ajout d'un indicateur de progression visuel pour le mode répétition
  - Ajout d'un indicateur de chargement pour le bouton de replacement manuel des séances non planifiées
  - **Transformation de `scheduleGreedy` en fonction asynchrone avec découpage en "pulses"**
  - Suppression du message d'avertissement "page ne répond pas" (devenu obsolète)
