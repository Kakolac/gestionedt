"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MouseEvent } from "react";
import { PlanningGridContextMenu } from "@/components/planning/planning-grid-context-menu";
import {
  PlanningGrid,
  type VerticalMergedBlock,
} from "@/components/planning/planning-grid";
import { PlanningManualSwapConstraintConfirmModal } from "@/components/planning/PlanningManualSwapConstraintConfirmModal";
import { PlanningComparisonStats } from "@/components/planning/PlanningComparisonStats";
import { PlanningVacancesStats } from "@/components/planning/PlanningVacancesStats";
import { PlanningProfessorColorPickPopover } from "@/components/planning/PlanningProfessorColorPickPopover";
import { listMergedBlocksForGridView } from "@/lib/planning/planning-grid-view-blocks";
import { normalizePlanningExport } from "@/lib/planning/planning-normalize";
import {
  deriveSemaine1LundiIsoDepuisExportRaw,
  exportRawHasFormations,
  exportRawHasFormationLocalisation,
  parseSemaine1LundiIso,
} from "@/lib/planning/planning-public-holidays";
import { collectProfessorConstraintIssuesAfterSwap } from "@/lib/planning/planning-manual-swap-constraints";
import { trySwapMergedBlockSessions } from "@/lib/planning/planning-manual-swap";
import {
  nombreSemainesGrid,
  slotSemaine,
} from "@/lib/planning/planning-slot";
import {
  normalizeHex6,
  type PlanningProfessorColorOverride,
} from "@/lib/planning/planning-professor-accent";
import {
  DEFAULT_PLANNING_GRID,
  scheduleGreedy,
  scheduleGreedyRepetitionMode,
  completerPlanningAvecSessionsNonPlanifiees,
} from "@/lib/planning/planning-scheduler";
import type {
  PlanningData,
  PlanningExportRaw,
  PlanningGridConfig,
  PlanningSession,
} from "@/lib/planning/planning.types";

