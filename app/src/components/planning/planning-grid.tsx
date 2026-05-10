"use client";

import { Fragment, memo, useMemo, type MouseEvent } from "react";
import type {
  PlanningData,
  PlanningGridConfig,
  PlanningSession,
} from "@/lib/planning/planning.types";
import { nombreSemainesGrid, slotSemaine } from "@/lib/planning/planning-slot";
import {
  buildVerticalMergedBlocks,
  formationSortLabel,
  type VerticalMergedBlock,
} from "@/lib/planning/planning-merged-blocks";
import {
  resolveProfessorAccent,
  type PlanningProfessorColorOverride,
} from "@/lib/planning/planning-professor-accent";
import {
  dateCivilPourJourSemaine,
  formatDateEntetePlanningFrUtc,
} from "@/lib/planning/planning-public-holidays";

export type { VerticalMergedBlock } from "@/lib/planning/planning-merged-blocks";
export { buildVerticalMergedBlocks } from "@/lib/planning/planning-merged-blocks";

export type PlanningGridProps = {
  planningData: PlanningData;
  grid: PlanningGridConfig;
  /** Semaine 1-based à afficher lorsque `grid.nombreSemaines` &gt; 1. */
  semaineAffichee?: number;
  /**
   * Filtrage d’affichage : uniquement les séances de cette formation sur la grille.
   * Ignoré si absent ou chaîne vide (toutes formations).
   */
  formationAfficheeId?: string;
  /**
   * Coque sans hauteur minimale fixe (`min(72vh,…)`), prête pour flex parent (ex. plein écran).
   */
  flexibleHeight?: boolean;
  /** Ids des séances du bloc actuellement sélectionné pour un échange manuel. */
  highlightSessionIds?: ReadonlySet<string>;
  /**
   * Ids des séances des blocs **visibles** avec lesquels un échange avec la sélection serait accepté
   * (`trySwapMergedBlockSessions`). Contour **vert en pointillés animés** sur la grille (hors bloc déjà surligné indigo).
   */
  swapTargetSessionIds?: ReadonlySet<string>;
  /**
   * Surcharge couleur par `professeurId` : teinte pastel (palette ou raccourci) ou hex exact (couleur libre).
   */
  professorColorOverrideByProfId?: Readonly<
    Record<string, PlanningProfessorColorOverride>
  >;
  /**
   * Clic droit sur une carte fusionnée (`MergedBlockCard`) : événement après `preventDefault`
   * sur le menu natif. Le parent peut ouvrir `PlanningGridContextMenu` (voir `docs/planning-grid-context-menu.md`).
   */
  onBlockContextMenu?: (event: MouseEvent, block: VerticalMergedBlock) => void;
};

const JOUR_LABEL: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};

function blocksCoveringHour(
  blocks: readonly VerticalMergedBlock[],
  heure: number
): VerticalMergedBlock[] {
  return blocks.filter((b) => heure >= b.startHour && heure < b.endHour);
}

function blockIsHighlighted(
  block: VerticalMergedBlock,
  highlightSessionIds: ReadonlySet<string> | undefined
): boolean {
  if (highlightSessionIds == null || highlightSessionIds.size === 0) return false;
  return block.sessions.some((s) => highlightSessionIds.has(s.id));
}

function blockIsSwapTarget(
  block: VerticalMergedBlock,
  swapTargetSessionIds: ReadonlySet<string> | undefined,
  highlightSessionIds: ReadonlySet<string> | undefined
): boolean {
  if (swapTargetSessionIds == null || swapTargetSessionIds.size === 0) return false;
  if (blockIsHighlighted(block, highlightSessionIds)) return false;
  return block.sessions.some((s) => swapTargetSessionIds.has(s.id));
}

