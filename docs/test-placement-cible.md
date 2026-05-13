# Test du placement ciblé des sessions non planifiées

## Objectif

Vérifier que la nouvelle fonction `placerSessionsNonPlanifieesCible` et `completerPlanningAvecSessionsNonPlanifiees` fonctionnent correctement et apportent les gains de performance attendus.

## Cas de test

### 1. Planning sans sessions unscheduled

**Entrée** : Planning avec toutes les sessions `scheduled`

**Attendu** : Retour immédiat sans modification

**Vérification** :
```typescript
const planning = { ...data, sessions: sessions.map(s => ({ ...s, statut: 'scheduled' })) };
const result = completerPlanningAvecSessionsNonPlanifiees(planning, grid);
// result === planning (référence identique car return immédiat)
// result.sessions.every(s => s.statut === 'scheduled') === true
```

### 2. Planning avec sessions unscheduled

**Entrée** : Planning avec 100 sessions `scheduled` et 20 sessions `unscheduled`

**Attendu** : 
- Toutes les sessions `scheduled` restent inchangées (même slot, même salle)
- Les sessions `unscheduled` sont tentées de placement
- Aucune session `scheduled` n'est déplacée

**Vérification** :
```typescript
const scheduledBefore = planning.sessions.filter(s => s.statut === 'scheduled');
const result = completerPlanningAvecSessionsNonPlanifiees(planning, grid);
const scheduledAfter = result.sessions.filter(s => s.statut === 'scheduled' && 
  scheduledBefore.some(sb => sb.id === s.id && 
    sb.assignedSlot === s.assignedSlot &&
    sb.assignedSalleId === s.assignedSalleId
  )
);
// scheduledAfter.length === scheduledBefore.length
// Toutes les sessions scheduled initiales ont le même slot et salle
```

### 3. Respect des périodes de vacances

**Entrée** : 
- Planning avec sessions `unscheduled`
- Formation avec périodes de vacances définies
- Calendrier complet (`semaine1LundiIso`)

**Attendu** : Les sessions `unscheduled` ne sont PAS placées pendant les périodes de vacances

**Vérification** :
```typescript
const result = completerPlanningAvecSessionsNonPlanifiees(planning, grid);
const scheduledDuringVacation = result.sessions.filter(s => {
  if (s.statut !== 'scheduled' || !s.assignedSlot) return false;
  const slotDay = isoDateCivilPourSlot(grid, s.assignedSlot);
  const demand = data.demands.find(d => d.id === s.demandId);
  if (!demand || !demand.formationDatesVacances) return false;
  return demand.formationDatesVacances.some(p => 
    slotDay >= p.debut && slotDay <= p.fin
  );
});
// scheduledDuringVacation.length === 0
```

### 4. Gain de performance

**Entrée** : Planning de 1000 sessions dont 100 `unscheduled`

**Attendu** : Placement ciblé beaucoup plus rapide que placement complet

**Vérification** :
```typescript
// Mesure temps placement complet
const t1 = performance.now();
const resultComplet = scheduleGreedy(planning, grid);
const tempsComplet = performance.now() - t1;

// Mesure temps placement ciblé
const t2 = performance.now();
const resultCible = completerPlanningAvecSessionsNonPlanifiees(planning, grid);
const tempsCible = performance.now() - t2;

// tempsCible < tempsComplet / 5  (au moins 5x plus rapide)
console.log(`Placement complet: ${tempsComplet}ms`);
console.log(`Placement ciblé: ${tempsCible}ms`);
console.log(`Gain: ${(tempsComplet / tempsCible).toFixed(1)}x`);
```

### 5. Intégration avec repairPlanningVacancesEtDemarrage

**Entrée** : Planning avec sessions placées dans des périodes de vacances

**Attendu** : 
- Nettoyage marque les sessions en vacances comme `unscheduled`
- Placement ciblé tente de les replacer en dehors des vacances
- Sessions déjà bien placées ne bougent pas

**Vérification** :
```typescript
const result = repairPlanningAvecVacances(planning, grid);
// Aucune session scheduled ne doit être dans une période de vacances
// Sessions initialement OK ne doivent pas avoir bougé
```

## Tests manuels dans l'UI

### Test 1 : Créer un planning avec vacances

1. Ouvrir Administration > Création formation
2. Modifier une formation pour ajouter des périodes de vacances (ex: du 2026-01-01 au 2026-01-15)
3. Aller dans le planning builder
4. Générer le planning
5. **Vérifier** : Aucune session n'est planifiée pendant les vacances
6. **Vérifier** : Les sessions non planifiées sont affichées dans la liste rouge

### Test 2 : Vérifier la stabilité des sessions placées

1. Générer un planning complet
2. Noter quelques sessions placées (professeur, jour, heure)
3. Ajouter des périodes de vacances qui ne chevauchent PAS ces sessions
4. Régénérer le planning
5. **Vérifier** : Les sessions notées sont toujours aux mêmes emplacements

### Test 3 : Performance avec grand planning

1. Créer un export avec plusieurs formations (≥3)
2. Définir beaucoup d'heures prévues (≥500h total)
3. Définir des périodes de vacances larges (ex: 2 mois d'été)
4. Générer le planning en mode répétition (52 semaines)
5. **Observer** : Le temps de génération doit rester raisonnable (<30 secondes)
6. **Vérifier** : Les sessions non planifiées (dues aux vacances) ne bloquent pas l'UI

## Résultats attendus

✅ **Aucune régression** : Le comportement du planning reste identique pour les cas sans vacances

✅ **Performance améliorée** : Le placement ciblé est 5-10x plus rapide que le placement complet

✅ **Sessions protégées** : Les sessions `scheduled` ne sont jamais déplacées par le placement ciblé

✅ **Vacances respectées** : Aucune session ne peut être placée pendant les périodes de vacances

✅ **Transparence** : Le changement est transparent pour l'utilisateur (pas de changement d'UI)

## Vérification de la compilation

```bash
cd app
npx tsc --noEmit
```

**Attendu** : Exit code 0, pas d'erreurs TypeScript

## Vérification des linters

```bash
cd app
npm run lint
```

**Attendu** : Pas d'erreurs de linting

## Checklist finale

- [x] TypeScript compile sans erreurs
- [x] Pas d'erreurs de linter
- [x] Fonctions exportées correctement
- [x] Documentation mise à jour
- [x] Code commenté avec JSDoc
- [ ] Tests manuels dans l'UI (à faire par l'utilisateur)
- [ ] Tests de performance (à mesurer en situation réelle)

## Notes de test

- Le placement ciblé utilise `seedPlaced` pour protéger les sessions `scheduled`
- Le `sessionPlacementBlocker` vérifie toujours les périodes de vacances
- `runPostVacationRepair: false` évite la récursion infinie
- Le code existant n'a pas besoin d'être modifié (rétrocompatible)