function fullscreenElementActive(): Element | null {
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

async function requestFullscreenSafe(el: HTMLElement): Promise<void> {
  const w = el as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (typeof el.requestFullscreen === "function") {
    await el.requestFullscreen();
    return;
  }
  if (typeof w.webkitRequestFullscreen === "function") {
    w.webkitRequestFullscreen();
    return;
  }
  throw new Error("no-fullscreen");
}

async function exitFullscreenSafe(): Promise<void> {
  const d = document as Document & { webkitExitFullscreen?: () => void };
  if (typeof document.exitFullscreen === "function") {
    await document.exitFullscreen();
    return;
  }
  if (typeof d.webkitExitFullscreen === "function") {
    d.webkitExitFullscreen();
    return;
  }
  throw new Error("no-fullscreen");
}

export type PlanningBuilderProps = {
  rawData: PlanningExportRaw;
  /** Fusionné avec [`DEFAULT_PLANNING_GRID`](../lib/planning/planning-scheduler.ts) ; champs omis = défauts. */
  gridConfig?: Partial<PlanningGridConfig>;
  /**
   * Nombre de semaines **distinctes** pour le placement (semaine × jour × heures).
   * Prioritaire sur `gridConfig.nombreSemaines` lorsqu’elle est fournie.
   */
  nombreSemainesRepetition?: number;
  /**
   * Si `true` : semaine type (placement sur la première semaine de grille) puis copie
   * identique sur toutes les semaines de l’horizon (voir `scheduleGreedyRepetitionMode`).
   */
  modeRepetition?: boolean;
  /**
   * En mode répétition : `1` = un motif pour tout le gabarit ; `3` ou `4` = blocs successifs
   * (ex. trimestres) avec un nouveau placement par bloc lorsque cela ne dégrade pas le résultat.
   */
  repetitionNombrePeriodes?: 1 | 3 | 4;
};

/** Remonte `PlanningBuilderBody` pour réinitialiser sélection / retouches manuelles. */
function planningBuilderResetKey(
  raw: PlanningExportRaw,
  grid: PlanningGridConfig,
  modeRepetition: boolean,
  repetitionNombrePeriodes: 1 | 3 | 4
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
    modeRepetition ? "rep" : "std",
    repetitionNombrePeriodes,
    grid.semaine1LundiIso ?? "",
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

function professorDisplayLabel(planning: PlanningData, professeurId: string): string {
  const ref = planning.references.professeurs.find((p) => p.id === professeurId);
  if (ref) {
    const n = `${ref.prenom ?? ""} ${ref.nom ?? ""}`.trim();
    if (n) return n;
  }
  const demand = planning.demands.find((x) => x.professeurId === professeurId);
  if (demand?.professeurNom?.trim()) return demand.professeurNom.trim();
  return professeurId;
}

type PlanningBuilderBodyProps = {
  rawData: PlanningExportRaw;
  gridEffectif: PlanningGridConfig;
  modeRepetition: boolean;
  repetitionNombrePeriodes: 1 | 3 | 4;
  besoinAncreCalendaire: boolean;
  semaine1LundiIsoInput: string;
  onSemaine1LundiIsoInputChange: (value: string) => void;
};

function PlanningBuilderBody({
  rawData,
  gridEffectif,
  modeRepetition,
  repetitionNombrePeriodes,
  besoinAncreCalendaire,
  semaine1LundiIsoInput,
  onSemaine1LundiIsoInputChange,
}: PlanningBuilderBodyProps) {
  const horizonNs = nombreSemainesGrid(gridEffectif);

  const [semaineCourante, setSemaineCourante] = useState(1);
  const semaineAffichee = Math.min(
    horizonNs,
    Math.max(1, semaineCourante)
  );

  const autoSemaine1DepuisFormations = useMemo(
    () => deriveSemaine1LundiIsoDepuisExportRaw(rawData),
    [rawData]
  );

  const [progressInfo, setProgressInfo] = useState<{
    progress: number;
    message: string;
  } | null>(null);

  const [basePlanningData, setBasePlanningData] = useState<PlanningData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function computePlanning() {
      const normalized = normalizePlanningExport(rawData, gridEffectif);
      const hasFormations = exportRawHasFormations(rawData);
      const anchorOk =
        parseSemaine1LundiIso(gridEffectif.semaine1LundiIso) != null;
      
      if (hasFormations && !anchorOk) {
        if (!cancelled) {
          setProgressInfo(null);
          setBasePlanningData(normalized);
        }
        return;
      }

      if (modeRepetition) {
        if (!cancelled) {
          setProgressInfo({ progress: 0, message: "Démarrage..." });
        }
        
        const result = await scheduleGreedyRepetitionMode(normalized, gridEffectif, {
          nombrePeriodes: repetitionNombrePeriodes,
          onProgress: async (progress, message) => {
            if (!cancelled) {
              console.log(`[Planning Progress] ${Math.round(progress * 100)}% - ${message}`);
              setProgressInfo({ progress, message });
              // Attendre 2 frames d'animation pour garantir que le navigateur repeint
              await new Promise((resolve) => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    setTimeout(resolve, 50);
                  });
                });
              });
            }
          },
        });
        
        if (!cancelled) {
          setProgressInfo(null);
          setBasePlanningData(result);
        }
        return;
      }

      const result = scheduleGreedy(normalized, gridEffectif);
      if (!cancelled) {
        setProgressInfo(null);
        setBasePlanningData(result);
      }
    }

    computePlanning();

    return () => {
      cancelled = true;
    };
  }, [rawData, gridEffectif, modeRepetition, repetitionNombrePeriodes]);

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
  const planningRootRef = useRef<HTMLDivElement>(null);
  const [formationAfficheeIdFilter, setFormationAfficheeIdFilter] =
    useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(
    null
  );
  const [profColorOverrideByProfId, setProfColorOverrideByProfId] =
    useState<Record<string, PlanningProfessorColorOverride>>({});
  const [profColorPopover, setProfColorPopover] = useState<{
    professeurId: string;
    professeurLabel: string;
    x: number;
    y: number;
  } | null>(null);
  const [swapConstraintPending, setSwapConstraintPending] = useState<{
    sessions: PlanningSession[];
    issues: ReturnType<typeof collectProfessorConstraintIssuesAfterSwap>;
  } | null>(null);
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [replacementProgress, setReplacementProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [replacementResult, setReplacementResult] = useState<{
    avant: number;
    apres: number;
    nouvellementPlacees: number;
  } | null>(null);

  const planningData = useMemo(() => {
    if (!basePlanningData) return null;
    if (manualSessions == null) return basePlanningData;
    return { ...basePlanningData, sessions: manualSessions };
  }, [basePlanningData, manualSessions]);

  const formationSelectOptions = useMemo(
    () =>
      planningData
        ? [...planningData.references.formations].sort((a, b) =>
            (a.nom ?? a.id).localeCompare(b.nom ?? b.id, "fr", {
              sensitivity: "base",
            })
          )
        : [],
    [planningData]
  );

  const highlightSessionIds = useMemo(() => {
    if (swapSelectionIds == null || swapSelectionIds.length === 0) {
      return undefined;
    }
    return new Set(swapSelectionIds);
  }, [swapSelectionIds]);

  const selectionRecap = useMemo(() => {
    if (!planningData || swapSelectionIds == null || swapSelectionIds.length === 0) {
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

  const onPickProfessorColorFromMenu = useCallback(() => {
    const ctx = contextMenu;
    if (ctx == null || !planningData) return;
    const label = professorDisplayLabel(planningData, ctx.block.professeurId);
    setProfColorPopover({
      professeurId: ctx.block.professeurId,
      professeurLabel: label,
      x: ctx.x + 10,
      y: ctx.y + 6,
    });
    setContextMenu(null);
  }, [contextMenu, planningData]);

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
    if (!target || ids == null || ids.length === 0 || !planningData) {
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
    const issues = collectProfessorConstraintIssuesAfterSwap(
      selectedSessions,
      target.sessions,
      res.sessions,
      gridEffectif,
      planningData
    );
    if (issues.length > 0) {
      setSwapConstraintPending({ sessions: res.sessions, issues });
      setSwapError(null);
      return;
    }
    setManualSessions(res.sessions);
    setSwapSelectionIds(null);
    setSwapError(null);
  }, [contextMenu, gridEffectif, planningData, swapSelectionIds]);

  const onConfirmSwapDespiteConstraints = useCallback(() => {
    const p = swapConstraintPending;
    if (p == null) return;
    setManualSessions(p.sessions);
    setSwapConstraintPending(null);
    setSwapSelectionIds(null);
    setSwapError(null);
  }, [swapConstraintPending]);

  const onCancelSwapConstraintModal = useCallback(() => {
    setSwapConstraintPending(null);
  }, []);

  const onTryReplaceUnscheduled = useCallback(async () => {
    if (!planningData) return;
    const unscheduledBefore = planningData.sessions.filter(
      (s) => s.statut === "unscheduled"
    ).length;

    if (unscheduledBefore === 0) {
      return;
    }

    setReplacementLoading(true);
    setReplacementResult(null);
    setReplacementProgress({ current: 0, total: unscheduledBefore });

    try {
      console.log(`[Replacement] Début du replacement de ${unscheduledBefore} séances...`);
      const startTime = Date.now();
      
      // Progression AVANT le calcul - Animation fluide visible
      const steps = Math.min(30, unscheduledBefore);
      for (let i = 0; i <= steps; i++) {
        setReplacementProgress({ 
          current: Math.floor((i / steps) * unscheduledBefore * 0.4), 
          total: unscheduledBefore 
        });
        // Utiliser requestIdleCallback ou setTimeout pour vraiment rendre la main
        await new Promise((resolve) => {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => setTimeout(resolve, 0));
          } else {
            setTimeout(resolve, 30);
          }
        });
      }
      
      // Marquer à 40% avant le calcul
      setReplacementProgress({ current: Math.floor(unscheduledBefore * 0.4), total: unscheduledBefore });
      
      // Laisser le navigateur respirer avant le calcul
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      console.log("[Replacement] Calcul en cours...");
      const result = completerPlanningAvecSessionsNonPlanifiees(planningData, gridEffectif);
      
      const calcDuration = Date.now() - startTime;
      console.log(`[Replacement] Terminé en ${calcDuration}ms`);
      
      // Progression APRÈS le calcul - Animation rapide à 100%
      const finalSteps = 15;
      for (let i = 0; i <= finalSteps; i++) {
        const progress = Math.floor(unscheduledBefore * 0.4 + ((i / finalSteps) * unscheduledBefore * 0.6));
        setReplacementProgress({ current: Math.min(progress, unscheduledBefore), total: unscheduledBefore });
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      
      setReplacementProgress({ current: unscheduledBefore, total: unscheduledBefore });
      await new Promise((resolve) => setTimeout(resolve, 300));

      const unscheduledAfter = result.sessions.filter(
        (s) => s.statut === "unscheduled"
      ).length;

      const nouvellementPlacees = unscheduledBefore - unscheduledAfter;
        
      setManualSessions(result.sessions);
      setReplacementResult({
        avant: unscheduledBefore,
        apres: unscheduledAfter,
        nouvellementPlacees,
      });
    } catch (error) {
      console.error("[Replacement] Erreur:", error);
      setReplacementResult({
        avant: unscheduledBefore,
        apres: unscheduledBefore,
        nouvellementPlacees: 0,
      });
    } finally {
      setReplacementLoading(false);
      setReplacementProgress(null);
    }
  }, [planningData, gridEffectif]);

  const hasSwapSelection =
    swapSelectionIds != null && swapSelectionIds.length > 0;
  const canSwapFromMenu =
    swapSelectionIds != null &&
    swapSelectionIds.length > 0 &&
    contextMenu != null &&
    !blocksSameSessionSet(swapSelectionIds, contextMenu.block);

  const scheduled = useMemo(
    () => (planningData ? planningData.sessions.filter((s) => s.statut === "scheduled") : []),
    [planningData]
  );

  const unscheduled = useMemo(
    () => (planningData ? planningData.sessions.filter((s) => s.statut === "unscheduled") : []),
    [planningData]
  );

  /** Le JSON peut être volumineux : on ne le sérialise que lorsque le panneau est ouvert. */
  const [jsonDetailsOpen, setJsonDetailsOpen] = useState(false);
  const jsonPretty = useMemo(
    () =>
      jsonDetailsOpen ? JSON.stringify(planningData, null, 2) : "",
    [jsonDetailsOpen, planningData]
  );

  const formationFiltreTrim = formationAfficheeIdFilter.trim();

  const swapTargetSessionIds = useMemo(() => {
    if (!planningData || swapSelectionIds == null || swapSelectionIds.length === 0) {
      return undefined;
    }
    const pick = new Set(swapSelectionIds);
    const selectedSessions = planningData.sessions.filter((s) => pick.has(s.id));
    if (selectedSessions.length === 0) return undefined;
    const visibleBlocks = listMergedBlocksForGridView(
      planningData,
      gridEffectif,
      semaineAffichee,
      formationFiltreTrim !== "" ? formationFiltreTrim : undefined
    );
    const ids = new Set<string>();
    for (const b of visibleBlocks) {
      if (blocksSameSessionSet(swapSelectionIds, b)) continue;
      const res = trySwapMergedBlockSessions(
        selectedSessions,
        b.sessions,
        planningData.sessions
      );
      if (res.ok) {
        for (const s of b.sessions) ids.add(s.id);
      }
    }
    if (ids.size === 0) return undefined;
    return ids;
  }, [
    formationFiltreTrim,
    gridEffectif,
    planningData,
    semaineAffichee,
    swapSelectionIds,
  ]);

  const scheduledAffiche = useMemo(() => {
    if (formationFiltreTrim === "") return scheduled;
    return scheduled.filter((s) => s.formationId === formationFiltreTrim);
  }, [scheduled, formationFiltreTrim]);

  const unscheduledAffiche = useMemo(() => {
    if (formationFiltreTrim === "") return unscheduled;
    return unscheduled.filter((s) => s.formationId === formationFiltreTrim);
  }, [unscheduled, formationFiltreTrim]);

  useEffect(() => {
    const onFsChange = () => {
      const el = planningRootRef.current;
      setIsFullscreen(el != null && fullscreenElementActive() === el);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  useEffect(() => {
    if (!planningData || formationFiltreTrim === "") return;
    if (swapSelectionIds == null || swapSelectionIds.length === 0) return;
    for (const id of swapSelectionIds) {
      const s = planningData.sessions.find((x) => x.id === id);
      if (s?.formationId !== formationFiltreTrim) {
        setSwapSelectionIds(null);
        setSwapError(null);
        return;
      }
    }
  }, [formationFiltreTrim, swapSelectionIds, planningData]);

  const toggleFullscreen = useCallback(async () => {
    setFullscreenError(null);
    const el = planningRootRef.current;
    if (!el) return;
    try {
      if (fullscreenElementActive() === el) {
        await exitFullscreenSafe();
      } else {
        await requestFullscreenSafe(el);
      }
    } catch {
      setFullscreenError(
        "Ce navigateur refuse ou ne prend pas en charge le plein écran depuis cette page."
      );
    }
  }, []);

  const goToPreviousWeek = useCallback(() => {
    setSemaineCourante((prev) => Math.max(1, prev - 1));
  }, []);

  const goToNextWeek = useCallback(() => {
    setSemaineCourante((prev) => Math.min(horizonNs, prev + 1));
  }, [horizonNs]);

  useEffect(() => {
    if (!isFullscreen || horizonNs <= 1) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPreviousWeek();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNextWeek();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, horizonNs, goToPreviousWeek, goToNextWeek]);

  // Afficher un message de chargement si le planning n'est pas encore calculé
  if (!planningData) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 mx-auto" />
          <p className="text-lg font-medium text-slate-700">
            Chargement du planning...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={planningRootRef}
      className={
        isFullscreen
          ? "box-border flex max-h-[100dvh] h-[100dvh] min-h-0 w-full flex-col gap-[1.5vh] overflow-hidden bg-slate-50 px-[2vw] py-[2vh] text-slate-900"
          : "flex w-full max-w-[min(96vw,120rem)] flex-col gap-[2.5vh] px-[2vw] py-[2.5vh] text-slate-900"
      }
    >
      {!isFullscreen ? (
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
        {modeRepetition ? (
          <p className="mt-2 rounded-xl border border-emerald-200/85 bg-emerald-50/90 px-[2vw] py-[1.25vh] text-[clamp(0.82rem,1.2vw,0.95rem)] text-emerald-950">
            <strong>Mode répétition :</strong> les heures annuelles des lignes sont raménées à une
            moyenne <strong>par semaine de gabarit</strong> (arrondi), puis une <strong>semaine type</strong>{" "}
            est placée et recopiée sur les <strong>{horizonNs}</strong> semaine
            {horizonNs > 1 ? "s" : ""}, ce qui rapproche le total du contrat formation.{" "}
            {repetitionNombrePeriodes === 1 ? (
              <>
                Un seul motif sur tout l&apos;horizon (même jour et mêmes heures chaque semaine).
              </>
            ) : (
              <>
                <strong>{repetitionNombrePeriodes} blocs</strong> successifs (ex. trimestres) : le
                placement peut varier légerement entre blocs si le moteur le permet sans augmenter les
                séances non planifiées.
              </>
            )}{" "}
            Les échanges manuels peuvent ensuite différer d&apos;une semaine à l&apos;autre.
          </p>
        ) : null}
      </header>
      ) : null}

      {progressInfo && (
        <div className="animate-pulse rounded-2xl border-2 border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50 px-[min(4vw,1.5rem)] py-[min(2.5vh,1.25rem)] shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                <div>
                  <p className="text-[clamp(1rem,1.4vw,1.15rem)] font-bold text-indigo-950">
                    Génération du planning en cours...
                  </p>
                  <p className="mt-1 text-[clamp(0.85rem,1.15vw,0.95rem)] font-medium text-indigo-800">
                    {progressInfo.message}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-[clamp(1.5rem,2.2vw,2rem)] font-extrabold text-indigo-700">
                {Math.round(progressInfo.progress * 100)}%
              </div>
              <div className="text-[clamp(0.7rem,0.9vw,0.8rem)] font-medium text-indigo-600">
                progression
              </div>
            </div>
          </div>
          <div className="mt-[1.5vh] h-[1.2vh] overflow-hidden rounded-full bg-indigo-200/80 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 transition-all duration-500 ease-out shadow-md"
              style={{ width: `${progressInfo.progress * 100}%` }}
            />
          </div>
          <p className="mt-2 text-center text-[clamp(0.75rem,1vw,0.85rem)] text-indigo-700">
            Veuillez patienter, le calcul peut prendre quelques secondes...
          </p>
        </div>
      )}

      <section
        className={
          isFullscreen
            ? "flex min-h-0 min-w-0 flex-1 flex-col space-y-[1.25vh] overflow-hidden"
            : "space-y-[1.25vh]"
        }
      >
        {besoinAncreCalendaire ? (
          <div className="rounded-2xl border border-indigo-200/90 bg-indigo-50/70 px-[min(4vw,1.25rem)] py-[min(2vh,1rem)] shadow-sm">
            <p className="text-[clamp(0.82rem,1.15vw,0.95rem)] font-semibold text-indigo-950">
              Ancrage calendaire
            </p>
            <p className="mt-1 text-[clamp(0.78rem,1.05vw,0.88rem)] text-indigo-900/90">
              Les <strong>dates sous les colonnes</strong> de la grille et le calcul des{" "}
              <strong>jours fériés</strong> utilisent le <strong>lundi</strong> de la semaine{" "}
              <strong>S1</strong>. Il est <strong>déduit</strong> du plus tôt des{" "}
              <strong>dates de démarrage</strong> des formations (lundi de la même semaine civile
              lun–dim que chaque date). Vous pouvez forcer un autre lundi ci-dessous.
            </p>
            {exportRawHasFormationLocalisation(rawData) ? (
              <p className="mt-2 text-[clamp(0.76rem,1.05vw,0.86rem)] text-indigo-900/85">
                Une formation a une <strong>localisation pays</strong> : sans lundi S1 valide, les
                contraintes « jour férié » ne s&apos;appliquent pas et le placement automatique reste
                désactivé.
              </p>
            ) : null}
            {autoSemaine1DepuisFormations ? (
              <p className="mt-2 text-[clamp(0.78rem,1.05vw,0.88rem)] text-slate-800">
                <span className="font-medium text-slate-900">Lundi S1 proposé : </span>
                <span className="tabular-nums">{autoSemaine1DepuisFormations}</span>
                {parseSemaine1LundiIso(gridEffectif.semaine1LundiIso) != null ? (
                  <span className="ml-2 text-emerald-800">
                    (actif — grille alignée)
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="mt-2 text-[clamp(0.78rem,1.05vw,0.88rem)] font-medium text-amber-900">
                Aucune <strong>dateDemarrageIso</strong> exploitable dans ce jeu : renseignez le{" "}
                <strong>lundi</strong> manuellement ou chargez des formations avec date de démarrage
                renseignée.
              </p>
            )}
            <label className="mt-[1.5vh] flex flex-wrap items-center gap-[2vw] text-[clamp(0.82rem,1.15vw,0.95rem)] text-slate-800">
              <span className="font-medium">Forcer le lundi de la semaine 1</span>
              <input
                type="date"
                value={semaine1LundiIsoInput}
                onChange={(e) => onSemaine1LundiIsoInputChange(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>
            {semaine1LundiIsoInput.trim() !== "" &&
            parseSemaine1LundiIso(semaine1LundiIsoInput.trim()) == null ? (
              <p className="mt-2 text-[clamp(0.78rem,1.05vw,0.88rem)] font-medium text-amber-800">
                La date choisie doit être un <strong>lundi</strong>.
              </p>
            ) : null}
            {parseSemaine1LundiIso(gridEffectif.semaine1LundiIso) == null ? (
              <p className="mt-2 text-[clamp(0.78rem,1.05vw,0.88rem)] text-slate-700">
                Corrigez le lundi ci-dessus ou les dates de démarrage des formations pour activer le
                placement glouton et l&apos;affichage des dates sur la grille.
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-[2vw]">
          <h2 className="text-[clamp(0.95rem,1.4vw,1.1rem)] font-semibold text-indigo-950">
            Grille {horizonNs > 1 ? "de la semaine sélectionnée" : "hebdomadaire"}
          </h2>
          <div className="flex flex-wrap items-end gap-[2vw]">
            {horizonNs > 1 ? (
              <div className="flex flex-col gap-[1vh]">
                <label className="flex flex-wrap items-center gap-[1.5vw] text-[clamp(0.82rem,1.15vw,0.95rem)] text-slate-700">
                  <span className="font-medium text-slate-800">
                    Afficher la semaine
                  </span>
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
                    {Array.from({ length: horizonNs }, (_, i) => i + 1).map(
                      (w) => (
                        <option key={w} value={w}>
                          Semaine {w} / {horizonNs}
                        </option>
                      )
                    )}
                  </select>
                </label>
                {isFullscreen ? (
                  <div className="flex items-center justify-center gap-[2vw]">
                    <button
                      type="button"
                      onClick={goToPreviousWeek}
                      disabled={semaineAffichee <= 1}
                      className="rounded-lg border border-slate-300 bg-white px-[1.5vw] py-[0.8vh] text-slate-700 outline-none hover:bg-slate-50 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Semaine précédente"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={goToNextWeek}
                      disabled={semaineAffichee >= horizonNs}
                      className="rounded-lg border border-slate-300 bg-white px-[1.5vw] py-[0.8vh] text-slate-700 outline-none hover:bg-slate-50 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Semaine suivante"
                    >
                      →
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {planningData.references.formations.length > 1 ? (
              <label className="flex flex-wrap items-center gap-[1.5vw] text-[clamp(0.82rem,1.15vw,0.95rem)] text-slate-700">
                <span className="font-medium text-slate-800">
                  Afficher la formation
                </span>
                <select
                  value={formationAfficheeIdFilter}
                  onChange={(e) => setFormationAfficheeIdFilter(e.target.value)}
                  className="max-w-[min(52vw,20rem)] rounded-xl border border-slate-200 bg-white px-[2vw] py-[1vh] text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
                >
                  <option value="">Toutes les formations</option>
                  {formationSelectOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nom?.trim() || f.id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="shrink-0 rounded-xl border border-slate-300/90 bg-white px-[2vw] py-[1vh] text-[clamp(0.82rem,1.05vw,0.92rem)] font-medium text-slate-800 shadow-sm outline-none hover:bg-slate-50 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
            >
              {isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            </button>
          </div>
        </div>
        {fullscreenError != null ? (
          <p
            role="alert"
            className="max-w-[min(92vw,40rem)] shrink-0 rounded-xl border border-amber-200 bg-amber-50/95 px-[2vw] py-[1.25vh] text-[clamp(0.82rem,1.1vw,0.92rem)] text-amber-950"
          >
            {fullscreenError}
          </p>
        ) : null}
        {!isFullscreen ? (
          <p className="max-w-[min(92vw,48rem)] text-[clamp(0.8rem,1.15vw,0.92rem)] text-slate-600">
            Clic droit sur un cours : menu{" "}
            <strong className="font-medium text-slate-800">Sélectionner</strong> puis
            clic droit sur un autre bloc pour{" "}
            <strong className="font-medium text-slate-800">
              Intervertir avec la sélection
            </strong>
            . Un échange refusé pour chevauchement professeur ou formation reste bloqué ;
            si le nouvel emplacement contrevient aux contraintes enregistrées du
            professeur (jours, plages interdites, salles, volumes…), une modale demande
            confirmation avant d’appliquer le changement.
          </p>
        ) : (
          <p className="shrink-0 text-[clamp(0.76rem,1.05vw,0.85rem)] text-slate-500">
            Plein écran : clic droit sur un cours pour échanger des créneaux (comme hors
            plein écran).
            {horizonNs > 1 ? (
              <>
                {" "}
                Plusieurs semaines : touches{" "}
                <strong className="font-medium text-slate-600">
                  Flèche gauche
                </strong>{" "}
                /{" "}
                <strong className="font-medium text-slate-600">
                  Flèche droite
                </strong>{" "}
                ou les boutons sous la liste déroulante pour changer de semaine affichée.
              </>
            ) : null}
          </p>
        )}
        {selectionRecap != null ? (
          <div className="flex max-w-[min(92vw,52rem)] shrink-0 flex-wrap items-center justify-between gap-[2vw] rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-[2.5vw] py-[1.25vh] text-[clamp(0.82rem,1.15vw,0.95rem)] text-indigo-950">
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
            className="max-w-[min(92vw,40rem)] shrink-0 rounded-xl border border-red-200 bg-red-50/95 px-[2vw] py-[1.25vh] text-[clamp(0.82rem,1.1vw,0.92rem)] text-red-900"
          >
            {swapError}
          </p>
        ) : null}
        <div
          className={
            isFullscreen
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              : undefined
          }
        >
          <PlanningGrid
            planningData={planningData}
            grid={gridEffectif}
            semaineAffichee={semaineAffichee}
            formationAfficheeId={
              formationFiltreTrim !== "" ? formationFiltreTrim : undefined
            }
            flexibleHeight={isFullscreen}
            highlightSessionIds={highlightSessionIds}
            swapTargetSessionIds={swapTargetSessionIds}
            professorColorOverrideByProfId={profColorOverrideByProfId}
            onBlockContextMenu={onBlockContextMenu}
          />
        </div>
        <PlanningGridContextMenu
          open={contextMenu != null}
          x={contextMenu?.x ?? 0}
          y={contextMenu?.y ?? 0}
          hasSelection={hasSwapSelection}
          canSwap={canSwapFromMenu}
          showProfessorColorPick
          onClose={closeContextMenu}
          onSelectBloc={onSelectBloc}
          onPickProfessorColor={onPickProfessorColorFromMenu}
          onSwapWithSelection={onSwapWithSelection}
          onClearSelection={onClearSwapSelection}
        />
        <PlanningManualSwapConstraintConfirmModal
          open={swapConstraintPending != null}
          issues={swapConstraintPending?.issues ?? []}
          onConfirm={onConfirmSwapDespiteConstraints}
          onCancel={onCancelSwapConstraintModal}
        />
        <PlanningProfessorColorPickPopover
          open={profColorPopover != null}
          x={profColorPopover?.x ?? 0}
          y={profColorPopover?.y ?? 0}
          professeurId={profColorPopover?.professeurId ?? ""}
          professeurLabel={profColorPopover?.professeurLabel ?? ""}
          colorOverride={
            profColorPopover != null
              ? profColorOverrideByProfId[profColorPopover.professeurId]
              : undefined
          }
          onSelectHue={(hueDegrees) => {
            if (profColorPopover == null) return;
            setProfColorOverrideByProfId((prev) => ({
              ...prev,
              [profColorPopover.professeurId]: {
                mode: "hue",
                hueDegrees,
              },
            }));
          }}
          onSelectExactHex={(hexRaw) => {
            if (profColorPopover == null) return;
            const hex = normalizeHex6(hexRaw);
            if (hex == null) return;
            setProfColorOverrideByProfId((prev) => ({
              ...prev,
              [profColorPopover.professeurId]: {
                mode: "hex",
                hex,
              },
            }));
          }}
          onClearOverride={() => {
            if (profColorPopover == null) return;
            const id = profColorPopover.professeurId;
            setProfColorOverrideByProfId((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          }}
          onClose={() => setProfColorPopover(null)}
        />
      </section>

      {!isFullscreen ? (
      <section className="grid gap-[2.5vh] lg:grid-cols-2">
        <div className="flex min-h-[24vh] flex-col gap-2">
          <h2 className="text-[clamp(0.95rem,1.4vw,1.1rem)] font-semibold text-indigo-950">
            Séances planifiées ({scheduledAffiche.length})
          </h2>
          <ul className="max-h-[36vh] list-none space-y-2 overflow-y-auto rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-[clamp(0.8rem,1.15vw,0.95rem)] leading-snug shadow-[0_8px_30px_rgba(49,46,129,0.07)]">
            {scheduledAffiche.map((s) => (
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
            Séances non planifiées ({unscheduledAffiche.length})
          </h2>
          <ul className="max-h-[36vh] list-none space-y-2 overflow-y-auto rounded-2xl border border-fuchsia-200/70 bg-gradient-to-br from-fuchsia-50/90 via-white to-amber-50/40 px-4 py-3 text-[clamp(0.8rem,1.15vw,0.95rem)] leading-snug text-fuchsia-950 shadow-[0_8px_28px_rgba(192,38,211,0.08)]">
            {unscheduledAffiche.map((s) => (
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
      ) : null}

      {!isFullscreen ? (
      <section className="flex min-h-[28vh] flex-col gap-2">
        <details
          className="group rounded-2xl border border-indigo-200/60 bg-white/85 shadow-[0_8px_30px_rgba(49,46,129,0.06)]"
          onToggle={(e) => setJsonDetailsOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer select-none px-4 py-3 text-[clamp(0.95rem,1.4vw,1.05rem)] font-semibold text-indigo-900 marker:text-indigo-500">
            planningData (JSON normalisé) — afficher / masquer
          </summary>
          <p className="border-t border-indigo-100/80 px-4 pb-2 pt-3 text-[clamp(0.78rem,1.05vw,0.88rem)] leading-relaxed text-slate-600">
            Données complètes pour toutes les formations du chargement ; le sélecteur
            « Afficher la formation » n&apos;affecte que la grille et les listes
            ci-dessus (pas ce JSON).
          </p>
          <pre className="max-h-[45vh] overflow-auto border-t border-indigo-200/40 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 p-4 text-[clamp(0.72rem,1.05vw,0.85rem)] leading-relaxed text-sky-100/95">
            {jsonPretty}
          </pre>
        </details>
      </section>
      ) : null}

      {!isFullscreen ? (
        <>
          <PlanningComparisonStats planningData={planningData} />
          <PlanningVacancesStats
            planningData={planningData}
            grid={gridEffectif}
            onTryReplacement={onTryReplaceUnscheduled}
            replacementLoading={replacementLoading}
            replacementProgress={replacementProgress}
            replacementResult={replacementResult}
          />
        </>
      ) : null}
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
  modeRepetition = false,
  repetitionNombrePeriodes = 1,
}: PlanningBuilderProps) {
  const [semaine1LundiIsoInput, setSemaine1LundiIsoInput] = useState("");

  const autoSemaine1LundiIso = useMemo(
    () => deriveSemaine1LundiIsoDepuisExportRaw(rawData),
    [rawData]
  );

  const rawFingerprint = useMemo(() => {
    const m = rawData.meta?.exportedAt ?? "";
    const fs = rawData.formations;
    const ids =
      Array.isArray(fs)
        ? [...fs]
            .map((f) =>
              typeof f === "object" &&
              f !== null &&
              "_id" in (f as Record<string, unknown>)
                ? String((f as { _id: unknown })._id)
                : ""
            )
            .sort()
            .join(",")
        : "";
    return `${m}|${ids}`;
  }, [rawData]);

  useEffect(() => {
    setSemaine1LundiIsoInput("");
  }, [rawFingerprint]);

  const gridEffectif = useMemo(() => {
    const base = { ...DEFAULT_PLANNING_GRID, ...gridConfig };
    let merged = base;
    if (nombreSemainesRepetition != null) {
      const ns = Math.min(
        52,
        Math.max(1, Math.floor(Number(nombreSemainesRepetition)) || 1)
      );
      merged = { ...merged, nombreSemaines: ns };
    }
    const manual = semaine1LundiIsoInput.trim();
    const manualOk =
      manual !== "" && parseSemaine1LundiIso(manual) != null;
    const mergedSemaine1 = manualOk
      ? manual
      : (autoSemaine1LundiIso ?? "");
    if (mergedSemaine1) {
      merged = { ...merged, semaine1LundiIso: mergedSemaine1 };
    }
    return merged;
  }, [
    gridConfig,
    nombreSemainesRepetition,
    semaine1LundiIsoInput,
    autoSemaine1LundiIso,
  ]);

  const periodes =
    repetitionNombrePeriodes === 3 || repetitionNombrePeriodes === 4
      ? repetitionNombrePeriodes
      : (1 as const);

  const besoinAncreCalendaire = useMemo(
    () => exportRawHasFormations(rawData),
    [rawData]
  );

  const resetKey = useMemo(
    () =>
      planningBuilderResetKey(rawData, gridEffectif, modeRepetition, periodes),
    [rawData, gridEffectif, modeRepetition, periodes]
  );

  return (
    <PlanningBuilderBody
      key={resetKey}
      rawData={rawData}
      gridEffectif={gridEffectif}
      modeRepetition={modeRepetition}
      repetitionNombrePeriodes={periodes}
      besoinAncreCalendaire={besoinAncreCalendaire}
      semaine1LundiIsoInput={semaine1LundiIsoInput}
      onSemaine1LundiIsoInputChange={setSemaine1LundiIsoInput}
    />
  );
}