function MergedBlockCardInner({
  block,
  planningData,
  professorColorOverride,
  highlighted,
  swapTargetHighlighted,
  onContextMenu,
}: MergedBlockCardProps) {
  const first = block.sessions[0];
  const d = planningData.demands.find((x) => x.id === first.demandId);
  const accent = resolveProfessorAccent(
    block.professeurId,
    professorColorOverride ?? undefined
  );
  const totalHeures = block.endHour - block.startHour;
  const creneau = `${block.startHour}h – ${block.endHour}h`;
  const nbSeances = block.sessions.length;

  const salles = [
    ...new Set(
      block.sessions
        .map((x) => x.assignedSalleId)
        .filter((x): x is string => x != null)
    ),
  ];
  const salleLabel =
    salles.length === 0
      ? null
      : salles.length === 1
        ? `Salle …${salles[0].slice(-6)}`
        : `${salles.length} salles`;

  if (!d) {
    return (
      <div className="flex h-full min-h-0 flex-col justify-center rounded-lg border border-indigo-200/80 bg-indigo-50/60 px-2 py-2 text-[0.875rem] text-indigo-800">
        Bloc ({creneau}) — données incomplètes
      </div>
    );
  }

  const titleFull = [
    d.formationNom,
    d.matiereNom,
    d.professeurNom,
    creneau,
    `${totalHeures} h`,
    salleLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  const ringClass = highlighted
    ? "border-indigo-400 ring-[3px] ring-indigo-500/85 ring-offset-2 ring-offset-white"
    : swapTargetHighlighted
      ? "relative border-slate-200/70"
      : "border-slate-200/70";

  return (
    <article
      className={
        `flex h-full min-h-0 min-w-0 flex-col justify-center rounded-xl border py-2 pl-3 pr-2 shadow-[0_8px_22px_rgba(15,23,42,0.08)] ${ringClass}`
      }
      style={{
        borderLeftWidth: 4,
        borderLeftColor: accent.border,
        background: accent.background,
      }}
      title={titleFull}
      onContextMenu={
        onContextMenu != null
          ? (e) => {
              e.preventDefault();
              onContextMenu(e);
            }
          : undefined
      }
    >
      {swapTargetHighlighted ? (
        <svg
          className="planning-swap-target-svg pointer-events-none absolute inset-0 h-full w-full overflow-visible text-emerald-500"
          aria-hidden
        >
          <rect
            className="planning-swap-target-dash"
            x="2"
            y="2"
            width="calc(100% - 4px)"
            height="calc(100% - 4px)"
            rx="12"
            ry="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="12 7"
            shapeRendering="optimizeSpeed"
          />
        </svg>
      ) : null}
      <p
        className="text-[clamp(0.68rem,0.95vw,0.78rem)] font-semibold uppercase tracking-[0.12em]"
        style={{ color: accent.labelColor }}
      >
        {creneau}
        {nbSeances > 1 ? (
          <span
            className="ml-1.5 font-normal normal-case tracking-normal opacity-90"
            style={{ color: accent.matiereColor }}
          >
            · {nbSeances} créneaux
          </span>
        ) : null}
      </p>
      <h3
        className={
          accent.cardFormationTitleColor == null
            ? "mt-1 text-[clamp(0.8rem,1.15vw,0.95rem)] font-semibold leading-tight text-slate-900 line-clamp-2"
            : "mt-1 text-[clamp(0.8rem,1.15vw,0.95rem)] font-semibold leading-tight line-clamp-2"
        }
        style={
          accent.cardFormationTitleColor != null
            ? { color: accent.cardFormationTitleColor }
            : undefined
        }
      >
        {d.formationNom}
      </h3>
      <p
        className="mt-1.5 text-[clamp(0.85rem,1.25vw,1rem)] font-medium leading-snug"
        style={{ color: accent.matiereColor }}
      >
        {d.matiereNom}
      </p>
      <div
        className={
          accent.cardFooterMutedColor == null
            ? "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[clamp(0.72rem,1vw,0.82rem)] text-slate-700"
            : "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[clamp(0.72rem,1vw,0.82rem)]"
        }
        style={
          accent.cardFooterMutedColor != null
            ? { color: accent.cardFooterMutedColor }
            : undefined
        }
      >
        <span
          className={
            accent.cardProfNameColor == null
              ? "font-medium text-slate-800"
              : "font-medium"
          }
          style={
            accent.cardProfNameColor != null
              ? { color: accent.cardProfNameColor }
              : undefined
          }
        >
          {d.professeurNom}
        </span>
        <span
          className="rounded-md px-1.5 py-0.5 tabular-nums font-medium shadow-sm"
          style={{
            backgroundColor: accent.badgeSurface,
            color: accent.badgeText,
            boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
            border: `1px solid ${accent.badgeRing}`,
          }}
        >
          {totalHeures} h
        </span>
        {salleLabel != null ? (
          <span className="rounded-md bg-white/90 px-1.5 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200/90">
            {salleLabel}
          </span>
        ) : null}
      </div>
    </article>
  );
}

type MergedBlockCardProps = {
  block: VerticalMergedBlock;
  planningData: PlanningData;
  professorColorOverride?: PlanningProfessorColorOverride | null;
  highlighted?: boolean;
  /** Cible d’interversion possible (contour vert pointillé animé) ; ignoré si `highlighted`. */
  swapTargetHighlighted?: boolean;
  onContextMenu?: (event: MouseEvent) => void;
};

function mergedBlockCardPropsEqual(
  prev: MergedBlockCardProps,
  next: MergedBlockCardProps
): boolean {
  if (prev.planningData !== next.planningData) return false;
  if (prev.highlighted !== next.highlighted) return false;
  if (prev.swapTargetHighlighted !== next.swapTargetHighlighted) return false;
  if (prev.professorColorOverride !== next.professorColorOverride) return false;
  if (prev.onContextMenu !== next.onContextMenu) return false;
  const pb = prev.block;
  const nb = next.block;
  if (
    pb.startHour !== nb.startHour ||
    pb.endHour !== nb.endHour ||
    pb.formationId !== nb.formationId ||
    pb.matiereId !== nb.matiereId ||
    pb.professeurId !== nb.professeurId
  ) {
    return false;
  }
  if (pb.sessions.length !== nb.sessions.length) return false;
  for (let i = 0; i < pb.sessions.length; i += 1) {
    if (pb.sessions[i]!.id !== nb.sessions[i]!.id) return false;
  }
  return true;
}

const MergedBlockCard = memo(MergedBlockCardInner, mergedBlockCardPropsEqual);

/** Plusieurs cours **même début** (ex. formation A & B en parallèle 10h–12h) : colonnes égales, pleine hauteur du `grid-row` fusionné. */
function StackedStartBlocks({
  blocks,
  planningData,
  professorColorOverrideByProfId,
  highlightSessionIds,
  swapTargetSessionIds,
  onBlockContextMenu,
}: {
  blocks: VerticalMergedBlock[];
  planningData: PlanningData;
  professorColorOverrideByProfId?: Readonly<
    Record<string, PlanningProfessorColorOverride>
  >;
  highlightSessionIds?: ReadonlySet<string>;
  swapTargetSessionIds?: ReadonlySet<string>;
  onBlockContextMenu?: (event: MouseEvent, block: VerticalMergedBlock) => void;
}) {
  const n = blocks.length;
  return (
    <div
      className="grid h-full min-h-0 w-full gap-[1vw] p-[1vw]"
      style={{
        gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
      }}
    >
      {blocks.map((b) => (
        <div
          key={`${b.startHour}-${b.formationId}-${b.sessions[0].id}`}
          className="flex min-h-0 min-w-0 flex-col"
        >
          <MergedBlockCard
            block={b}
            planningData={planningData}
            professorColorOverride={
              professorColorOverrideByProfId?.[b.professeurId]
            }
            highlighted={blockIsHighlighted(b, highlightSessionIds)}
            swapTargetHighlighted={blockIsSwapTarget(
              b,
              swapTargetSessionIds,
              highlightSessionIds
            )}
            onContextMenu={
              onBlockContextMenu != null
                ? (e) => onBlockContextMenu(e, b)
                : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Grille jour × heure avec blocs verticaux : heures d’affilée même prof + même classe
 * (formation / matière / prof) sont une seule carte `grid-row` étendue.
 */
export function PlanningGrid({
  planningData,
  grid,
  semaineAffichee = 1,
  formationAfficheeId,
  flexibleHeight = false,
  highlightSessionIds,
  swapTargetSessionIds,
  professorColorOverrideByProfId,
  onBlockContextMenu,
}: PlanningGridProps) {
  const semaineVue = Math.min(
    nombreSemainesGrid(grid),
    Math.max(1, Math.floor(semaineAffichee) || 1)
  );

  const filtreFormation = formationAfficheeId?.trim() ?? "";

  const sessionsPourSemaine = useMemo(() => {
    return planningData.sessions.filter((s) => {
      if (filtreFormation !== "" && s.formationId !== filtreFormation) {
        return false;
      }
      if (s.statut !== "scheduled" || s.assignedSlot == null) return false;
      return slotSemaine(s.assignedSlot) === semaineVue;
    });
  }, [planningData.sessions, semaineVue, filtreFormation]);

  const heures = useMemo(() => {
    const h: number[] = [];
    for (let x = grid.heureDebut; x < grid.heureFin; x += 1) {
      h.push(x);
    }
    return h;
  }, [grid.heureDebut, grid.heureFin]);

  const blocksByJour = useMemo(() => {
    const m = new Map<number, VerticalMergedBlock[]>();
    for (const jour of grid.joursSemaine) {
      m.set(jour, buildVerticalMergedBlocks(planningData, sessionsPourSemaine, jour));
    }
    return m;
  }, [sessionsPourSemaine, grid.joursSemaine, planningData]);

  /** Dates civiles par colonne lorsque `grid.semaine1LundiIso` est un lundi valide. */
  const dateEnteteParJourIso = useMemo(() => {
    const m = new Map<number, string>();
    for (const jour of grid.joursSemaine) {
      const d = dateCivilPourJourSemaine(grid, semaineVue, jour);
      if (d) m.set(jour, formatDateEntetePlanningFrUtc(d));
    }
    return m;
  }, [grid, grid.joursSemaine, semaineVue]);

  const colCount = grid.joursSemaine.length;
  const rowCount = heures.length;
  const gridTemplateRows = `auto repeat(${rowCount}, minmax(6rem, auto))`;

  return (
    <div
      className={
        flexibleHeight
          ? "flex min-h-0 w-full min-w-0 flex-1 overflow-auto rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-white via-indigo-50/30 to-sky-50/40 shadow-[0_12px_40px_rgba(49,46,129,0.1)]"
          : "w-full overflow-x-auto rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-white via-indigo-50/30 to-sky-50/40 shadow-[0_12px_40px_rgba(49,46,129,0.1)]"
      }
      style={flexibleHeight ? undefined : { minHeight: "min(72vh, 56rem)" }}
    >
      <div
        aria-label={
          nombreSemainesGrid(grid) > 1
            ? `Planning semaine ${semaineVue}`
            : "Planning hebdomadaire"
        }
        className="grid min-w-[min(100%,70rem)] gap-px bg-indigo-200/40 text-slate-900"
        style={{
          gridTemplateColumns: `minmax(3.5rem, 4.5vw) repeat(${colCount}, minmax(12.5rem, 1fr))`,
          gridTemplateRows,
        }}
      >
        <div className="sticky left-0 z-20 flex items-center justify-center bg-gradient-to-br from-indigo-100/95 via-indigo-50/90 to-sky-100/70 px-2 py-3 text-center text-[clamp(0.7rem,1vw,0.8rem)] font-bold uppercase tracking-[0.12em] text-indigo-800/90">
          Heure
        </div>
        {grid.joursSemaine.map((j) => {
          const dateEntete = dateEnteteParJourIso.get(j);
          return (
            <div
              key={j}
              className="flex flex-col items-center justify-center gap-[0.35vh] bg-gradient-to-br from-indigo-50/95 via-white to-sky-50/80 px-2 py-3 text-center text-[clamp(0.8rem,1.15vw,0.95rem)] font-bold text-indigo-950"
            >
              <span>{JOUR_LABEL[j] ?? `Jour ${j}`}</span>
              {dateEntete ? (
                <span className="block max-w-full truncate text-[clamp(0.62rem,0.95vw,0.78rem)] font-medium normal-case tracking-normal text-slate-600">
                  {dateEntete}
                </span>
              ) : null}
            </div>
          );
        })}

        {heures.map((h, i) => (
          <Fragment key={h}>
            <div
              className="sticky left-0 z-10 flex min-h-[6rem] items-center justify-end border-r border-indigo-100/90 bg-gradient-to-r from-indigo-50/95 to-white/90 px-2 text-[clamp(0.8rem,1.1vw,0.95rem)] font-semibold tabular-nums text-indigo-900"
              style={{ gridColumn: 1, gridRow: 2 + i }}
            >
              {h}h
            </div>
            {grid.joursSemaine.map((jour, di) => {
              const blocks = blocksByJour.get(jour) ?? [];
              const covering = blocksCoveringHour(blocks, h);
              const isContinuation = covering.some((b) => b.startHour < h);
              if (isContinuation) {
                return null;
              }
              const startsHere = covering.filter((b) => b.startHour === h);
              /** Ordre gauche→droite des colonnes parallèles : nom formation (fr), pas ObjectId. */
              const orderedStarts =
                startsHere.length <= 1
                  ? startsHere
                  : [...startsHere].sort((a, b) => {
                      const nf = formationSortLabel(
                        planningData,
                        a.formationId
                      ).localeCompare(
                        formationSortLabel(planningData, b.formationId),
                        "fr",
                        { sensitivity: "base" }
                      );
                      if (nf !== 0) return nf;
                      return a.matiereId.localeCompare(b.matiereId);
                    });
              const col = 2 + di;
              const rowLine = 2 + i;

              if (orderedStarts.length === 0) {
                return (
                  <div
                    key={`${jour}-${h}-libre`}
                    className="flex min-h-[6rem] items-center justify-center border-l border-indigo-50/80 bg-gradient-to-br from-sky-50/50 via-white to-indigo-50/25 p-2 text-[clamp(0.75rem,1vw,0.85rem)] font-medium text-sky-700/45"
                    style={{ gridColumn: col, gridRow: rowLine }}
                  >
                    Libre
                  </div>
                );
              }

              if (orderedStarts.length === 1) {
                const b = orderedStarts[0];
                const span = b.endHour - b.startHour;
                const rowEnd = rowLine + span;
                return (
                  <div
                    key={`${jour}-${b.startHour}-${b.sessions[0].id}`}
                    className="flex min-h-0 h-full flex-col border-l border-indigo-100/70 bg-gradient-to-b from-white/98 to-indigo-50/20 p-2"
                    style={{
                      gridColumn: col,
                      gridRow: `${rowLine} / ${rowEnd}`,
                    }}
                  >
                    <MergedBlockCard
                      block={b}
                      planningData={planningData}
                      professorColorOverride={
                        professorColorOverrideByProfId?.[b.professeurId]
                      }
                      highlighted={blockIsHighlighted(b, highlightSessionIds)}
                      swapTargetHighlighted={blockIsSwapTarget(
                        b,
                        swapTargetSessionIds,
                        highlightSessionIds
                      )}
                      onContextMenu={
                        onBlockContextMenu != null
                          ? (e) => onBlockContextMenu(e, b)
                          : undefined
                      }
                    />
                  </div>
                );
              }

              const maxParallelSpan = Math.max(
                1,
                ...orderedStarts.map((b) => b.endHour - b.startHour)
              );
              const parallelRowEnd = rowLine + maxParallelSpan;

              return (
                <div
                  key={`${jour}-${h}-stack`}
                  className="flex min-h-0 h-full flex-col border-l border-indigo-100/70 bg-gradient-to-b from-white/98 to-sky-50/15"
                  style={{
                    gridColumn: col,
                    gridRow: `${rowLine} / ${parallelRowEnd}`,
                  }}
                >
                  <StackedStartBlocks
                    blocks={orderedStarts}
                    planningData={planningData}
                    professorColorOverrideByProfId={
                      professorColorOverrideByProfId
                    }
                    highlightSessionIds={highlightSessionIds}
                    swapTargetSessionIds={swapTargetSessionIds}
                    onBlockContextMenu={onBlockContextMenu}
                  />
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
