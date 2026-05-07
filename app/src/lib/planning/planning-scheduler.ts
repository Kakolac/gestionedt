import type { ProfesseurContrainteWire } from "@/lib/professeurContraintes.shared";
import { canonPlanningId } from "@/lib/planning/planning-normalize";
import {
  nombreSemainesGrid,
  slotSemaine,
} from "@/lib/planning/planning-slot";
import {
  candidateLexKey,
  softPlacementCost,
} from "@/lib/planning/planning-soft-costs";
import type {
  AssignedSlot,
  MatiereReference,
  PlanningData,
  PlanningDemand,
  PlanningGridConfig,
  PlanningSeanceDureeHeures,
  PlanningSession,
} from "@/lib/planning/planning.types";

/** Grille par défaut : lundi–vendredi, 8h–18h (18 exclue), pas 1h, une semaine. */
export const DEFAULT_PLANNING_GRID: PlanningGridConfig = {
  nombreSemaines: 1,
  joursSemaine: [1, 2, 3, 4, 5],
  heureDebut: 8,
  heureFin: 18,
  pasHeures: 1,
};

/** Créneaux 1h dans l’ordre : semaines × jours × heures. */
export function itererCreneaux(config: PlanningGridConfig): AssignedSlot[] {
  return iterCandidateSlots(config, 1);
}

/** Candidats de début pour une séance de durée `duree` (créneaux contigus 1 / 2 / 4 h). */
export function iterCandidateSlots(
  config: PlanningGridConfig,
  duree: PlanningSeanceDureeHeures
): AssignedSlot[] {
  const out: AssignedSlot[] = [];
  const lastStart = config.heureFin - duree;
  const nw = nombreSemainesGrid(config);
  for (let semaine = 1; semaine <= nw; semaine += 1) {
    for (const jour of config.joursSemaine) {
      for (let h = config.heureDebut; h <= lastStart; h += 1) {
        out.push({ semaine, jour, heureDebut: h, heureFin: h + duree });
      }
    }
  }
  return out;
}

function hoursExclusive(slot: AssignedSlot): number[] {
  const xs: number[] = [];
  for (let h = slot.heureDebut; h < slot.heureFin; h += 1) {
    xs.push(h);
  }
  return xs;
}

function intervalsOverlap(a: AssignedSlot, b: AssignedSlot): boolean {
  if (slotSemaine(a) !== slotSemaine(b)) return false;
  if (a.jour !== b.jour) return false;
  return a.heureDebut < b.heureFin && b.heureDebut < a.heureFin;
}

/** Fenêtre interdite répétée chaque semaine (jour + heures seulement). */
function forbiddenCreneauOverlapsSlot(
  slot: AssignedSlot,
  f: { jour: number; heureDebut: number; heureFin: number }
): boolean {
  if (slot.jour !== f.jour) return false;
  return slot.heureDebut < f.heureFin && f.heureDebut < slot.heureFin;
}

function slotWithinGrid(slot: AssignedSlot, grid: PlanningGridConfig): boolean {
  const ss = slotSemaine(slot);
  const ns = nombreSemainesGrid(grid);
  if (ss < 1 || ss > ns) return false;
  if (!grid.joursSemaine.includes(slot.jour)) return false;
  return (
    slot.heureDebut >= grid.heureDebut &&
    slot.heureFin <= grid.heureFin &&
    slot.heureDebut < slot.heureFin
  );
}

/**
 * Jours autorisés par l’intersection des contraintes « jours_travail » actives.
 * `null` = aucune contrainte de ce type → pas de filtre sur les jours.
 */
function intersectDaySets(a: Set<number>, b: Set<number>): Set<number> {
  const out = new Set<number>();
  for (const x of a) {
    if (b.has(x)) {
      out.add(x);
    }
  }
  return out;
}

