import type { AssignedSlot, PlanningGridConfig } from "@/lib/planning/planning.types";

/** Semaine 1-based ; valeur invalide ou absente → 1 (compatibilité JSON ancien). */
export function slotSemaine(slot: AssignedSlot): number {
  const n = slot.semaine;
  return typeof n === "number" && Number.isFinite(n) && n >= 1
    ? Math.floor(n)
    : 1;
}

/** Nombre de semaines dans l’horizon, entre 1 et 52. */
export function nombreSemainesGrid(grid: PlanningGridConfig): number {
  const n = grid.nombreSemaines;
  if (typeof n !== "number" || !Number.isFinite(n)) return 1;
  const f = Math.floor(n);
  if (f < 1) return 1;
  return Math.min(52, f);
}
