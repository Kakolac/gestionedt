import {
  buildVerticalMergedBlocks,
  type VerticalMergedBlock,
} from "@/lib/planning/planning-merged-blocks";
import { nombreSemainesGrid, slotSemaine } from "@/lib/planning/planning-slot";
import type {
  PlanningData,
  PlanningGridConfig,
} from "@/lib/planning/planning.types";

/**
 * Tous les blocs fusionnés affichables sur la grille pour une semaine et un filtre formation,
 * même logique que `PlanningGrid` (`sessionsPourSemaine` + `buildVerticalMergedBlocks` par jour).
 */
export function listMergedBlocksForGridView(
  planningData: PlanningData,
  grid: PlanningGridConfig,
  semaineAffichee: number,
  formationAfficheeId?: string
): VerticalMergedBlock[] {
  const semaineVue = Math.min(
    nombreSemainesGrid(grid),
    Math.max(1, Math.floor(semaineAffichee) || 1)
  );
  const filtreFormation = formationAfficheeId?.trim() ?? "";
  const sessionsPourSemaine = planningData.sessions.filter((s) => {
    if (filtreFormation !== "" && s.formationId !== filtreFormation) {
      return false;
    }
    if (s.statut !== "scheduled" || s.assignedSlot == null) return false;
    return slotSemaine(s.assignedSlot) === semaineVue;
  });
  const out: VerticalMergedBlock[] = [];
  for (const jour of grid.joursSemaine) {
    out.push(
      ...buildVerticalMergedBlocks(planningData, sessionsPourSemaine, jour)
    );
  }
  return out;
}
