"use client";

import { useCallback, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { PlanningGridContextMenu } from "@/components/planning/planning-grid-context-menu";
import {
  PlanningGrid,
  type VerticalMergedBlock,
} from "@/components/planning/planning-grid";
import { normalizePlanningExport } from "@/lib/planning/planning-normalize";
import { trySwapMergedBlockSessions } from "@/lib/planning/planning-manual-swap";
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

/** Remonte `PlanningBuilderBody` pour réinitialiser sélection / retouches manuelles. */
function planningBuilderResetKey(
  raw: PlanningExportRaw,
  grid: PlanningGridConfig
): string {
  const meta = raw.meta;
  const fs = raw.formations;
  const ms = raw.matieres;
  const ps = raw.professeurs;
  const nF = Array.isArray(fs) ? fs.length : 0;
  const nM = Array.isArray(ms) ? ms.length : 0;
  const nP = Array.isArray(ps) ? ps.length : 0;
  const ids = [...(meta?.formationIdsRequested ?? [])].sort().join(",");
  return [
    meta?.exportedAt ?? "",
    String(meta?.version ?? ""),
    ids,
    nF,
    nM,
    nP,
    grid.nombreSemaines ?? 1,
    grid.maxSeanceHeures ?? "",
    grid.heureDebut,
    grid.heureFin,
    grid.joursSemaine.join(","),
  ].join("|");
}

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

function blocksSameSessionSet(
  selectionIds: readonly string[],
  block: VerticalMergedBlock
): boolean {
  if (selectionIds.length !== block.sessions.length) return false;
  const set = new Set(selectionIds);
  for (const s of block.sessions) {
    if (!set.has(s.id)) return false;
  }
  return true;
}

type PlanningBuilderBodyProps = {
  rawData: PlanningExportRaw;
  gridEffectif: PlanningGridConfig;
};

function PlanningBuilderBody({
  rawData,
  gridEffectif,
}: PlanningBuilderBodyProps) {
  const horizonNs = nombreSemainesGrid(gridEffectif);

  const [semaineCourante, setSemaineCourante] = useState(1);
  const semaineAffichee = Math.min(
    horizonNs,
    Math.max(1, semaineCourante)
  );

  const basePlanningData = useMemo(() => {
    const normalized = normalizePlanningExport(rawData, gridEffectif);
    return scheduleGreedy(normalized, gridEffectif);
  }, [rawData, gridEffectif]);

  const [manualSessions, setManualSessions] = useState<
    PlanningSession[] | null
  >(null);
  const [swapSelectionIds, setSwapSelectionIds] = useState<string[] | null>(
    null
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    block: VerticalMergedBlock;
  } | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  const planningData = useMemo(() => {
    if (manualSessions == null) return basePlanningData;
    return { ...basePlanningData, sessions: manualSessions };
  }, [basePlanningData, manualSessions]);

  const highlightSessionIds = useMemo(() => {
    if (swapSelectionIds == null || swapSelectionIds.length === 0) {
      return undefined;
    }
    return new Set(swapSelectionIds);
  }, [swapSelectionIds]);

  const selectionRecap = useMemo(() => {
    if (swapSelectionIds == null || swapSelectionIds.length === 0) {
      return null;
    }
    const firstId = swapSelectionIds[0];
    const s0 = planningData.sessions.find((x) => x.id === firstId);
    if (!s0) return null;
    const d = planningData.demands.find((x) => x.id === s0.demandId);
    if (!d) {
      return `${swapSelectionIds.length} séance(s) sélectionnée(s).`;
    }
    return `${d.formationNom} — ${d.matiereNom} — ${d.professeurNom} · ${
      swapSelectionIds.length
    } créneau(x)`;
  }, [planningData, swapSelectionIds]);

  const onBlockContextMenu = useCallback(
    (event: MouseEvent, block: VerticalMergedBlock) => {
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        block,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const onSelectBloc = useCallback(() => {
    const b = contextMenu?.block;
    if (!b) return;
    setSwapSelectionIds(b.sessions.map((s) => s.id));
    setSwapError(null);
  }, [contextMenu]);

  const onClearSwapSelection = useCallback(() => {
    setSwapSelectionIds(null);
    setSwapError(null);
  }, []);

  const onSwapWithSelection = useCallback(() => {
    const target = contextMenu?.block;
    const ids = swapSelectionIds;
    if (!target || ids == null || ids.length === 0) {
      return;
    }
    const selectedSessions = planningData.sessions.filter((s) =>
      ids.includes(s.id)
    );
    const res = trySwapMergedBlockSessions(
      selectedSessions,
      target.sessions,
      planningData.sessions
    );
    if (!res.ok) {
      setSwapError(res.error);
      return;
    }
    setManualSessions(res.sessions);
    setSwapSelectionIds(null);
    setSwapError(null);
  }, [contextMenu, planningData.sessions, swapSelectionIds]);

  const hasSwapSelection =
    swapSelectionIds != null && swapSelectionIds.length > 0;
  const canSwapFromMenu =
    swapSelectionIds != null &&
    swapSelectionIds.length > 0 &&
    contextMenu != null &&
    !blocksSameSessionSet(swapSelectionIds, contextMenu.block);

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
                value={semaineAffichee}
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
        <p className="max-w-[min(92vw,48rem)] text-[clamp(0.8rem,1.15vw,0.92rem)] text-slate-600">
          Clic droit sur un cours : menu{" "}
          <strong className="font-medium text-slate-800">Sélectionner</strong> puis
          clic droit sur un autre bloc pour{" "}
          <strong className="font-medium text-slate-800">
            Intervertir avec la sélection
          </strong>
          . Les échanges manuels ne vérifient que les chevauchements professeur et
          formation (pas salles ni créneaux interdits).
        </p>
        {selectionRecap != null ? (
          <div className="flex max-w-[min(92vw,52rem)] flex-wrap items-center justify-between gap-[2vw] rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-[2.5vw] py-[1.25vh] text-[clamp(0.82rem,1.15vw,0.95rem)] text-indigo-950">
            <p>
              <span className="font-semibold">Bloc sélectionné : </span>
              {selectionRecap}
            </p>
            <button
              type="button"
              onClick={onClearSwapSelection}
              className="shrink-0 rounded-lg border border-indigo-300/80 bg-white px-[2vw] py-[0.9vh] text-[clamp(0.78rem,1.05vw,0.88rem)] font-medium text-indigo-900 shadow-sm hover:bg-indigo-50"
            >
              Annuler la sélection
            </button>
          </div>
        ) : null}
        {swapError != null ? (
          <p
            role="alert"
            className="max-w-[min(92vw,40rem)] rounded-xl border border-red-200 bg-red-50/95 px-[2vw] py-[1.25vh] text-[clamp(0.82rem,1.1vw,0.92rem)] text-red-900"
          >
            {swapError}
          </p>
        ) : null}
        <PlanningGrid
          planningData={planningData}
          grid={gridEffectif}
          semaineAffichee={semaineAffichee}
          highlightSessionIds={highlightSessionIds}
          onBlockContextMenu={onBlockContextMenu}
        />
        <PlanningGridContextMenu
          open={contextMenu != null}
          x={contextMenu?.x ?? 0}
          y={contextMenu?.y ?? 0}
          hasSelection={hasSwapSelection}
          canSwap={canSwapFromMenu}
          onClose={closeContextMenu}
          onSelectBloc={onSelectBloc}
          onSwapWithSelection={onSwapWithSelection}
          onClearSelection={onClearSwapSelection}
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

  const resetKey = useMemo(
    () => planningBuilderResetKey(rawData, gridEffectif),
    [rawData, gridEffectif]
  );

  return (
    <PlanningBuilderBody
      key={resetKey}
      rawData={rawData}
      gridEffectif={gridEffectif}
    />
  );
}
