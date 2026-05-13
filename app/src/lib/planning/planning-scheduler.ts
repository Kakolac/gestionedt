import {
  matiereContrainteEstStricte,
  slotMatchesPlageHoraire,
} from "@/lib/matiereContraintes.shared";
import {
  formationPauseChevaucheCreneau,
  type FormationContrainteWire,
} from "@/lib/formationContraintes.shared";
import {
  dateCivilPourSlot,
  estJourFeriePourLocalisation,
  holidaysCalculatorAvailable,
  isoDateCivilPourSlot,
  parseIsoDateOnlyUtc,
  parseSemaine1LundiIso,
} from "@/lib/planning/planning-public-holidays";
import type { ProfesseurContrainteWire } from "@/lib/professeurContraintes.shared";
import {
  buildWeeklyTemplatePlanningData,
  canonPlanningId,
} from "@/lib/planning/planning-normalize";
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
  PlanningMaxSeanceHeuresDecoupage,
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

/** Même ordre que `iterCandidateSlots`, mais uniquement pour une semaine logique donnée (gabarit répété). */
export function iterCandidateSlotsPourSemaineFixe(
  config: PlanningGridConfig,
  duree: PlanningSeanceDureeHeures,
  semaine: number
): AssignedSlot[] {
  const out: AssignedSlot[] = [];
  const lastStart = config.heureFin - duree;
  const ss = Math.floor(semaine);
  if (!Number.isFinite(ss) || ss < 1) return out;
  for (const jour of config.joursSemaine) {
    for (let h = config.heureDebut; h <= lastStart; h += 1) {
      out.push({ semaine: ss, jour, heureDebut: h, heureFin: h + duree });
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

function formationPlacementBlocker(
  slot: AssignedSlot,
  contraintes: FormationContrainteWire[]
): string | null {
  if (contraintes.length === 0) return null;
  for (const c of contraintes) {
    switch (c.kind) {
      case "jours_formation":
        if (!new Set(c.joursSemaine).has(slot.jour)) {
          return "Jour hors des jours autorisés pour cette formation.";
        }
        break;
      case "heure_demarrage":
        if (slot.heureDebut < c.heureMin) {
          return `La formation impose un premier cours à partir de ${c.heureMin} h.`;
        }
        break;
      case "heure_fin":
        if (slot.heureFin > c.heureFinMax) {
          return `La formation impose une fin de cours au plus tard à ${c.heureFinMax} h (fin de créneau incluse).`;
        }
        break;
      case "pause_midi":
        if (
          formationPauseChevaucheCreneau(
            slot.heureDebut,
            slot.heureFin,
            c.heureDebut,
            c.heureFin
          )
        ) {
          return "Créneau en conflit avec la pause méridienne de la formation.";
        }
        break;
    }
  }
  return null;
}

/** Options du blocage dur (ex. gabarit « semaine type » du mode répété). */
export type SessionPlacementBlockerOptions = {
  /**
   * Gabarit du mode répété : ne pas bloquer sur les **jours fériés** (la réplication retomberait
   * souvent sur des fériés ; la **date de démarrage** reste toujours appliquée).
   */
  ignorerJoursFeriesPourGabaritHebdoRepete?: boolean;
};

/**
 * Motif du premier échec si la séance ne respecte pas les règles de placement
 * (grille, contraintes formation, professeur, matière, salle, cohorte, volumes).
 * `placed` doit être l’ensemble du planning **sans** `trial` (ou avec l’ancienne place de `trial` exclue).
 */
export function sessionPlacementBlocker(
  trial: PlanningSession,
  demand: PlanningDemand,
  placed: readonly PlanningSession[],
  grid: PlanningGridConfig,
  blockerOptions?: SessionPlacementBlockerOptions
): string | null {
  const slot = trial.assignedSlot;
  if (slot == null) return "Créneau non défini.";
  if (!slotWithinGrid(slot, grid)) {
    return "Créneau hors de la grille horaire autorisée.";
  }

  const blocFormation = formationPlacementBlocker(slot, demand.contraintesFormation);
  if (blocFormation) return blocFormation;

  const skipFeries =
    blockerOptions?.ignorerJoursFeriesPourGabaritHebdoRepete === true;

  const ddForm = demand.dateDemarrageIso?.trim();
  if (ddForm && parseIsoDateOnlyUtc(ddForm)) {
    if (!parseSemaine1LundiIso(grid.semaine1LundiIso)) {
      return "Calendrier incomplet : indiquez le lundi de la semaine 1 pour respecter les dates de démarrage.";
    }
    const slotDay = isoDateCivilPourSlot(grid, slot);
    if (!slotDay) {
      return "Impossible de déterminer la date civile du créneau (date de démarrage formation).";
    }
    if (slotDay < ddForm) {
      return `Avant la date de démarrage de la formation (${ddForm}).`;
    }
  }

  if (!skipFeries) {
    const paysLoc = demand.localisationPays?.trim();
    if (paysLoc) {
      if (!parseSemaine1LundiIso(grid.semaine1LundiIso)) {
        return "Calendrier incomplet : indiquez le lundi de la semaine 1 pour appliquer les jours fériés.";
      }
      const civil = dateCivilPourSlot(grid, slot);
      if (!civil) {
        return "Impossible de déterminer la date civile du créneau.";
      }
      if (!holidaysCalculatorAvailable(paysLoc, demand.localisationRegion)) {
        const sub = demand.localisationRegion?.trim();
        return sub
          ? `Calcul des jours fériés indisponible pour « ${paysLoc} » / « ${sub} ».`
          : `Calcul des jours fériés indisponible pour « ${paysLoc} ».`;
      }
      if (
        estJourFeriePourLocalisation(civil, paysLoc, demand.localisationRegion)
      ) {
        return `Jour férié (${paysLoc}) — cours non autorisé ce jour-là.`;
      }
    }
  }

  if (demand.formationDatesVacances && demand.formationDatesVacances.length > 0) {
    if (!parseSemaine1LundiIso(grid.semaine1LundiIso)) {
      return "Calendrier incomplet : indiquez le lundi de la semaine 1 pour appliquer les périodes de vacances.";
    }
    const slotDay = isoDateCivilPourSlot(grid, slot);
    if (!slotDay) {
      return "Impossible de déterminer la date civile du créneau (périodes de vacances).";
    }
    for (const periode of demand.formationDatesVacances) {
      if (slotDay >= periode.debut && slotDay <= periode.fin) {
        return `Période de vacances (${periode.nom}) — cours non autorisé pendant cette période.`;
      }
    }
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

  for (const c of demand.contraintesMatiere) {
    if (!c.actif || c.kind !== "plage_horaire") {
      continue;
    }
    if (!matiereContrainteEstStricte(c.priorite)) {
      continue;
    }
    if (
      slotMatchesPlageHoraire(slot.heureDebut, slot.heureFin, c.plage)
    ) {
      continue;
    }
    return "Hors de la plage horaire demandée pour cette matière (contrainte stricte « plage horaire »).";
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
  grid: PlanningGridConfig,
  blockerOptions?: SessionPlacementBlockerOptions
): boolean {
  return (
    sessionPlacementBlocker(trial, demand, placed, grid, blockerOptions) ===
    null
  );
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
  const activesMatiere = demand.contraintesMatiere.filter((c) => c.actif);
  score += activesMatiere.length * 8;
  for (const c of demand.contraintesMatiere) {
    if (c.actif && c.kind === "plage_horaire") {
      score += 7;
    }
  }
  if (demand.contraintesFormation.length > 0) {
    score += 24 + demand.contraintesFormation.length * 6;
  }
  if (demand.localisationPays?.trim()) {
    score += 22;
  }
  if (demand.dateDemarrageIso?.trim()) {
    score += 18;
  }
  return score;
}

function formationLabelFairSort(data: PlanningData, formationId: string): string {
  const d = data.demands.find((x) => x.formationId === formationId);
  if (d?.formationNom?.trim()) return d.formationNom.trim().toLowerCase();
  const f = data.references.formations.find((x) => x.id === formationId);
  return (f?.nom ?? formationId).trim().toLowerCase();
}

function buildFormationBuckets(
  sessions: readonly PlanningSession[]
): Map<string, PlanningSession[]> {
  const buckets = new Map<string, PlanningSession[]>();
  for (const s of sessions) {
    let arr = buckets.get(s.formationId);
    if (!arr) {
      arr = [];
      buckets.set(s.formationId, arr);
    }
    arr.push(s);
  }
  return buckets;
}

function fairFormationIdsOrdered(
  data: PlanningData,
  buckets: Map<string, PlanningSession[]>
): string[] {
  return [...buckets.keys()].sort((a, b) => {
    const cmp = formationLabelFairSort(data, a).localeCompare(
      formationLabelFairSort(data, b),
      "fr",
      { sensitivity: "base" }
    );
    if (cmp !== 0) return cmp;
    return a.localeCompare(b);
  });
}

function sortBucketSessionsByScore(
  buckets: Map<string, PlanningSession[]>,
  demandById: Map<string, PlanningDemand>,
  matiereById: Map<string, MatiereReference>
): void {
  const scoreOf = (s: PlanningSession) =>
    scoreSessionContrainte(
      s,
      demandById.get(s.demandId),
      matiereById.get(s.matiereId)
    );
  for (const arr of buckets.values()) {
    arr.sort((a, b) => {
      const sb = scoreOf(b);
      const sa = scoreOf(a);
      if (sb !== sa) return sb - sa;
      return a.id.localeCompare(b.id);
    });
  }
}

function mergeRoundRobinFormationOrder(
  buckets: Map<string, PlanningSession[]>,
  formationIds: readonly string[]
): PlanningSession[] {
  const merged: PlanningSession[] = [];
  let depth = 0;
  for (;;) {
    let any = false;
    for (const fid of formationIds) {
      const arr = buckets.get(fid);
      if (arr && depth < arr.length) {
        merged.push(arr[depth]!);
        any = true;
      }
    }
    if (!any) break;
    depth += 1;
  }
  return merged;
}

function simpleHash32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function formationIdsShuffledDeterministic(
  ids: readonly string[],
  salt: number
): string[] {
  return [...ids].sort((a, b) => {
    const ha = simpleHash32(`${salt}:${a}`);
    const hb = simpleHash32(`${salt}:${b}`);
    if (ha !== hb) return ha - hb;
    return a.localeCompare(b);
  });
}

/**
 * Ordres de traitement distincts pour le glouton : le premier ordre peut bloquer prématurément alors
 * qu’un autre libère des combinaisons valides (pas de solveur global).
 */
function collectGreedySessionOrders(
  data: PlanningData,
  demandById: Map<string, PlanningDemand>,
  matiereById: Map<string, MatiereReference>,
  orderVariantSalt = 0
): PlanningSession[][] {
  const buckets = buildFormationBuckets(data.sessions);
  const fairIds = fairFormationIdsOrdered(data, buckets);
  sortBucketSessionsByScore(buckets, demandById, matiereById);

  const scoreOf = (s: PlanningSession) =>
    scoreSessionContrainte(
      s,
      demandById.get(s.demandId),
      matiereById.get(s.matiereId)
    );

  const orders: PlanningSession[][] = [];
  const seen = new Set<string>();

  const pushOrder = (sessions: PlanningSession[]) => {
    const key = sessions.map((s) => s.id).join("\0");
    if (seen.has(key)) return;
    seen.add(key);
    orders.push(sessions);
  };

  pushOrder(mergeRoundRobinFormationOrder(buckets, fairIds));
  pushOrder(mergeRoundRobinFormationOrder(buckets, [...fairIds].reverse()));

  const nForm = fairIds.length;
  if (nForm >= 2) {
    for (let r = 1; r < nForm; r += 1) {
      const rot = [...fairIds.slice(r), ...fairIds.slice(0, r)];
      pushOrder(mergeRoundRobinFormationOrder(buckets, rot));
    }
  }

  for (let s = 0; s < 6; s += 1) {
    pushOrder(
      mergeRoundRobinFormationOrder(
        buckets,
        formationIdsShuffledDeterministic(fairIds, s * 7919 + 13 + orderVariantSalt)
      )
    );
  }

  const globalDesc = [...data.sessions].sort((a, b) => {
    const sb = scoreOf(b);
    const sa = scoreOf(a);
    if (sb !== sa) return sb - sa;
    return a.id.localeCompare(b.id);
  });
  pushOrder(globalDesc);
  pushOrder([...globalDesc].reverse());

  return orders;
}

function countUnscheduledSessions(sessions: readonly PlanningSession[]): number {
  let n = 0;
  for (const s of sessions) {
    if (s.statut === "unscheduled") n += 1;
  }
  return n;
}

/** Première semaine où existe au moins un créneau 1 h avec jour/heure grille + contraintes formation + date civile ≥ `dd`. */
function minSemainePourDemarrageDemande(
  grid: PlanningGridConfig,
  demand: PlanningDemand,
  dd: string,
  nw: number
): number | null {
  const lastStart = grid.heureFin - 1;
  for (let w = 1; w <= nw; w += 1) {
    for (const jour of grid.joursSemaine) {
      for (let h = grid.heureDebut; h <= lastStart; h += 1) {
        const slot: AssignedSlot = {
          semaine: w,
          jour,
          heureDebut: h,
          heureFin: h + 1,
        };
        if (formationPlacementBlocker(slot, demand.contraintesFormation)) {
          continue;
        }
        const day = isoDateCivilPourSlot(grid, slot);
        if (day && day >= dd) return w;
      }
    }
  }
  return null;
}

/** Semaine logique minimale pour une demande (1 si pas de date valide ou calendrier absent). */
function semaineDemarragePourDemande(
  grid: PlanningGridConfig,
  demand: PlanningDemand,
  nw: number
): number {
  const dd = demand.dateDemarrageIso?.trim();
  if (!dd || !parseIsoDateOnlyUtc(dd)) return 1;
  if (!parseSemaine1LundiIso(grid.semaine1LundiIso ?? "")) return 1;
  const mw = minSemainePourDemarrageDemande(grid, demand, dd, nw);
  return mw == null ? 1 : Math.min(mw, nw);
}

/**
 * Regroupe les demandes par **première semaine** où un cours peut s’ouvrir (date + contraintes formation).
 * Les semaines sont traitées dans l’ordre croissant ; placement séquentiel avec `seedPlaced`.
 */
function grouperDemandsParSemaineDemarrage(
  grid: PlanningGridConfig,
  demands: readonly PlanningDemand[]
): Map<number, PlanningDemand[]> {
  const nw = nombreSemainesGrid(grid);
  const map = new Map<number, PlanningDemand[]>();
  for (const d of demands) {
    const w = semaineDemarragePourDemande(grid, d, nw);
    let arr = map.get(w);
    if (!arr) {
      arr = [];
      map.set(w, arr);
    }
    arr.push(d);
  }
  return map;
}

function buildWeeklyTemplateForGroup(
  data: PlanningData,
  demandIds: ReadonlySet<string>,
  nw: number,
  maxBloc: PlanningMaxSeanceHeuresDecoupage
): PlanningData {
  const demands = data.demands.filter((d) => demandIds.has(d.id));
  const sessions = data.sessions.filter((s) => demandIds.has(s.demandId));
  return buildWeeklyTemplatePlanningData(
    { ...data, demands, sessions },
    nw,
    maxBloc
  );
}

/** Réplique les séances planifiées d’un gabarit pour **une** plage de semaines `Wp` consécutives. */
function repliquerGabaritPourPlage(
  periodResult: PlanningData,
  templateWeek: number,
  Wp: number,
  weekGlobal: number,
  groupeIndex: number,
  outerPeriodIndex: number
): PlanningSession[] {
  const out: PlanningSession[] = [];
  for (const s of periodResult.sessions) {
    if (s.statut !== "scheduled" || s.assignedSlot == null) {
      if (outerPeriodIndex === 0) {
        out.push(s);
      }
      continue;
    }
    const baseSlot = s.assignedSlot;
    for (let k = 0; k < Wp; k += 1) {
      const sem = weekGlobal + k;
      if (sem < templateWeek) continue;
      out.push({
        ...s,
        id: `${s.id}_G${groupeIndex}_P${outerPeriodIndex}_S${sem}`,
        assignedSlot: {
          ...baseSlot,
          semaine: sem,
        },
      });
    }
  }
  return out;
}

/** Place les périodes pour un groupe ; renvoie données avec séances du dernier passage utile + liste répliquée + cumul pour seed. */
function placerEtRepliquerGabaritGroupe(
  weeklyData: PlanningData,
  placementGrid: PlanningGridConfig,
  templateWeek: number,
  P: number,
  nw: number,
  groupeIndex: number,
  seedPlaced: readonly PlanningSession[]
): { replicated: PlanningSession[]; cumulativeSlice: PlanningSession[] } {
  const greedyOptsBase = {
    slotsSemaineFixe: templateWeek,
    ignorerJoursFeriesPourGabaritHebdoRepete: true,
    seedPlaced,
  } as const;

  const blockSizes = splitNwIntoNearlyEqualParts(nw, P);
  const baseline = scheduleGreedy(weeklyData, placementGrid, {
    orderVariantSalt: groupeIndex * 10_009,
    ...greedyOptsBase,
  });
  const baselineU = countUnscheduledSessions(baseline.sessions);

  const periodResults: PlanningData[] = [baseline];
  for (let p = 1; p < P; p += 1) {
    let periodResult = scheduleGreedy(weeklyData, placementGrid, {
      orderVariantSalt: groupeIndex * 10_009 + p * 97_771,
      ...greedyOptsBase,
    });
    if (countUnscheduledSessions(periodResult.sessions) > baselineU) {
      periodResult = baseline;
    }
    periodResults.push(periodResult);
  }

  let weekGlobal = 1;
  const replicated: PlanningSession[] = [];
  for (let p = 0; p < P; p += 1) {
    const Wp = blockSizes[p]!;
    const periodResult = periodResults[p]!;
    replicated.push(
      ...repliquerGabaritPourPlage(
        periodResult,
        templateWeek,
        Wp,
        weekGlobal,
        groupeIndex,
        p
      )
    );
    weekGlobal += Wp;
  }

  const cumulativeSlice = replicated.filter(
    (s) => s.statut === "scheduled" && s.assignedSlot != null
  );

  return { replicated, cumulativeSlice };
}

function sessionsSansCreneauxAvantDemarrage(
  grid: PlanningGridConfig,
  sessions: readonly PlanningSession[],
  demandById: Map<string, PlanningDemand>
): PlanningSession[] {
  const lundiOk = parseSemaine1LundiIso(grid.semaine1LundiIso ?? "");
  return sessions.map((s) => {
    if (s.statut !== "scheduled" || s.assignedSlot == null) return s;
    const d = demandById.get(s.demandId);
    const dd = d?.dateDemarrageIso?.trim();
    if (!dd || !parseIsoDateOnlyUtc(dd) || !lundiOk) return s;
    const slotDay = isoDateCivilPourSlot(grid, s.assignedSlot);
    if (!slotDay || slotDay >= dd) return s;
    return {
      ...s,
      statut: "unscheduled" as const,
      assignedSlot: undefined,
      assignedSalleId: undefined,
    };
  });
}

/**
 * Marque comme `unscheduled` les séances placées pendant les périodes de vacances
 * de leur formation. Efface créneau et salle.
 * Sans calendrier (`semaine1LundiIso` invalide), aucune modification (symétrique au blocage placement).
 */
function sessionsSansCreneauxVacances(
  grid: PlanningGridConfig,
  sessions: readonly PlanningSession[],
  demandById: Map<string, PlanningDemand>
): PlanningSession[] {
  const lundiOk = parseSemaine1LundiIso(grid.semaine1LundiIso ?? "");
  if (!lundiOk) return [...sessions];
  return sessions.map((s) => {
    if (s.statut !== "scheduled" || s.assignedSlot == null) return s;
    const demand = demandById.get(s.demandId);
    const periodes = demand?.formationDatesVacances;
    if (!periodes || periodes.length === 0) return s;
    const slotDay = isoDateCivilPourSlot(grid, s.assignedSlot);
    if (!slotDay) return s;
    for (const periode of periodes) {
      if (slotDay >= periode.debut && slotDay <= periode.fin) {
        return {
          ...s,
          statut: "unscheduled" as const,
          assignedSlot: undefined,
          assignedSalleId: undefined,
        };
      }
    }
    return s;
  });
}

/**
 * Place uniquement les sessions `unscheduled` en préservant toutes les sessions déjà `scheduled`.
 * Utilise `seedPlaced` pour éviter les collisions avec les sessions déjà placées.
 * 
 * Gain de performance : si 10% des sessions sont `unscheduled`, seul ce sous-ensemble est traité
 * au lieu de re-placer toutes les sessions (100%).
 * 
 * @param data Planning avec un mélange de sessions scheduled et unscheduled
 * @param grid Configuration de la grille horaire
 * @param options Options pour scheduleGreedy (runPostVacationRepair est forcé à false)
 * @returns Planning avec tentative de placement des sessions unscheduled, sessions scheduled inchangées
 */
function placerSessionsNonPlanifieesCible(
  data: PlanningData,
  grid: PlanningGridConfig,
  options?: ScheduleGreedyOptions
): PlanningData {
  const scheduled = data.sessions.filter((s) => s.statut === "scheduled");
  const unscheduled = data.sessions.filter((s) => s.statut === "unscheduled");

  if (unscheduled.length === 0) {
    return data;
  }

  const subData: PlanningData = {
    ...data,
    sessions: unscheduled,
  };

  const result = scheduleGreedy(subData, grid, {
    ...options,
    seedPlaced: scheduled,
    runPostVacationRepair: false,
  });

  const resultById = new Map(result.sessions.map((s) => [s.id, s] as const));
  const mergedSessions = data.sessions.map((s) => {
    const updated = resultById.get(s.id);
    return updated ?? s;
  });

  return {
    ...data,
    sessions: mergedSessions,
  };
}

/**
 * Post-traitement : retire les séances placées avant la date de démarrage
 * et pendant les périodes de vacances, puis relance un placement glouton si nécessaire.
 *
 * Le second passage utilise `placerSessionsNonPlanifieesCible` pour ne replacer que les
 * sessions marquées `unscheduled`, préservant toutes les sessions `scheduled` (optimisation perf).
 */
export function repairPlanningVacancesEtDemarrage(
  data: PlanningData,
  grid: PlanningGridConfig,
  options?: ScheduleGreedyOptions
): PlanningData {
  const demandById = new Map(data.demands.map((d) => [d.id, d] as const));
  let cleaned = sessionsSansCreneauxAvantDemarrage(
    grid,
    data.sessions,
    demandById
  );
  cleaned = sessionsSansCreneauxVacances(grid, cleaned, demandById);
  if (countUnscheduledSessions(cleaned) === 0) {
    return { ...data, sessions: cleaned };
  }
  const { runPostVacationRepair: _r, ...greedyOpts } = options ?? {};
  return placerSessionsNonPlanifieesCible(
    { ...data, sessions: cleaned },
    grid,
    greedyOpts
  );
}

/**
 * Alias : répare un planning déjà produit (retrait des créneaux invalides vacances / avant démarrage
 * puis re-placement des séances concernées).
 */
export function repairPlanningAvecVacances(
  data: PlanningData,
  grid: PlanningGridConfig,
  options?: ScheduleGreedyOptions
): PlanningData {
  return repairPlanningVacancesEtDemarrage(data, grid, options);
}

/**
 * Place uniquement les sessions non planifiées (`unscheduled`) en préservant toutes les sessions
 * déjà placées (`scheduled`). Utile après un nettoyage manuel ou pour compléter un planning incomplet.
 * 
 * Cette fonction est **beaucoup plus rapide** qu'un re-placement complet (via `scheduleGreedy` direct)
 * car elle ne traite que les sessions non planifiées au lieu de toutes les sessions.
 * 
 * **Cas d'usage** :
 * - Après avoir manuellement marqué certaines sessions comme `unscheduled`
 * - Pour compléter un planning qui a beaucoup de sessions non planifiées dues aux contraintes
 * - Après avoir modifié les contraintes et nettoyé le planning
 * 
 * **Garanties** :
 * - Les sessions `scheduled` ne sont **jamais** déplacées
 * - Les périodes de vacances sont respectées pour les nouveaux placements
 * - Les contraintes professeur/formation/salle sont vérifiées
 * 
 * @param data Planning avec un mélange de sessions scheduled et unscheduled
 * @param grid Configuration de la grille horaire
 * @param options Options pour scheduleGreedy (runPostVacationRepair est forcé à false)
 * @returns Planning avec tentative de placement des sessions unscheduled, sessions scheduled inchangées
 * 
 * @example
 * ```typescript
 * // Compléter un planning avec beaucoup de sessions non planifiées
 * const planningComplete = completerPlanningAvecSessionsNonPlanifiees(
 *   planningAvecUnscheduled,
 *   gridConfig
 * );
 * ```
 */
export function completerPlanningAvecSessionsNonPlanifiees(
  data: PlanningData,
  grid: PlanningGridConfig,
  options?: ScheduleGreedyOptions
): PlanningData {
  return placerSessionsNonPlanifieesCible(data, grid, options);
}

function greedyPlaceOrdered(
  data: PlanningData,
  grid: PlanningGridConfig,
  sorted: readonly PlanningSession[],
  demandById: Map<string, PlanningDemand>,
  matiereById: Map<string, MatiereReference>,
  blockerOptions?: SessionPlacementBlockerOptions,
  slotsSemaineFixe?: number,
  seedPlaced?: readonly PlanningSession[]
): PlanningSession[] {
  const placed: PlanningSession[] = [];
  if (seedPlaced) {
    for (const s of seedPlaced) {
      if (s.statut === "scheduled" && s.assignedSlot != null) {
        placed.push(s);
      }
    }
  }
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
    for (const slot of slotsFor(grid, session.duree, slotsSemaineFixe)) {
      for (const salle of salleCandidates(demand)) {
        const trial = sessionScheduled(session, slot, salle);
        if (!canPlaceSession(trial, demand, placed, grid, blockerOptions))
          continue;
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
      const best = feasible[0]!;
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
  return data.sessions.map((s) => {
    const u = byId.get(s.id);
    return u ?? s;
  });
}

const SLOTS_CACHE = new WeakMap<
  PlanningGridConfig,
  Partial<Record<PlanningSeanceDureeHeures, AssignedSlot[]>>
>();

function slotsFor(
  grid: PlanningGridConfig,
  duree: PlanningSeanceDureeHeures,
  semaineFixe?: number
): AssignedSlot[] {
  if (semaineFixe != null) {
    return iterCandidateSlotsPourSemaineFixe(grid, duree, semaineFixe);
  }
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
 *
 * **Plusieurs ordres d’enchaînement** (rotation / mélange des formations, tri global par score…) sont essayés
 * tant qu’il reste des séances `unscheduled` : on retient le résultat qui en minimise le nombre — le premier
 * ordre seul peut bloquer alors qu’un autre trouve une solution (heuristique, pas garantie d’optimalité).
 */
export type ScheduleGreedyOptions = {
  /** Décale les tirages d’ordre entre deux appels (ex. périodes trimestrielles avec motifs différents). */
  orderVariantSalt?: number;
  /**
   * Gabarit répété : ne tester que les créneaux de cette semaine logique (1-based).
   * La grille doit avoir **`nombreSemaines`** ≥ cette valeur.
   */
  slotsSemaineFixe?: number;
  /**
   * Gabarit répété : voir {@link SessionPlacementBlockerOptions.ignorerJoursFeriesPourGabaritHebdoRepete}.
   */
  ignorerJoursFeriesPourGabaritHebdoRepete?: boolean;
  /**
   * Séances déjà planifiées (autres gabarits / groupes) prises en compte pour les collisions
   * prof / formation / salle (mode répété multi-groupes).
   */
  seedPlaced?: readonly PlanningSession[];
  /**
   * Après le glouton, enchaîne avec {@link repairPlanningVacancesEtDemarrage}
   * (nettoyage démarrage/vacances puis **second** passage glouton si besoin).
   * Désactivé par défaut : coût élevé sur de grands horizons / beaucoup de séances.
   */
  runPostVacationRepair?: boolean;
};

export function scheduleGreedy(
  data: PlanningData,
  grid: PlanningGridConfig = DEFAULT_PLANNING_GRID,
  options?: ScheduleGreedyOptions
): PlanningData {
  const demandById = new Map(
    data.demands.map((d) => [d.id, d] as const)
  );
  const matiereById = new Map(
    data.references.matieres.map((m) => [m.id, m] as const)
  );

  const blockerOpts: SessionPlacementBlockerOptions | undefined =
    options?.ignorerJoursFeriesPourGabaritHebdoRepete
      ? { ignorerJoursFeriesPourGabaritHebdoRepete: true }
      : undefined;

  const sf = options?.slotsSemaineFixe;
  const seed = options?.seedPlaced;

  const orders = collectGreedySessionOrders(
    data,
    demandById,
    matiereById,
    options?.orderVariantSalt ?? 0
  );
  let best = greedyPlaceOrdered(
    data,
    grid,
    orders[0]!,
    demandById,
    matiereById,
    blockerOpts,
    sf,
    seed
  );
  let bestU = countUnscheduledSessions(best);

  if (bestU > 0) {
    for (let i = 1; i < orders.length; i += 1) {
      const cand = greedyPlaceOrdered(
        data,
        grid,
        orders[i]!,
        demandById,
        matiereById,
        blockerOpts,
        sf,
        seed
      );
      const u = countUnscheduledSessions(cand);
      if (u < bestU) {
        best = cand;
        bestU = u;
        if (bestU === 0) break;
      }
    }
  }

  const placed = {
    ...data,
    sessions: best,
  };
  if (options?.runPostVacationRepair) {
    const { runPostVacationRepair: _r, ...repairOpts } = options;
    return repairPlanningVacancesEtDemarrage(placed, grid, repairOpts);
  }
  return placed;
}

function splitNwIntoNearlyEqualParts(nw: number, parts: number): number[] {
  const p = Math.max(1, Math.min(nw, Math.floor(parts) || 1));
  if (p === 1) return [nw];
  const base = Math.floor(nw / p);
  const rem = nw % p;
  const out: number[] = [];
  for (let i = 0; i < p; i += 1) {
    out.push(base + (i < rem ? 1 : 0));
  }
  return out;
}

/**
 * Semaine type : le volume annuel des lignes est ramené à une **moyenne par semaine de gabarit**
 * (`buildWeeklyTemplatePlanningData`), puis **un gabarit par groupe de demandes** partageant la même
 * première semaine de démarrage possible (date + contraintes formation). Chaque gabarit est placé avec
 * `seedPlaced` = séances déjà répliquées des groupes précédents (collisions prof / formation / salle).
 *
 * Les séances `demand` / heures affichées dans les objets `demands` du résultat restent celles
 * du **`data` d’entrée** (contrat formation) ; seules les `sessions` reflètent le planning généré.
 *
 * Options :
 * - **nombrePeriodes** `1` : un seul motif répété partout.
 * - **3 / 4** : autant de **segments** consécutifs sur l’horizon (ex. trimestres) ; chaque segment
 *   applique un nouveau placement hebdo (sel) pour la même charge hebdomadaire moyenne ; si un segment
 *   produit **plus** de non planifiées que le premier passage de référence, on **réutilise** le placement
 *   du premier segment pour ce bloc (pas de dégradation volontaire).
 *
 * **Dates de démarrage** : respectées par groupe (`sessionPlacementBlocker`) ; pas de réplica sur les
 * semaines **avant** la semaine gabarit du groupe. Les **jours fériés** sont ignorés **uniquement** pendant
 * le placement du gabarit (`ignorerJoursFeriesPourGabaritHebdoRepete`).
 */
export type ScheduleGreedyRepetitionOptions = {
  nombrePeriodes?: number;
};

export function scheduleGreedyRepetitionMode(
  data: PlanningData,
  grid: PlanningGridConfig = DEFAULT_PLANNING_GRID,
  options?: ScheduleGreedyRepetitionOptions
): PlanningData {
  const nw = nombreSemainesGrid(grid);
  const P = Math.max(1, Math.min(12, Math.floor(options?.nombrePeriodes ?? 1) || 1));
  const maxBloc: 2 | 4 = grid.maxSeanceHeures === 4 ? 4 : 2;

  if (nw <= 1) {
    return scheduleGreedy(data, grid);
  }

  const placementGrid: PlanningGridConfig = { ...grid, nombreSemaines: nw };

  const groupMap = grouperDemandsParSemaineDemarrage(grid, data.demands);
  const sortedGroups = [...groupMap.entries()].sort((a, b) => a[0] - b[0]);

  const expanded: PlanningSession[] = [];
  let cumulativeSeed: PlanningSession[] = [];

  for (let gi = 0; gi < sortedGroups.length; gi += 1) {
    const [templateWeek, demandsGroupe] = sortedGroups[gi]!;
    const ids = new Set(demandsGroupe.map((d) => d.id));
    const weeklyData = buildWeeklyTemplateForGroup(data, ids, nw, maxBloc);
    if (weeklyData.sessions.length === 0) continue;

    const { replicated, cumulativeSlice } = placerEtRepliquerGabaritGroupe(
      weeklyData,
      placementGrid,
      templateWeek,
      P,
      nw,
      gi,
      cumulativeSeed
    );
    expanded.push(...replicated);
    cumulativeSeed = cumulativeSeed.concat(cumulativeSlice);
  }

  const demandByIdFinal = new Map(
    data.demands.map((d) => [d.id, d] as const)
  );
  let sessionsSorties = sessionsSansCreneauxAvantDemarrage(
    placementGrid,
    expanded,
    demandByIdFinal
  );
  sessionsSorties = sessionsSansCreneauxVacances(
    placementGrid,
    sessionsSorties,
    demandByIdFinal
  );
  return {
    ...data,
    sessions: sessionsSorties,
  };
}