export function joursAutorisesJoursTravail(
  contraintes: readonly ProfesseurContrainteWire[]
): Set<number> | null {
  const actives: Array<Extract<ProfesseurContrainteWire, { kind: "jours_travail" }>> =
    [];
  for (const c of contraintes) {
    if (c.actif && c.kind === "jours_travail") {
      actives.push(c);
    }
  }
  if (actives.length === 0) return null;

  let acc: Set<number> | null = null;
  for (const c of actives) {
    const jours = new Set(
      c.joursSemaine.filter((d) => d >= 1 && d <= 7)
    );
    if (jours.size === 0) continue;
    const avant: Set<number> | null = acc;
    acc = avant === null ? jours : intersectDaySets(avant, jours);
  }
  return acc ?? new Set();
}

function overlapsProfCreneauxInterdits(
  slot: AssignedSlot,
  contraintes: readonly ProfesseurContrainteWire[]
): boolean {
  for (const c of contraintes) {
    if (!c.actif || c.kind !== "creneaux_interdits") continue;
    for (const f of c.creneaux) {
      if (forbiddenCreneauOverlapsSlot(slot, f)) {
        return true;
      }
    }
  }
  return false;
}

/** Borne stricte sur `heureFin` du créneau pour ce jour (plusieurs lignes actives → minimum). */
function effHeureFinMaxPourJour(
  contraintes: readonly ProfesseurContrainteWire[],
  jour: number
): number | null {
  let m: number | null = null;
  for (const c of contraintes) {
    if (!c.actif || c.kind !== "heure_fin_max_jour") continue;
    if (c.jour !== jour) continue;
    m = m === null ? c.heureFinMax : Math.min(m, c.heureFinMax);
  }
  return m;
}

function effVolumeHeuresJourMax(
  contraintes: readonly ProfesseurContrainteWire[]
): number | null {
  const rel = contraintes.filter(
    (
      c
    ): c is ProfesseurContrainteWire & { kind: "volume_heures_jour" } =>
      c.actif && c.kind === "volume_heures_jour"
  );
  if (rel.length === 0) return null;
  let m = rel[0].maxHeuresJour;
  for (let i = 1; i < rel.length; i += 1) {
    m = Math.min(m, rel[i].maxHeuresJour);
  }
  return m;
}

function effVolumeHeuresSemaineMax(
  contraintes: readonly ProfesseurContrainteWire[]
): number | null {
  const rel = contraintes.filter(
    (
      c
    ): c is ProfesseurContrainteWire & { kind: "volume_heures_semaine" } =>
      c.actif && c.kind === "volume_heures_semaine"
  );
  if (rel.length === 0) return null;
  let m = rel[0].maxHeuresSemaine;
  for (let i = 1; i < rel.length; i += 1) {
    m = Math.min(m, rel[i].maxHeuresSemaine);
  }
  return m;
}

/** Somme des `duree` (h) du prof pour ce jour ISO et cette semaine de grille — toutes matières, toutes formations. */
function sumDureeProfJour(
  placed: readonly PlanningSession[],
  profId: string,
  semaine: number,
  jour: number
): number {
  let s = 0;
  for (const x of placed) {
    if (x.statut !== "scheduled" || x.assignedSlot == null) continue;
    if (x.professeurId !== profId) continue;
    if (
      slotSemaine(x.assignedSlot) !== semaine ||
      x.assignedSlot.jour !== jour
    ) {
      continue;
    }
    s += x.duree;
  }
  return s;
}

function sumDureeProfSemaine(
  placed: readonly PlanningSession[],
  profId: string,
  semaine: number
): number {
  let s = 0;
  for (const x of placed) {
    if (x.statut !== "scheduled" || x.assignedSlot == null) continue;
    if (x.professeurId !== profId) continue;
    if (slotSemaine(x.assignedSlot) !== semaine) continue;
    s += x.duree;
  }
  return s;
}

function effVolumeJourMax(demand: PlanningDemand): number | null {
  const rel = demand.contraintesProfesseur.filter(
    (c): c is ProfesseurContrainteWire & { kind: "volume_jour_matiere" } =>
      c.actif &&
      c.kind === "volume_jour_matiere" &&
      canonPlanningId(c.matiereId) === demand.matiereId
  );
  if (rel.length === 0) return null;
  let m = rel[0].maxCoursParJour;
  for (let i = 1; i < rel.length; i += 1) {
    m = Math.min(m, rel[i].maxCoursParJour);
  }
  return m;
}

