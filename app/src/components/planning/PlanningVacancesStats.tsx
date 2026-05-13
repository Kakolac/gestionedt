"use client";

import { useMemo } from "react";
import type { PlanningData, PlanningGridConfig } from "@/lib/planning/planning.types";
import { isoDateCivilPourSlot } from "@/lib/planning/planning-public-holidays";

type VacancePeriodeInfo = {
  formationId: string;
  formationNom: string;
  debut: string;
  fin: string;
  nom: string;
  sessionsBloquees: number;
};

type PlacementStats = {
  totalSessions: number;
  scheduled: number;
  unscheduled: number;
  pending: number;
  tauxPlacement: number;
  vacancesPeriodes: VacancePeriodeInfo[];
  totalSessionsBloqueesParVacances: number;
};

function computePlacementStats(
  planningData: PlanningData,
  grid: PlanningGridConfig
): PlacementStats {
  const totalSessions = planningData.sessions.length;
  const scheduled = planningData.sessions.filter((s) => s.statut === "scheduled").length;
  const unscheduled = planningData.sessions.filter((s) => s.statut === "unscheduled").length;
  const pending = planningData.sessions.filter((s) => s.statut === "pending").length;
  const tauxPlacement = totalSessions > 0 ? Math.round((scheduled / totalSessions) * 10000) / 100 : 0;

  const vacancesPeriodes: VacancePeriodeInfo[] = [];
  let totalSessionsBloqueesParVacances = 0;

  for (const demand of planningData.demands) {
    if (!demand.formationDatesVacances || demand.formationDatesVacances.length === 0) {
      continue;
    }

    for (const periode of demand.formationDatesVacances) {
      const sessionsThisPeriod = planningData.sessions.filter((s) => {
        if (s.demandId !== demand.id) return false;
        if (s.statut !== "unscheduled" || !s.assignedSlot) {
          return false;
        }
        const slotDay = isoDateCivilPourSlot(grid, s.assignedSlot);
        if (!slotDay) return false;
        return slotDay >= periode.debut && slotDay <= periode.fin;
      }).length;

      vacancesPeriodes.push({
        formationId: demand.formationId,
        formationNom: demand.formationNom,
        debut: periode.debut,
        fin: periode.fin,
        nom: periode.nom,
        sessionsBloquees: sessionsThisPeriod,
      });

      totalSessionsBloqueesParVacances += sessionsThisPeriod;
    }
  }

  return {
    totalSessions,
    scheduled,
    unscheduled,
    pending,
    tauxPlacement,
    vacancesPeriodes,
    totalSessionsBloqueesParVacances,
  };
}

function tauxBadgeClass(taux: number): string {
  if (taux >= 90) {
    return "border-emerald-300/90 bg-emerald-600 text-white";
  }
  if (taux >= 70) {
    return "border-amber-300/90 bg-amber-500 text-amber-950";
  }
  return "border-red-300/90 bg-red-600 text-white";
}

function formatDate(dateIso: string): string {
  try {
    const parts = dateIso.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateIso;
  } catch {
    return dateIso;
  }
}

type Props = {
  planningData: PlanningData;
  grid: PlanningGridConfig;
  onTryReplacement?: () => void;
  replacementLoading?: boolean;
  replacementResult?: {
    avant: number;
    apres: number;
    nouvellementPlacees: number;
  } | null;
};

