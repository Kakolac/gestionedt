import type { AssignedSlot } from "@/lib/planning/planning.types";
import { slotSemaine } from "@/lib/planning/planning-slot";

/** Chevauchement temporel strict sur la même semaine et le même jour ISO. */
export function assignedSlotsOverlap(a: AssignedSlot, b: AssignedSlot): boolean {
  if (slotSemaine(a) !== slotSemaine(b)) return false;
  if (a.jour !== b.jour) return false;
  return a.heureDebut < b.heureFin && b.heureDebut < a.heureFin;
}