function effBlocConsecutifMax(demand: PlanningDemand): number | null {
  const rel = demand.contraintesProfesseur.filter(
    (
      c
    ): c is ProfesseurContrainteWire & { kind: "bloc_consecutif_matiere" } =>
      c.actif &&
      c.kind === "bloc_consecutif_matiere" &&
      canonPlanningId(c.matiereId) === demand.matiereId
  );
  if (rel.length === 0) return null;
  let m = rel[0].maxHeuresConsecutives;
  for (let i = 1; i < rel.length; i += 1) {
    m = Math.min(m, rel[i].maxHeuresConsecutives);
  }
  return m;
}

function longestConsecutiveStreak(sortedUnique: readonly number[]): number {
  if (sortedUnique.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sortedUnique.length; i += 1) {
    const prev = sortedUnique[i - 1];
    const x = sortedUnique[i];
    if (x === prev) continue;
    if (x === prev + 1) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}

/** Heures occupées (entières) pour ce prof + cette matière ce jour, dans une formation donnée (cohorte). */
function heuresProfMatiereJourFormation(
  placed: readonly PlanningSession[],
  profId: string,
  matiereId: string,
  formationId: string,
  semaine: number,
  jour: number,
  extra: AssignedSlot
): number[] {
  const bag = new Set<number>();
  for (const h of hoursExclusive(extra)) {
    bag.add(h);
  }
  for (const s of placed) {
    if (s.statut !== "scheduled" || s.assignedSlot == null) continue;
    if (
      s.professeurId !== profId ||
      s.matiereId !== matiereId ||
      s.formationId !== formationId
    ) {
      continue;
    }
    if (slotSemaine(s.assignedSlot) !== semaine || s.assignedSlot.jour !== jour) {
      continue;
    }
    for (const h of hoursExclusive(s.assignedSlot)) {
      bag.add(h);
    }
  }
  return [...bag].sort((a, b) => a - b);
}

/** Nombre de séances déjà placées ce jour pour ce prof + matière + formation (export multi-classes). */
function countSeancesProfMatiereJourFormation(
  placed: readonly PlanningSession[],
  profId: string,
  matiereId: string,
  formationId: string,
  semaine: number,
  jour: number
): number {
  let n = 0;
  for (const s of placed) {
    if (s.statut !== "scheduled" || s.assignedSlot == null) continue;
    if (
      s.professeurId !== profId ||
      s.matiereId !== matiereId ||
      s.formationId !== formationId
    ) {
      continue;
    }
    if (
      slotSemaine(s.assignedSlot) !== semaine ||
      s.assignedSlot.jour !== jour
    ) {
      continue;
    }
    n += 1;
  }
  return n;
}

function salleCandidates(demand: PlanningDemand): Array<string | undefined> {
  if (demand.salleMode === "classique") {
    return [undefined];
  }
  if (demand.salleIds.length === 0) {
    return [];
  }
  return [...demand.salleIds];
}

function sessionScheduled(
  base: PlanningSession,
  slot: AssignedSlot,
  salle: string | undefined
): PlanningSession {
  const out: PlanningSession = {
    ...base,
    statut: "scheduled",
    assignedSlot: slot,
  };
  if (salle !== undefined) {
    out.assignedSalleId = canonPlanningId(salle);
  }
  return out;
}

/**
 * Motif du premier échec si la séance ne respecte pas les règles de placement
 * (grille, contraintes professeur, salle, cohorte, volumes).
 * `placed` doit être l’ensemble du planning **sans** `trial` (ou avec l’ancienne place de `trial` exclue).
 */
export function sessionPlacementBlocker(
  trial: PlanningSession,
  demand: PlanningDemand,
  placed: readonly PlanningSession[],
  grid: PlanningGridConfig
): string | null {
  const slot = trial.assignedSlot;
  if (slot == null) return "Créneau non défini.";
  if (!slotWithinGrid(slot, grid)) {
    return "Créneau hors de la grille horaire autorisée.";
  }

  const joursOk = joursAutorisesJoursTravail(demand.contraintesProfesseur);
  if (joursOk !== null && joursOk.size > 0 && !joursOk.has(slot.jour)) {
    return "Jour non autorisé par la contrainte « jours de travail ».";
  }
  if (joursOk !== null && joursOk.size === 0) {
    return "Aucun jour de travail compatible (contraintes « jours de travail »).";
  }

  if (overlapsProfCreneauxInterdits(slot, demand.contraintesProfesseur)) {
    return "Chevauchement avec une plage « créneaux interdits » du professeur.";
  }

  const finMaxJour = effHeureFinMaxPourJour(
    demand.contraintesProfesseur,
    slot.jour
  );
  if (finMaxJour !== null && slot.heureFin > finMaxJour) {
    return `Heure de fin au-delà de la limite autorisée pour ce jour (≤ ${finMaxJour} h).`;
  }

  if (demand.salleMode === "liste") {
    const sid = trial.assignedSalleId;
    if (sid == null) {
      return "Salle manquante : la matière est en mode liste de salles.";
    }
    if (!demand.salleIds.includes(sid)) {
      return "Salle assignée hors de la liste autorisée pour cette matière.";
    }
  } else if (trial.assignedSalleId !== undefined) {
    return "Cette matière n’utilise pas la liste de salles ; aucune salle ne doit être assignée.";
  }

  for (const other of placed) {
    if (other.statut !== "scheduled" || other.assignedSlot == null) continue;
    if (other.professeurId !== trial.professeurId) continue;
    if (intervalsOverlap(slot, other.assignedSlot)) {
      return "Chevauchement avec un autre cours du même professeur.";
    }
  }

  for (const other of placed) {
    if (other.statut !== "scheduled" || other.assignedSlot == null) continue;
    if (other.formationId !== trial.formationId) continue;
    if (intervalsOverlap(slot, other.assignedSlot)) {
      return "Chevauchement avec un autre cours de la même formation.";
    }
  }

  if (demand.salleMode === "liste" && trial.assignedSalleId) {
    const sid = trial.assignedSalleId;
    for (const other of placed) {
      if (other.statut !== "scheduled" || other.assignedSlot == null) continue;
      if (other.assignedSalleId === undefined) continue;
      if (other.assignedSalleId !== sid) continue;
      if (intervalsOverlap(slot, other.assignedSlot)) {
        return "La même salle est déjà occupée sur ce créneau.";
      }
    }
  }

  const vmax = effVolumeJourMax(demand);
  if (vmax !== null) {
    const sw = slotSemaine(slot);
    const c =
      countSeancesProfMatiereJourFormation(
        placed,
        trial.professeurId,
        trial.matiereId,
        trial.formationId,
        sw,
        slot.jour
      ) + 1;
    if (c > vmax) {
      return "Dépasse le nombre maximal de cours de cette matière pour ce jour (contrainte volume / jour).";
    }
  }

  const bmax = effBlocConsecutifMax(demand);
  if (bmax !== null) {
    const sw = slotSemaine(slot);
    const hoursSorted = heuresProfMatiereJourFormation(
      placed,
      trial.professeurId,
      trial.matiereId,
      trial.formationId,
      sw,
      slot.jour,
      slot
    );
    const streak = longestConsecutiveStreak(hoursSorted);
    if (streak > bmax) {
      return "Dépasse la durée maximale de bloc consécutif pour cette matière.";
    }
  }

  const vmaxHjour = effVolumeHeuresJourMax(demand.contraintesProfesseur);
  if (vmaxHjour !== null) {
    const sw = slotSemaine(slot);
    const totalJour =
      sumDureeProfJour(placed, trial.professeurId, sw, slot.jour) +
      trial.duree;
    if (totalJour > vmaxHjour) {
      return "Dépasse le volume d’heures maximal autorisé pour le professeur sur une journée.";
    }
  }

  const vmaxHsem = effVolumeHeuresSemaineMax(demand.contraintesProfesseur);
  if (vmaxHsem !== null) {
    const sw = slotSemaine(slot);
    const totalSem =
      sumDureeProfSemaine(placed, trial.professeurId, sw) + trial.duree;
    if (totalSem > vmaxHsem) {
      return "Dépasse le volume d’heures maximal autorisé pour le professeur sur une semaine.";
    }
  }

  return null;
}

function canPlaceSession(
  trial: PlanningSession,
  demand: PlanningDemand,
  placed: readonly PlanningSession[],
  grid: PlanningGridConfig
): boolean {
  return sessionPlacementBlocker(trial, demand, placed, grid) === null;
}

/**
 * Score de priorité gloutonne : plus il est élevé, plus la séance est traitée tôt
 * (2h avant 1h, salle « liste » avant « classique », plus de contraintes actives,
 * moins de jours permis par « jours_travail »).
 */
export function scoreSessionContrainte(
  session: PlanningSession,
  demand: PlanningDemand | undefined,
  matiere: MatiereReference | undefined
): number {
  if (demand == null || matiere == null) return 0;
  let score = 0;
  if (session.duree === 4) score += 220;
  else if (session.duree === 2) score += 100;
  if (matiere.salleMode === "liste") score += 50;
  const actives = demand.contraintesProfesseur.filter((c) => c.actif);
  score += actives.length * 10;
  for (const c of demand.contraintesProfesseur) {
    if (c.actif && c.kind === "creneaux_interdits") {
      score += Math.min(50, c.creneaux.length * 4);
    }
    if (c.actif && c.kind === "heure_fin_max_jour") {
      score += 6;
    }
    if (c.actif && c.kind === "volume_heures_jour") {
      score += 8;
    }
    if (c.actif && c.kind === "volume_heures_semaine") {
      score += 8;
    }
  }
  const jours = joursAutorisesJoursTravail(demand.contraintesProfesseur);
  if (jours !== null) {
    score += (7 - jours.size) * 5;
  }
  return score;
}

function formationLabelFairSort(data: PlanningData, formationId: string): string {
  const d = data.demands.find((x) => x.formationId === formationId);
  if (d?.formationNom?.trim()) return d.formationNom.trim().toLowerCase();
  const f = data.references.formations.find((x) => x.id === formationId);
  return (f?.nom ?? formationId).trim().toLowerCase();
}

/**
 * Intercale les séances formation par formation : la 1ʳᵉ la plus contrainte de A, puis la 1ʳᵉ de B, etc.,
 * avant d’enchaîner sur les 2ᵉ séances de chaque formation — évite qu’une seule cohorte monopolise
 * systématiquement les premiers choix du glouton sur les créneaux.
 */
function sessionsOrderedFairAcrossFormations(
  data: PlanningData,
  sessions: readonly PlanningSession[],
  demandById: Map<string, PlanningDemand>,
  matiereById: Map<string, MatiereReference>
): PlanningSession[] {
  const buckets = new Map<string, PlanningSession[]>();
  for (const s of sessions) {
    let arr = buckets.get(s.formationId);
    if (!arr) {
      arr = [];
      buckets.set(s.formationId, arr);
    }
    arr.push(s);
  }

  const formationIds = [...buckets.keys()].sort((a, b) => {
    const cmp = formationLabelFairSort(data, a).localeCompare(
      formationLabelFairSort(data, b),
      "fr",
      { sensitivity: "base" }
    );
    if (cmp !== 0) return cmp;
    return a.localeCompare(b);
  });

  const scoreOf = (s: PlanningSession) =>
    scoreSessionContrainte(
      s,
      demandById.get(s.demandId),
      matiereById.get(s.matiereId)
    );

  for (const fid of formationIds) {
    const arr = buckets.get(fid)!;
    arr.sort((a, b) => {
      const sb = scoreOf(b);
      const sa = scoreOf(a);
      if (sb !== sa) return sb - sa;
      return a.id.localeCompare(b.id);
    });
  }

  const merged: PlanningSession[] = [];
  let depth = 0;
  for (;;) {
    let any = false;
    for (const fid of formationIds) {
      const arr = buckets.get(fid)!;
      if (depth < arr.length) {
        merged.push(arr[depth]!);
        any = true;
      }
    }
    if (!any) break;
    depth += 1;
  }
  return merged;
}

const SLOTS_CACHE = new WeakMap<
  PlanningGridConfig,
  Partial<Record<PlanningSeanceDureeHeures, AssignedSlot[]>>
>();

function slotsFor(
  grid: PlanningGridConfig,
  duree: PlanningSeanceDureeHeures
): AssignedSlot[] {
  let rec = SLOTS_CACHE.get(grid);
  if (!rec) {
    rec = {};
    SLOTS_CACHE.set(grid, rec);
  }
  let list = rec[duree];
  if (!list) {
    list = iterCandidateSlots(grid, duree);
    rec[duree] = list;
  }
  return list;
}

/**
 * Placement glouton global : ordre des séances **équitable entre formations** (alternance round-robin :
 * priorité à la séance la plus contrainte de chaque formation avant d’en prendre une 2ᵉ du même groupe),
 * puis parmi les positions valides, choix à coût souple minimal (voir `planning-soft-costs` : équilibre inter-semaines si horizon > 1),
 * avec départage lexicographique stable sur (semaine, jour, heure, salle).
 */
export function scheduleGreedy(
  data: PlanningData,
  grid: PlanningGridConfig = DEFAULT_PLANNING_GRID
): PlanningData {
  const demandById = new Map(
    data.demands.map((d) => [d.id, d] as const)
  );
  const matiereById = new Map(
    data.references.matieres.map((m) => [m.id, m] as const)
  );

  const sorted = sessionsOrderedFairAcrossFormations(
    data,
    data.sessions,
    demandById,
    matiereById
  );

  const placed: PlanningSession[] = [];
  const out: PlanningSession[] = [];

  for (let placementIndex = 0; placementIndex < sorted.length; placementIndex += 1) {
    const session = sorted[placementIndex]!;
    const demand = demandById.get(session.demandId);
    const matiere = matiereById.get(session.matiereId);

    if (demand == null || matiere == null) {
      out.push({
        ...session,
        statut: "unscheduled",
        assignedSlot: undefined,
        assignedSalleId: undefined,
      });
      continue;
    }

    let chosen: PlanningSession | null = null;
    const feasible: Array<{
      slot: AssignedSlot;
      salle: string | undefined;
      cost: number;
      lex: string;
    }> = [];
    for (const slot of slotsFor(grid, session.duree)) {
      for (const salle of salleCandidates(demand)) {
        const trial = sessionScheduled(session, slot, salle);
        if (!canPlaceSession(trial, demand, placed, grid)) continue;
        const cost = softPlacementCost(
          trial,
          demand,
          placed,
          grid,
          placementIndex
        );
        feasible.push({
          slot,
          salle,
          cost,
          lex: candidateLexKey(slot, salle),
        });
      }
    }
    if (feasible.length > 0) {
      feasible.sort((a, b) => {
        if (a.cost !== b.cost) return a.cost - b.cost;
        return a.lex.localeCompare(b.lex);
      });
      const best = feasible[0];
      chosen = sessionScheduled(session, best.slot, best.salle);
    }

    if (chosen) {
      placed.push(chosen);
      out.push(chosen);
    } else {
      out.push({
        ...session,
        statut: "unscheduled",
        assignedSlot: undefined,
        assignedSalleId: undefined,
      });
    }
  }

  const byId = new Map(out.map((s) => [s.id, s] as const));
  const sessionsOrdered = data.sessions.map((s) => {
    const u = byId.get(s.id);
    return u ?? s;
  });

  return {
    ...data,
    sessions: sessionsOrdered,
  };
}
