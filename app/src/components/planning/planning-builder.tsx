"use client";

import { useEffect, useMemo, useState } from "react";
import { PlanningGrid } from "@/components/planning/planning-grid";
import { normalizePlanningExport } from "@/lib/planning/planning-normalize";
import {
  nombreSemainesGrid,
  slotSemaine,
} from "@/lib/planning/planning-slot";
import {
  DEFAULT_PLANNING_GRID,
  scheduleGreedy,
} from "@/lib/planning/planning-scheduler";
import type {
  PlanningData,
  PlanningExportRaw,
  PlanningGridConfig,
  PlanningSession,
} from "@/lib/planning/planning.types";

export type PlanningBuilderProps = {
  rawData: PlanningExportRaw;
  /** Fusionné avec [`DEFAULT_PLANNING_GRID`](../lib/planning/planning-scheduler.ts) ; champs omis = défauts. */
  gridConfig?: Partial<PlanningGridConfig>;
  /**
   * Nombre de semaines **distinctes** pour le placement (semaine × jour × heures).
   * Prioritaire sur `gridConfig.nombreSemaines` lorsqu’elle est fournie.
   */
  nombreSemainesRepetition?: number;
};

function sessionResume(
  s: PlanningSession,
  planning: PlanningData,
  horizonSemaines: number
): string {
  const d = planning.demands.find((x) => x.id === s.demandId);
  if (!d) return s.id;
  const sl = s.assignedSlot;
  const prefixWeek =
    sl != null && horizonSemaines > 1 ? `S${slotSemaine(sl)} ` : "";
  const slot =
    sl != null
      ? `${prefixWeek}J${sl.jour} ${sl.heureDebut}h–${sl.heureFin}h`
      : "—";
  const salle =
    s.assignedSalleId != null ? ` · salle …${s.assignedSalleId.slice(-4)}` : "";
  return `${d.formationNom} / ${d.matiereNom} / ${d.professeurNom} — ${s.duree}h — ${slot}${salle}`;
}

/**
 * Normalise l’export JSON brut, construit les demandes / séances et exécute le placement glouton global.
 */
