import type {
  PlanningData,
  PlanningGridConfig,
  PlanningSession,
} from "@/lib/planning/planning.types";
import {
  nombreSemainesGrid,
  slotSemaine,
} from "@/lib/planning/planning-slot";
import { sessionPlacementBlocker } from "@/lib/planning/planning-scheduler";

export type ManualSwapProfessorConstraintIssue = {
  professeurId: string;
  professeurLabel: string;
  /** Une ligne par séance concernée (créneau + cours + motif). */
  lignes: string[];
};

function slotRecapSéance(
  session: PlanningSession,
  horizonSemaines: number
): string {
  const sl = session.assignedSlot;
  if (sl == null) return "—";
  const sw = slotSemaine(sl);
  const prefix = horizonSemaines > 1 ? `S${sw} ` : "";
  return `${prefix}J${sl.jour} ${sl.heureDebut}h–${sl.heureFin}h`;
}

function professeurLabelFromPlanning(
  planning: PlanningData,
  professeurId: string,
  fallbackNom: string
): string {
  const ref = planning.references.professeurs.find((p) => p.id === professeurId);
  if (ref) {
    const n = `${ref.prenom ?? ""} ${ref.nom ?? ""}`.trim();
    if (n) return n;
  }
  const t = fallbackNom.trim();
  if (t) return t;
  return professeurId;
}

/**
 * Après un échange de blocs réussi (créneaux + salles), vérifie pour chaque séance
 * déplacée que le **professeur titulaire** de la séance supporte toujours son nouveau
 * créneau selon les mêmes règles que le moteur (`sessionPlacementBlocker`).
 */
export function collectProfessorConstraintIssuesAfterSwap(
  blockSessionsA: readonly PlanningSession[],
  blockSessionsB: readonly PlanningSession[],
  swappedSessions: readonly PlanningSession[],
  grid: PlanningGridConfig,
  planning: PlanningData
): ManualSwapProfessorConstraintIssue[] {
  const affected = new Set<string>();
  for (const s of blockSessionsA) affected.add(s.id);
  for (const s of blockSessionsB) affected.add(s.id);

  const demandById = new Map(planning.demands.map((d) => [d.id, d]));
  const horizon = nombreSemainesGrid(grid);

  const byProf = new Map<
    string,
    { label: string; lignes: string[] }
  >();

  const sessionById = new Map(swappedSessions.map((s) => [s.id, s]));

  for (const id of affected) {
    const session = sessionById.get(id);
    if (
      session == null ||
      session.statut !== "scheduled" ||
      session.assignedSlot == null
    ) {
      continue;
    }
    const demand = demandById.get(session.demandId);
    if (demand == null) continue;

    const placed = swappedSessions.filter(
      (s) =>
        s.id !== session.id &&
        s.statut === "scheduled" &&
        s.assignedSlot != null
    );

    const blocker = sessionPlacementBlocker(
      session,
      demand,
      placed,
      grid
    );
    if (blocker == null) continue;

    const label = professeurLabelFromPlanning(
      planning,
      session.professeurId,
      demand.professeurNom
    );
    let row = byProf.get(session.professeurId);
    if (!row) {
      row = { label, lignes: [] };
      byProf.set(session.professeurId, row);
    }
    const cr = slotRecapSéance(session, horizon);
    row.lignes.push(
      `${cr} · ${demand.formationNom} / ${demand.matiereNom} (${session.duree} h) — ${blocker}`
    );
  }

  const out: ManualSwapProfessorConstraintIssue[] = [];
  for (const [professeurId, { label, lignes }] of byProf) {
    out.push({
      professeurId,
      professeurLabel: label,
      lignes: lignes.slice().sort((a, b) => a.localeCompare(b, "fr")),
    });
  }
  out.sort((a, b) =>
    a.professeurLabel.localeCompare(b.professeurLabel, "fr", {
      sensitivity: "base",
    })
  );
  return out;
}
