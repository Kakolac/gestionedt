import { assignedSlotsOverlap } from "@/lib/planning/planning-assigned-slot-overlap";
import { slotSemaine } from "@/lib/planning/planning-slot";
import type { PlanningSession } from "@/lib/planning/planning.types";

function slotSpanHours(s: PlanningSession): number | null {
  const sl = s.assignedSlot;
  if (sl == null) return null;
  const span = sl.heureFin - sl.heureDebut;
  return span > 0 ? span : null;
}

/** Séances planifiées triées par semaine, jour, heure de début, id. */
export function sortScheduledSessionsBySlot(
  sessions: readonly PlanningSession[]
): PlanningSession[] {
  return sessions
    .filter((s) => s.statut === "scheduled" && s.assignedSlot != null)
    .slice()
    .sort((a, b) => {
      const sla = a.assignedSlot!;
      const slb = b.assignedSlot!;
      const wa = slotSemaine(sla);
      const wb = slotSemaine(slb);
      if (wa !== wb) return wa - wb;
      if (sla.jour !== slb.jour) return sla.jour - slb.jour;
      if (sla.heureDebut !== slb.heureDebut) {
        return sla.heureDebut - slb.heureDebut;
      }
      return a.id.localeCompare(b.id);
    });
}

/**
 * Détecte chevauchements entre séances planifiées pour un même professeur
 * ou pour une même formation.
 */
export function detectManualSwapViolations(
  sessions: readonly PlanningSession[]
): string | null {
  const placed = sessions.filter(
    (s) => s.statut === "scheduled" && s.assignedSlot != null
  );
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placed[i]!;
      const b = placed[j]!;
      const sla = a.assignedSlot!;
      const slb = b.assignedSlot!;
      if (!assignedSlotsOverlap(sla, slb)) continue;
      if (a.professeurId === b.professeurId) {
        return "Ce réglage ferait se chevaucher deux cours pour le même professeur.";
      }
      if (a.formationId === b.formationId) {
        return "Ce réglage ferait se chevaucher deux cours pour la même formation.";
      }
    }
  }
  return null;
}

export type ManualSwapResult =
  | { ok: true; sessions: PlanningSession[] }
  | { ok: false; error: string };

/**
 * Échange créneaux et salles entre deux blocs fusionnés (listes de séances déjà isolées).
 * Les séances sont appariées par rang après tri par créneau.
 */
export function trySwapMergedBlockSessions(
  blockSessionsA: readonly PlanningSession[],
  blockSessionsB: readonly PlanningSession[],
  allSessions: readonly PlanningSession[]
): ManualSwapResult {
  const sortedA = sortScheduledSessionsBySlot(blockSessionsA);
  const sortedB = sortScheduledSessionsBySlot(blockSessionsB);

  if (sortedA.length === 0 || sortedB.length === 0) {
    return {
      ok: false,
      error: "Impossible d’échanger : une des sélections ne contient pas de séance planifiée.",
    };
  }

  const idsA = new Set(sortedA.map((s) => s.id));
  const idsB = new Set(sortedB.map((s) => s.id));
  for (const id of idsA) {
    if (idsB.has(id)) {
      return {
        ok: false,
        error: "Sélectionnez deux blocs différents pour intervertir.",
      };
    }
  }

  if (sortedA.length !== sortedB.length) {
    return {
      ok: false,
      error:
        "Les deux blocs n’ont pas la même découpe en séances (nombre de créneaux différent).",
    };
  }

  for (let i = 0; i < sortedA.length; i += 1) {
    const ai = sortedA[i]!;
    const bi = sortedB[i]!;
    const spanA = slotSpanHours(ai);
    const spanB = slotSpanHours(bi);
    if (spanA == null || spanB == null) {
      return { ok: false, error: "Créneau invalide dans la sélection." };
    }
    if (ai.duree !== bi.duree || spanA !== spanB || spanA !== ai.duree || spanB !== bi.duree) {
      return {
        ok: false,
        error:
          "Les deux blocs n’ont pas la même découpe en séances (durées ou créneaux incompatibles).",
      };
    }
  }

  const next = allSessions.map((s) => {
    const ia = sortedA.findIndex((x) => x.id === s.id);
    if (ia >= 0) {
      const bi = sortedB[ia]!;
      return {
        ...s,
        assignedSlot: bi.assignedSlot ? { ...bi.assignedSlot } : undefined,
        assignedSalleId: bi.assignedSalleId,
      };
    }
    const ib = sortedB.findIndex((x) => x.id === s.id);
    if (ib >= 0) {
      const ai = sortedA[ib]!;
      return {
        ...s,
        assignedSlot: ai.assignedSlot ? { ...ai.assignedSlot } : undefined,
        assignedSalleId: ai.assignedSalleId,
      };
    }
    return s;
  });

  const violation = detectManualSwapViolations(next);
  if (violation != null) {
    return { ok: false, error: violation };
  }

  return { ok: true, sessions: next };
}