export function PlanningBuilder({
  rawData,
  gridConfig = DEFAULT_PLANNING_GRID,
  nombreSemainesRepetition,
}: PlanningBuilderProps) {
  const gridEffectif = useMemo(() => {
    const base = { ...DEFAULT_PLANNING_GRID, ...gridConfig };
    if (nombreSemainesRepetition != null) {
      const ns = Math.min(
        52,
        Math.max(1, Math.floor(Number(nombreSemainesRepetition)) || 1)
      );
      return { ...base, nombreSemaines: ns };
    }
    return base;
  }, [gridConfig, nombreSemainesRepetition]);

  const horizonNs = nombreSemainesGrid(gridEffectif);

  const [semaineCourante, setSemaineCourante] = useState(1);

  useEffect(() => {
    setSemaineCourante((prev) => Math.min(Math.max(1, prev), horizonNs));
  }, [horizonNs]);

  const planningData = useMemo(() => {
    const normalized = normalizePlanningExport(rawData, gridEffectif);
    return scheduleGreedy(normalized, gridEffectif);
  }, [rawData, gridEffectif]);

  const scheduled = useMemo(
    () => planningData.sessions.filter((s) => s.statut === "scheduled"),
    [planningData.sessions]
  );

  const unscheduled = useMemo(
    () => planningData.sessions.filter((s) => s.statut === "unscheduled"),
    [planningData.sessions]
  );

  const jsonPretty = useMemo(
    () => JSON.stringify(planningData, null, 2),
    [planningData]
  );

  return (
    <div className="flex w-full max-w-[min(96vw,120rem)] flex-col gap-[2.5vh] px-[2vw] py-[2.5vh] text-slate-900">
      <header className="max-w-4xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
          Planning
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-[clamp(1.35rem,2.4vw,1.85rem)] font-semibold tracking-tight text-transparent">
          PlanningBuilder
        </h1>
        <p className="mt-2 text-[clamp(0.9rem,1.35vw,1.05rem)] leading-relaxed text-slate-600">
          Données normalisées et placement glouton multi-formations. Les créneaux
          candidats sont répliqués sur{" "}
          <strong>{horizonNs}</strong> semaine
          {horizonNs > 1 ? "s" : ""} (indices S1 … S{horizonNs}) : même grille jour ×
          heures pour chaque semaine, avec contraintes appliquées **par semaine**
          (prof, formation, salle, volume et blocs consécutifs sur un même jour ISO).
          Les « créneaux interdits » professeur se répètent **chaque** semaine.
        </p>
        <p className="mt-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-[2vw] py-[1.25vh] text-[clamp(0.82rem,1.2vw,0.95rem)] text-amber-950">
          <strong>Salles :</strong> en mode <code className="text-[0.85em]">classique</code>
          , aucune salle n&apos;est affectée dans les données : le moteur ne peut pas
          empêcher deux cours différents d&apos;occuper physiquement la même salle. Pour
          ce contrôle, utilisez <code className="text-[0.85em]">liste</code> avec des{" "}
          <code className="text-[0.85em]">salleIds</code>.
        </p>
      </header>

      <section className="space-y-[1.25vh]">
        <div className="flex flex-wrap items-end justify-between gap-[2vw]">
          <h2 className="text-[clamp(0.95rem,1.4vw,1.1rem)] font-semibold text-indigo-950">
            Grille {horizonNs > 1 ? "de la semaine sélectionnée" : "hebdomadaire"}
          </h2>
          {horizonNs > 1 ? (
            <label className="flex flex-wrap items-center gap-[1.5vw] text-[clamp(0.82rem,1.15vw,0.95rem)] text-slate-700">
              <span className="font-medium text-slate-800">Afficher la semaine</span>
              <select
                value={semaineCourante}
                onChange={(e) =>
                  setSemaineCourante(
                    Math.min(
                      horizonNs,
                      Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                    )
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-[2vw] py-[1vh] text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
              >
                {Array.from({ length: horizonNs }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>
                    Semaine {w} / {horizonNs}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <PlanningGrid
          planningData={planningData}
          grid={gridEffectif}
          semaineAffichee={semaineCourante}
        />
      </section>

      <section className="grid gap-[2.5vh] lg:grid-cols-2">
        <div className="flex min-h-[24vh] flex-col gap-2">
          <h2 className="text-[clamp(0.95rem,1.4vw,1.1rem)] font-semibold text-indigo-950">
            Séances planifiées ({scheduled.length})
          </h2>
          <ul className="max-h-[36vh] list-none space-y-2 overflow-y-auto rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-[clamp(0.8rem,1.15vw,0.95rem)] leading-snug shadow-[0_8px_30px_rgba(49,46,129,0.07)]">
            {scheduled.map((s) => (
              <li
                key={s.id}
                className="border-b border-indigo-100/80 pb-2 last:border-b-0 last:pb-0"
              >
                {sessionResume(s, planningData, horizonNs)}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex min-h-[24vh] flex-col gap-2">
          <h2 className="text-[clamp(0.95rem,1.4vw,1.1rem)] font-semibold text-fuchsia-900">
            Séances non planifiées ({unscheduled.length})
          </h2>
          <ul className="max-h-[36vh] list-none space-y-2 overflow-y-auto rounded-2xl border border-fuchsia-200/70 bg-gradient-to-br from-fuchsia-50/90 via-white to-amber-50/40 px-4 py-3 text-[clamp(0.8rem,1.15vw,0.95rem)] leading-snug text-fuchsia-950 shadow-[0_8px_28px_rgba(192,38,211,0.08)]">
            {unscheduled.map((s) => (
              <li
                key={s.id}
                className="border-b border-fuchsia-200/40 pb-2 last:border-b-0 last:pb-0"
              >
                {sessionResume(s, planningData, horizonNs)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex min-h-[28vh] flex-col gap-2">
        <details className="group rounded-2xl border border-indigo-200/60 bg-white/85 shadow-[0_8px_30px_rgba(49,46,129,0.06)]">
          <summary className="cursor-pointer select-none px-4 py-3 text-[clamp(0.95rem,1.4vw,1.05rem)] font-semibold text-indigo-900 marker:text-indigo-500">
            planningData (JSON normalisé) — afficher / masquer
          </summary>
          <pre className="max-h-[45vh] overflow-auto border-t border-indigo-200/40 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 p-4 text-[clamp(0.72rem,1.05vw,0.85rem)] leading-relaxed text-sky-100/95">
            {jsonPretty}
          </pre>
        </details>
      </section>
    </div>
  );
}
