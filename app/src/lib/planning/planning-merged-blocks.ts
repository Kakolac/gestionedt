import type {
  PlanningData,
  PlanningSession,
} from "@/lib/planning/planning.types";

/** Bloc vertical : heures consécutives même formation + matière + prof (plusieurs séances fusionnées). */
export type VerticalMergedBlock = {
  startHour: number;
  endHour: number;
  formationId: string;
  matiereId: string;
  professeurId: string;
  sessions: PlanningSession[];
};

export function formationSortLabel(
  planningData: PlanningData,
  formationId: string
): string {
  const d = planningData.demands.find((x) => x.formationId === formationId);
  if (d?.formationNom?.trim()) return d.formationNom.trim().toLowerCase();
  const f = planningData.references.formations.find((x) => x.id === formationId);
  return (f?.nom ?? formationId).trim().toLowerCase();
}

/**
 * Regroupe les séances planifiées d’un même jour lorsque la fin d’un bloc coïncide
 * avec le début du suivant et que formation + matière + professeur sont identiques.
 * À heure identique, ordre stable par **nom de formation** (pas par ObjectId) pour les colonnes parallèles.
 */
export function buildVerticalMergedBlocks(
  planningData: PlanningData,
  sessions: readonly PlanningSession[],
  jour: number
): VerticalMergedBlock[] {
  const list = sessions
    .filter(
      (s) =>
        s.statut === "scheduled" &&
        s.assignedSlot != null &&
        s.assignedSlot.jour === jour
    )
    .slice()
    .sort((a, b) => {
      const da = a.assignedSlot!.heureDebut - b.assignedSlot!.heureDebut;
      if (da !== 0) return da;
      const fa = formationSortLabel(planningData, a.formationId);
      const fb = formationSortLabel(planningData, b.formationId);
      const dn = fa.localeCompare(fb, "fr", { sensitivity: "base" });
      if (dn !== 0) return dn;
      return a.id.localeCompare(b.id);
    });

  const out: VerticalMergedBlock[] = [];
  for (const s of list) {
    const sl = s.assignedSlot!;
    const last = out[out.length - 1];
    const sameKey =
      last != null &&
      last.formationId === s.formationId &&
      last.matiereId === s.matiereId &&
      last.professeurId === s.professeurId;
    const contiguous = last != null && last.endHour === sl.heureDebut;
    if (last != null && sameKey && contiguous) {
      last.endHour = sl.heureFin;
      last.sessions.push(s);
    } else {
      out.push({
        startHour: sl.heureDebut,
        endHour: sl.heureFin,
        formationId: s.formationId,
        matiereId: s.matiereId,
        professeurId: s.professeurId,
        sessions: [s],
      });
    }
  }
  return out;
}
