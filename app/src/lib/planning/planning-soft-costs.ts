import type {
  AssignedSlot,
  PlanningDemand,
  PlanningGridConfig,
  PlanningSession,
} from "@/lib/planning/planning.types";
import { nombreSemainesGrid, slotSemaine } from "@/lib/planning/planning-slot";

/** Pondération des préférences « souples » (aucune garantie d’optimalité globale). */
const W_GAP = 4;
const W_MATIERE_DAY = 6;
const W_SALLE_SWITCH = 8;
/** Désincitation à concentrer les heures dans peu de semaines quand l’horizon > 1. */
const W_HEURES_DEJA_EN_SEMAINE = 5;
/** Ancrage round-robin : la k-ième séance traitée favorise la semaine `(k % N) + 1` (avec N = horizon). */
const W_ANCRE_SEMAINE_ROUND_ROBIN = 4;

function hoursInSlot(slot: AssignedSlot): number[] {
  const xs: number[] = [];
  for (let h = slot.heureDebut; h < slot.heureFin; h += 1) {
    xs.push(h);
  }
  return xs;
}

function sortedHoursProfJourSemaine(
  placed: readonly PlanningSession[],
  profId: string,
  semaine: number,
  jour: number,
  extra: AssignedSlot
): number[] {
  const bag = new Set<number>();
  for (const h of hoursInSlot(extra)) {
    bag.add(h);
  }
  for (const s of placed) {
    if (s.statut !== "scheduled" || s.assignedSlot == null) continue;
    if (s.professeurId !== profId) continue;
    if (
      slotSemaine(s.assignedSlot) !== semaine ||
      s.assignedSlot.jour !== jour
    ) {
      continue;
    }
    for (const h of hoursInSlot(s.assignedSlot)) {
      bag.add(h);
    }
  }
  return [...bag].sort((a, b) => a - b);
}

/** Somme des « trous » d’une heure entre créneaux consécutifs occupés ce jour-là. */
function gapsBetweenOccupiedHours(sortedUnique: number[]): number {
  if (sortedUnique.length <= 1) return 0;
  let g = 0;
  for (let i = 0; i < sortedUnique.length - 1; i += 1) {
    const d = sortedUnique[i + 1] - sortedUnique[i];
    if (d > 1) g += d - 1;
  }
  return g;
}

function heuresDejaPoseesSemaine(
  placed: readonly PlanningSession[],
  semaine: number
): number {
  let h = 0;
  for (const s of placed) {
    if (s.statut !== "scheduled" || s.assignedSlot == null) continue;
    if (slotSemaine(s.assignedSlot) !== semaine) continue;
    h += s.duree;
  }
  return h;
}

/**
 * Coût local heuristique : trous dans la journée du prof, concentration matière le même jour,
 * changement de salle entre créneaux contigus (mode liste). Si l’horizon comporte plusieurs semaines,
 * pénalité sur les semaines déjà chargées en heures + léger ancrage round-robin pour répartir les séances.
 * Tout ce qui est « jour / semaine » ci-dessous reste borné à une même semaine que le créneau trial.
 */
export function softPlacementCost(
  trial: PlanningSession,
  demand: PlanningDemand,
  placed: readonly PlanningSession[],
  grid: PlanningGridConfig,
  placementIndex: number
): number {
  const slot = trial.assignedSlot;
  if (slot == null) return Number.POSITIVE_INFINITY;
  const jour = slot.jour;
  const semaine = slotSemaine(slot);
  let cost = 0;

  const nw = nombreSemainesGrid(grid);
  if (nw > 1) {
    cost +=
      W_HEURES_DEJA_EN_SEMAINE *
      heuresDejaPoseesSemaine(placed, semaine);
    const cible = (placementIndex % nw) + 1;
    cost += W_ANCRE_SEMAINE_ROUND_ROBIN * Math.abs(semaine - cible);
  }

  cost +=
    W_GAP *
    gapsBetweenOccupiedHours(
      sortedHoursProfJourSemaine(placed, trial.professeurId, semaine, jour, slot)
    );

  let hoursMatiereDay = trial.duree;
  for (const s of placed) {
    if (s.statut !== "scheduled" || s.assignedSlot == null) continue;
    if (
      s.professeurId !== trial.professeurId ||
      s.matiereId !== trial.matiereId ||
      s.formationId !== trial.formationId
    ) {
      continue;
    }
    if (
      slotSemaine(s.assignedSlot) !== semaine ||
      s.assignedSlot.jour !== jour
    ) {
      continue;
    }
    hoursMatiereDay += s.duree;
  }
  cost += W_MATIERE_DAY * hoursMatiereDay * hoursMatiereDay;

  if (demand.salleMode === "liste" && trial.assignedSalleId != null) {
    const sid = trial.assignedSalleId;
    for (const s of placed) {
      if (s.statut !== "scheduled" || s.assignedSlot == null) continue;
      if (s.assignedSalleId == null) continue;
      if (
        s.professeurId !== trial.professeurId ||
        slotSemaine(s.assignedSlot) !== semaine ||
        s.assignedSlot.jour !== jour
      ) {
        continue;
      }
      const os = s.assignedSlot;
      const adjacentBack = os.heureFin === slot.heureDebut;
      const adjacentFwd = slot.heureFin === os.heureDebut;
      if (adjacentBack || adjacentFwd) {
        if (s.assignedSalleId !== sid) cost += W_SALLE_SWITCH;
      }
    }
  }

  return cost;
}

export function candidateLexKey(slot: AssignedSlot, salle: string | undefined): string {
  const sk = salle ?? "";
  return `${slotSemaine(slot)}|${slot.jour}|${slot.heureDebut}|${slot.heureFin}|${sk}`;
}
