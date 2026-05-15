# Optimisation : Équilibrage de la charge entre les jours de la semaine

**Date** : 13 mai 2026  
**Fichier modifié** : `app/src/lib/planning/planning-soft-costs.ts`

## Problème identifié

Après placement complet du planning (100% des séances placées), certains jours de la semaine (notamment le vendredi) se retrouvaient avec beaucoup de "trous" (créneaux vides) tandis que d'autres jours étaient plus chargés. Cela créait un déséquilibre dans la répartition hebdomadaire des cours.

## Cause racine

L'algorithme de placement `softPlacementCost` pénalisait :
- Les trous dans une **journée** pour un professeur donné (via `W_GAP`)
- La concentration d'heures d'une même **matière** le même jour (via `W_MATIERE_DAY`)
- La surcharge de certaines **semaines** en mode multi-semaines (via `W_HEURES_DEJA_EN_SEMAINE`)

Mais il **ne pénalisait PAS** le fait d'avoir des jours entiers sous-utilisés par rapport à d'autres jours.

## Solution implémentée

Ajout d'une nouvelle composante de coût qui favorise les jours moins chargés pour équilibrer naturellement la répartition des cours dans la semaine.

### Modifications du code

#### 1. Nouvelle constante de pondération

```typescript
/** Équilibrage : favorise les jours moins chargés pour éviter d'avoir des jours vides et d'autres surchargés. */
const W_EQUILIBRAGE_JOUR = 3;
```

**Valeur choisie** : `3` offre un bon équilibre initial. Cette valeur peut être ajustée :
- **Augmenter (5-7)** : renforce l'équilibrage (plus contraignant)
- **Réduire (1-2)** : équilibrage plus léger (plus de liberté)

#### 2. Nouvelle fonction de calcul

```typescript
/**
 * Calcule le nombre d'heures déjà placées sur un jour spécifique d'une semaine.
 * Utilisé pour équilibrer la charge entre les jours de la semaine.
 */
function heuresDejaPlaceesJour(
  placed: readonly PlanningSession[],
  semaine: number,
  jour: number
): number {
  let h = 0;
  for (const s of placed) {
    if (s.statut !== "scheduled" || s.assignedSlot == null) continue;
    if (slotSemaine(s.assignedSlot) !== semaine) continue;
    if (s.assignedSlot.jour !== jour) continue;
    h += s.duree;
  }
  return h;
}
```

#### 3. Intégration dans `softPlacementCost`

```typescript
// Équilibrage des jours : favorise les jours moins chargés pour mieux répartir
const heuresJour = heuresDejaPlaceesJour(placed, semaine, jour);
cost += W_EQUILIBRAGE_JOUR * heuresJour;
```

Cette pénalité est appliquée **pour toutes les semaines** (pas seulement en mode multi-semaines), car l'équilibrage des jours est pertinent même sur une seule semaine.

## Fonctionnement

L'algorithme calcule maintenant, pour chaque créneau candidat :
1. Le nombre total d'heures déjà placées sur ce jour
2. Applique une pénalité proportionnelle : plus le jour est chargé, moins il est attractif

**Effet** : L'algorithme préfère naturellement placer les nouvelles séances sur les jours moins chargés, ce qui équilibre la répartition hebdomadaire.

## Résultat attendu

✅ **Meilleure répartition** : Les cours sont mieux répartis entre les jours de la semaine  
✅ **Moins de trous le vendredi** : Les jours en fin de semaine sont plus équilibrés  
✅ **Planning plus harmonieux** : Charge plus uniforme sur la semaine  
✅ **Aucun impact négatif** : Les autres contraintes (trous prof, plages horaires, etc.) restent respectées

## Ajustement du paramètre

Si l'équilibrage n'est pas suffisant ou trop contraignant, modifier la valeur de `W_EQUILIBRAGE_JOUR` dans le fichier `planning-soft-costs.ts` :

```typescript
// Équilibrage léger (plus de liberté)
const W_EQUILIBRAGE_JOUR = 1;

// Équilibrage modéré (valeur par défaut)
const W_EQUILIBRAGE_JOUR = 3;

// Équilibrage fort (plus contraignant)
const W_EQUILIBRAGE_JOUR = 7;
```

## Notes techniques

- Cette optimisation fonctionne au niveau de la **fonction de coût heuristique**
- Elle ne garantit pas une optimalité globale (l'algorithme greedy fait des choix locaux)
- L'équilibrage se fait **par semaine** : chaque semaine est équilibrée indépendamment
- Compatible avec toutes les autres contraintes et optimisations existantes

## Tests recommandés

1. Générer un planning avec l'ancienne version et noter la répartition par jour
2. Générer le même planning avec la nouvelle version
3. Comparer la distribution des heures par jour (lundi-vendredi)
4. Vérifier que les jours précédemment sous-utilisés (ex: vendredi) sont mieux remplis
5. Confirmer que les contraintes dures (vacances, démarrage, etc.) sont toujours respectées

## Évolutions futures possibles

Si l'équilibrage actuel n'est pas suffisant, d'autres optimisations peuvent être envisagées :

### Option A : Pénalité sur la densité
Pénaliser les jours qui ont beaucoup de trous ET peu de cours (journées "creuses").

### Option B : Pénalité spécifique sur certains jours
Favoriser ou défavoriser certains jours spécifiquement (ex: éviter le lundi matin, favoriser le mardi).

### Option C : Équilibrage global post-placement
Après le placement initial, réorganiser les séances pour optimiser l'équilibrage global (algorithme de swap).

Pour l'instant, l'Option 1 (implémentée) devrait suffire pour résoudre le problème des jours déséquilibrés.