export function PlanningVacancesStats({
  planningData,
  grid,
  onTryReplacement,
  replacementLoading,
  replacementResult,
}: Props) {
  const stats = useMemo(
    () => computePlacementStats(planningData, grid),
    [planningData, grid]
  );

  const hasVacances = stats.vacancesPeriodes.length > 0;

  return (
    <section
      aria-labelledby="planning-vacances-titre"
      className="w-full max-w-[min(96vw,72rem)] rounded-2xl border border-violet-200/90 bg-gradient-to-br from-violet-50/95 via-white to-fuchsia-50/45 px-[3vw] py-[2vh] text-slate-900 shadow-[0_8px_28px_rgba(139,92,246,0.08)]"
    >
      <h2
        id="planning-vacances-titre"
        className="text-[clamp(1rem,1.6vw,1.15rem)] font-semibold text-violet-950"
      >
        Résultat final du placement (avec contraintes de vacances)
      </h2>
      <p className="mt-[1vh] text-[clamp(0.8rem,1.15vw,0.95rem)] leading-relaxed text-violet-900/85">
        Statistiques sur le placement des séances après application du{" "}
        <strong>placement ciblé optimisé</strong> qui préserve les sessions déjà planifiées
        et ne tente de placer que les sessions non planifiées, en respectant les périodes
        de vacances définies pour chaque formation.
      </p>

      <div className="mt-[1.5vh] flex flex-wrap items-center gap-[2vw]">
        <span
          className={`inline-flex rounded-full border px-[2.5vw] py-[0.75vh] text-[clamp(0.78rem,1.1vw,0.88rem)] font-semibold shadow-sm ${tauxBadgeClass(stats.tauxPlacement)}`}
        >
          Taux de placement : {stats.tauxPlacement.toLocaleString("fr-FR")} %
        </span>
      </div>

      <dl className="mt-[2vh] grid grid-cols-1 gap-[2vh] sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white/70 px-[2vw] py-[1.5vh] shadow-sm">
          <dt className="text-[clamp(0.72rem,1vw,0.82rem)] font-medium text-slate-600">
            Total séances
          </dt>
          <dd className="mt-[0.5vh] text-[clamp(1.2rem,2vw,1.5rem)] font-bold text-slate-900">
            {stats.totalSessions}
          </dd>
        </div>

        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-[2vw] py-[1.5vh] shadow-sm">
          <dt className="text-[clamp(0.72rem,1vw,0.82rem)] font-medium text-emerald-800">
            Planifiées
          </dt>
          <dd className="mt-[0.5vh] text-[clamp(1.2rem,2vw,1.5rem)] font-bold text-emerald-900">
            {stats.scheduled}
          </dd>
          <p className="mt-[0.25vh] text-[clamp(0.68rem,0.95vw,0.78rem)] text-emerald-700">
            {stats.totalSessions > 0
              ? `${Math.round((stats.scheduled / stats.totalSessions) * 100)}%`
              : "0%"}
          </p>
        </div>

        <div className="rounded-xl border border-red-200/80 bg-red-50/60 px-[2vw] py-[1.5vh] shadow-sm">
          <dt className="text-[clamp(0.72rem,1vw,0.82rem)] font-medium text-red-800">
            Non planifiées
          </dt>
          <dd className="mt-[0.5vh] text-[clamp(1.2rem,2vw,1.5rem)] font-bold text-red-900">
            {stats.unscheduled}
          </dd>
          <p className="mt-[0.25vh] text-[clamp(0.68rem,0.95vw,0.78rem)] text-red-700">
            {stats.totalSessions > 0
              ? `${Math.round((stats.unscheduled / stats.totalSessions) * 100)}%`
              : "0%"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-[2vw] py-[1.5vh] shadow-sm">
          <dt className="text-[clamp(0.72rem,1vw,0.82rem)] font-medium text-slate-600">
            En attente
          </dt>
          <dd className="mt-[0.5vh] text-[clamp(1.2rem,2vw,1.5rem)] font-bold text-slate-900">
            {stats.pending}
          </dd>
          <p className="mt-[0.25vh] text-[clamp(0.68rem,0.95vw,0.78rem)] text-slate-600">
            {stats.totalSessions > 0
              ? `${Math.round((stats.pending / stats.totalSessions) * 100)}%`
              : "0%"}
          </p>
        </div>
      </dl>

      {hasVacances ? (
        <div className="mt-[2.5vh]">
          <details className="rounded-xl border border-violet-200/70 bg-white/80 shadow-sm">
            <summary className="cursor-pointer select-none px-[2.5vw] py-[1.25vh] text-[clamp(0.88rem,1.2vw,0.98rem)] font-semibold text-violet-950 marker:text-violet-500">
              Périodes de vacances définies ({stats.vacancesPeriodes.length})
            </summary>
            <div className="border-t border-violet-100/90 px-[2.5vw] py-[2vh]">
              {stats.vacancesPeriodes.length === 0 ? (
                <p className="text-[clamp(0.78rem,1.05vw,0.88rem)] text-slate-600">
                  Aucune période de vacances définie pour les formations de ce planning.
                </p>
              ) : (
                <div className="space-y-[1.5vh]">
                  {stats.vacancesPeriodes.map((periode, idx) => (
                    <div
                      key={`${periode.formationId}-${idx}`}
                      className="rounded-lg border border-violet-100 bg-violet-50/40 px-[2vw] py-[1.25vh]"
                    >
                      <h4 className="text-[clamp(0.82rem,1.1vw,0.92rem)] font-semibold text-violet-950">
                        {periode.nom}
                      </h4>
                      <dl className="mt-[0.75vh] grid grid-cols-1 gap-x-[3vw] gap-y-[0.5vh] text-[clamp(0.75rem,1vw,0.85rem)] sm:grid-cols-2">
                        <div>
                          <dt className="inline font-medium text-violet-800">Formation : </dt>
                          <dd className="inline text-slate-800">{periode.formationNom}</dd>
                        </div>
                        <div>
                          <dt className="inline font-medium text-violet-800">Période : </dt>
                          <dd className="inline text-slate-800">
                            du {formatDate(periode.debut)} au {formatDate(periode.fin)}
                          </dd>
                        </div>
                        {periode.sessionsBloquees > 0 ? (
                          <div className="sm:col-span-2">
                            <dt className="inline font-medium text-red-800">
                              Sessions bloquées :{" "}
                            </dt>
                            <dd className="inline font-semibold text-red-900">
                              {periode.sessionsBloquees} séance
                              {periode.sessionsBloquees > 1 ? "s" : ""}
                            </dd>
                            <span className="ml-[1vw] text-red-700">
                              (non planifiée{periode.sessionsBloquees > 1 ? "s" : ""} en raison
                              des vacances)
                            </span>
                          </div>
                        ) : (
                          <div className="sm:col-span-2">
                            <span className="text-emerald-700">
                              ✓ Aucune session n'a été bloquée par cette période
                            </span>
                          </div>
                        )}
                      </dl>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>
      ) : (
        <div className="mt-[2vh] rounded-xl border border-slate-200/70 bg-slate-50/50 px-[2.5vw] py-[1.5vh]">
          <p className="text-[clamp(0.78rem,1.05vw,0.88rem)] text-slate-600">
            Aucune période de vacances n'est définie pour les formations de ce planning.
            Les séances peuvent être placées sur tous les créneaux disponibles (sous réserve
            des autres contraintes : professeur, formation, salles, etc.).
          </p>
        </div>
      )}

      <div className="mt-[2vh] rounded-xl border border-indigo-200/60 bg-indigo-50/40 px-[2.5vw] py-[1.5vh]">
        <h3 className="text-[clamp(0.85rem,1.15vw,0.95rem)] font-semibold text-indigo-950">
          Placement ciblé optimisé
        </h3>
        <p className="mt-[0.75vh] text-[clamp(0.75rem,1.05vw,0.88rem)] leading-relaxed text-indigo-900/90">
          Le système utilise un <strong>placement ciblé</strong> qui :
        </p>
        <ul className="mt-[1vh] space-y-[0.5vh] text-[clamp(0.72rem,1vw,0.85rem)] text-indigo-900/85">
          <li className="flex items-start gap-[1vw]">
            <span className="text-emerald-600">✓</span>
            <span>
              Préserve toutes les sessions déjà <strong>planifiées</strong> (aucun déplacement)
            </span>
          </li>
          <li className="flex items-start gap-[1vw]">
            <span className="text-emerald-600">✓</span>
            <span>
              Ne tente de placer que les sessions <strong>non planifiées</strong>
            </span>
          </li>
          <li className="flex items-start gap-[1vw]">
            <span className="text-emerald-600">✓</span>
            <span>
              Respecte automatiquement les <strong>périodes de vacances</strong>
            </span>
          </li>
          <li className="flex items-start gap-[1vw]">
            <span className="text-emerald-600">✓</span>
            <span>
              Est <strong>~10x plus rapide</strong> qu'un re-placement complet
            </span>
          </li>
        </ul>
      </div>

      {stats.unscheduled > 0 && onTryReplacement ? (
        <div className="mt-[2vh] space-y-[1.5vh]">
          <div className="rounded-xl border border-violet-200/70 bg-violet-50/40 px-[2.5vw] py-[1.5vh]">
            <h3 className="text-[clamp(0.85rem,1.15vw,0.95rem)] font-semibold text-violet-950">
              Tentative de re-placement automatique
            </h3>
            <p className="mt-[0.75vh] text-[clamp(0.75rem,1.05vw,0.88rem)] leading-relaxed text-violet-900/90">
              Il reste <strong className="text-red-700">{stats.unscheduled} séance{stats.unscheduled > 1 ? 's' : ''} non planifiée{stats.unscheduled > 1 ? 's' : ''}</strong>.
              Vous pouvez tenter un re-placement automatique qui va :
            </p>
            <ul className="mt-[1vh] space-y-[0.5vh] text-[clamp(0.72rem,1vw,0.85rem)] text-violet-900/85">
              <li className="flex items-start gap-[1vw]">
                <span className="text-violet-600">→</span>
                <span>Identifier tous les créneaux libres (sans collision avec les séances déjà planifiées)</span>
              </li>
              <li className="flex items-start gap-[1vw]">
                <span className="text-violet-600">→</span>
                <span>Tenter de placer les séances non planifiées dans ces créneaux libres</span>
              </li>
              <li className="flex items-start gap-[1vw]">
                <span className="text-violet-600">→</span>
                <span>Respecter toutes les contraintes (vacances, professeur, formation, salles)</span>
              </li>
            </ul>
            
            <button
              type="button"
              onClick={onTryReplacement}
              disabled={replacementLoading}
              className="mt-[1.5vh] w-full rounded-lg border border-violet-300 bg-violet-600 px-[2.5vw] py-[1.25vh] text-[clamp(0.82rem,1.1vw,0.92rem)] font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {replacementLoading ? (
                <span className="flex items-center justify-center gap-[1vw]">
                  <svg className="h-[1.5vh] w-[1.5vh] animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Re-placement en cours...
                </span>
              ) : (
                `Tenter de replacer les ${stats.unscheduled} séances non planifiées`
              )}
            </button>
          </div>
          
          {replacementResult && !replacementLoading ? (
            <div className={`rounded-xl border px-[2.5vw] py-[1.5vh] ${
              replacementResult.nouvellementPlacees > 0
                ? 'border-emerald-200/80 bg-emerald-50/60'
                : 'border-amber-200/80 bg-amber-50/60'
            }`}>
              <h4 className={`text-[clamp(0.82rem,1.1vw,0.92rem)] font-semibold ${
                replacementResult.nouvellementPlacees > 0
                  ? 'text-emerald-950'
                  : 'text-amber-950'
              }`}>
                Résultat du re-placement
              </h4>
              <dl className="mt-[1vh] space-y-[0.5vh] text-[clamp(0.75rem,1vw,0.85rem)]">
                <div>
                  <dt className="inline font-medium">Avant : </dt>
                  <dd className="inline">{replacementResult.avant} séances non planifiées</dd>
                </div>
                <div>
                  <dt className="inline font-medium">Après : </dt>
                  <dd className="inline">{replacementResult.apres} séances non planifiées</dd>
                </div>
                <div>
                  <dt className="inline font-medium">Résultat : </dt>
                  <dd className={`inline font-semibold ${
                    replacementResult.nouvellementPlacees > 0
                      ? 'text-emerald-800'
                      : 'text-amber-800'
                  }`}>
                    {replacementResult.nouvellementPlacees > 0 ? (
                      `${replacementResult.nouvellementPlacees} séance${replacementResult.nouvellementPlacees > 1 ? 's' : ''} nouvellement placée${replacementResult.nouvellementPlacees > 1 ? 's' : ''} !`
                    ) : (
                      "Aucune séance supplémentaire n'a pu être placée (contraintes trop restrictives)"
                    )}
                  </dd>
                </div>
              </dl>
              {replacementResult.apres > 0 && (
                <p className="mt-[1vh] text-[clamp(0.72rem,0.95vw,0.82rem)] text-slate-600">
                  Les {replacementResult.apres} séances restantes ne peuvent pas être placées car elles violent une ou plusieurs contraintes (vacances, jours interdits, volumes max, pas de créneaux disponibles, etc.).
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-[1.5vh] text-[clamp(0.72rem,1vw,0.82rem)] text-slate-600">
        Les sessions <strong className="text-red-700">non planifiées</strong> peuvent être dues
        à des périodes de vacances, des contraintes de professeur (jours interdits, volumes max),
        des contraintes de formation (jours, heures), ou à un manque de créneaux disponibles.
      </p>
    </section>
  );
}
