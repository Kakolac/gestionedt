"use client";

import { useMemo } from "react";
import {
  computeComparisonStats,
  type ComparisonBreakdownNums,
  type ComparisonFormationMatiereRow,
  type ComparisonParFormationRow,
  type ComparisonParMatiereRow,
} from "@/lib/planning/planning-comparison-stats";
import type { PlanningData } from "@/lib/planning/planning.types";

function formatHeures(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
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

function tauxCellClass(taux: number): string {
  if (taux >= 90) return "font-medium text-emerald-800";
  if (taux >= 70) return "font-medium text-amber-800";
  return "font-medium text-red-800";
}

function EcartCell({ ecart }: { ecart: number }) {
  const cls =
    ecart > 0
      ? "text-amber-800"
      : ecart < 0
        ? "text-violet-800"
        : "text-slate-700";
  return (
    <span className={cls}>
      {ecart > 0 ? "+" : ""}
      {formatHeures(ecart)}
    </span>
  );
}

function BreakdownCells({ row }: { row: ComparisonBreakdownNums }) {
  return (
    <>
      <td className="whitespace-nowrap px-[1.5vw] py-[1vh] text-right tabular-nums">
        {formatHeures(row.heuresPrevu)}
      </td>
      <td className="whitespace-nowrap px-[1.5vw] py-[1vh] text-right tabular-nums">
        {formatHeures(row.heuresPlanifiees)}
      </td>
      <td className="whitespace-nowrap px-[1.5vw] py-[1vh] text-right tabular-nums">
        {formatHeures(row.heuresNonPlanifiees)}
      </td>
      <td className="whitespace-nowrap px-[1.5vw] py-[1vh] text-right tabular-nums">
        <EcartCell ecart={row.ecartHeures} />
      </td>
      <td className="whitespace-nowrap px-[1.5vw] py-[1vh] text-right tabular-nums">
        {row.nombreSeancesTotal}
      </td>
      <td className="whitespace-nowrap px-[1.5vw] py-[1vh] text-right tabular-nums">
        {row.nombreSeancesPlanifiees}
      </td>
      <td className="whitespace-nowrap px-[1.5vw] py-[1vh] text-right tabular-nums">
        {row.nombreSeancesNonPlanifiees}
      </td>
      <td
        className={`whitespace-nowrap px-[1.5vw] py-[1vh] text-right tabular-nums ${tauxCellClass(row.tauxPlacement)}`}
      >
        {row.tauxPlacement.toLocaleString("fr-FR")} %
      </td>
    </>
  );
}

const TABLE_HEAD =
  "border-b border-indigo-200/80 bg-indigo-100/50 text-left text-[clamp(0.7rem,1vw,0.82rem)] font-semibold text-indigo-950";

type Props = {
  planningData: PlanningData;
};

/**
 * Récapitulatif global : contrat (demandes) vs séances générées après placement,
 * avec tableaux par formation, par matière et par couple formation × matière.
 */
export function PlanningComparisonStats({ planningData }: Props) {
  const stats = useMemo(
    () => computeComparisonStats(planningData),
    [planningData]
  );

  return (
    <section
      aria-labelledby="planning-comparaison-titre"
      className="w-full max-w-[min(96vw,72rem)] rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/95 via-white to-violet-50/45 px-[3vw] py-[2vh] text-slate-900 shadow-[0_8px_28px_rgba(49,46,129,0.08)]"
    >
      <h2
        id="planning-comparaison-titre"
        className="text-[clamp(1rem,1.6vw,1.15rem)] font-semibold text-indigo-950"
      >
        Comparaison — données du référentiel et planning fabriqué
      </h2>
      <p className="mt-[1vh] text-[clamp(0.8rem,1.15vw,0.95rem)] leading-relaxed text-indigo-900/85">
        Indicateurs calculés à partir des <strong>mêmes</strong> chargements que la
        grille : volume prévu dans les demandes (aligné sur le snapshot) et séances
        après normalisation + placement (y compris vos échanges manuels tant que la
        page n’est pas rechargée). Les tableaux détaillent les totaux par{" "}
        <strong>formation</strong>, par <strong>matière</strong> (toutes formations) et
        par <strong>formation et matière</strong> (lignes pédagogiques regroupées, tous
        professeurs confondus sur la même ligne snapshot).
      </p>

      <div className="mt-[1.5vh] flex flex-wrap items-center gap-[2vw]">
        <span
          className={`inline-flex rounded-full border px-[2.5vw] py-[0.75vh] text-[clamp(0.78rem,1.1vw,0.88rem)] font-semibold shadow-sm ${tauxBadgeClass(stats.tauxPlacement)}`}
        >
          Taux de placement : {stats.tauxPlacement.toLocaleString("fr-FR")} %
        </span>
      </div>

      <dl className="mt-[2vh] flex flex-wrap gap-x-[4vw] gap-y-[1.5vh] text-[clamp(0.78rem,1.1vw,0.9rem)]">
        <div>
          <dt className="font-medium text-indigo-800">Heures prévues (somme demandes)</dt>
          <dd className="text-slate-800">{formatHeures(stats.heuresPrevu)} h</dd>
        </div>
        <div>
          <dt className="font-medium text-indigo-800">Heures sur créneaux (séances planifiées)</dt>
          <dd className="text-slate-800">{formatHeures(stats.heuresPlanifiees)} h</dd>
        </div>
        <div>
          <dt className="font-medium text-indigo-800">Heures non placées (séances restantes)</dt>
          <dd className="text-slate-800">{formatHeures(stats.heuresNonPlanifiees)} h</dd>
        </div>
        <div>
          <dt className="font-medium text-indigo-800">Écart contrat → créneaux</dt>
          <dd
            className={
              stats.ecartHeures > 0
                ? "font-medium text-amber-800"
                : stats.ecartHeures < 0
                  ? "font-medium text-violet-800"
                  : "text-slate-800"
            }
          >
            {stats.ecartHeures > 0 ? "+" : ""}
            {formatHeures(stats.ecartHeures)} h
            <span className="ml-[1vw] block text-[0.92em] font-normal text-slate-600 sm:inline sm:ml-[0.5vw]">
              (prévu moins planifié)
            </span>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-indigo-800">Séances — total</dt>
          <dd className="text-slate-800">{stats.nombreSeancesTotal}</dd>
        </div>
        <div>
          <dt className="font-medium text-indigo-800">Séances — planifiées</dt>
          <dd className="text-slate-800">{stats.nombreSeancesPlanifiees}</dd>
        </div>
        <div>
          <dt className="font-medium text-indigo-800">Séances — non planifiées</dt>
          <dd className="text-slate-800">{stats.nombreSeancesNonPlanifiees}</dd>
        </div>
      </dl>

      <div className="mt-[2.5vh] space-y-[2vh]">
        <details className="rounded-xl border border-indigo-200/70 bg-white/80 shadow-sm">
          <summary className="cursor-pointer select-none px-[2.5vw] py-[1.25vh] text-[clamp(0.88rem,1.2vw,0.98rem)] font-semibold text-indigo-950 marker:text-indigo-500">
            Détail par formation ({stats.parFormation.length})
          </summary>
          <div className="max-w-full overflow-x-auto border-t border-indigo-100/90">
            <table className="w-full min-w-[min(92vw,48rem)] border-collapse text-[clamp(0.72rem,1.05vw,0.85rem)]">
              <thead>
                <tr>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh]`}>
                    Formation
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Prévu (h)
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Planif. (h)
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Non placé (h)
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Écart (h)
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Séances
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Planif.
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Non planif.
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Taux
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.parFormation.map((row: ComparisonParFormationRow) => (
                  <tr
                    key={row.formationId}
                    className="border-b border-slate-100/90 odd:bg-white even:bg-indigo-50/30"
                  >
                    <th
                      scope="row"
                      className="max-w-[min(40vw,16rem)] px-[1.5vw] py-[1vh] text-left font-medium text-slate-900"
                    >
                      {row.formationNom}
                    </th>
                    <BreakdownCells row={row} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details className="rounded-xl border border-indigo-200/70 bg-white/80 shadow-sm">
          <summary className="cursor-pointer select-none px-[2.5vw] py-[1.25vh] text-[clamp(0.88rem,1.2vw,0.98rem)] font-semibold text-indigo-950 marker:text-indigo-500">
            Détail par matière — toutes formations ({stats.parMatiere.length})
          </summary>
          <div className="max-w-full overflow-x-auto border-t border-indigo-100/90">
            <table className="w-full min-w-[min(92vw,48rem)] border-collapse text-[clamp(0.72rem,1.05vw,0.85rem)]">
              <thead>
                <tr>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh]`}>
                    Matière
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Prévu (h)
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Planif. (h)
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Non placé (h)
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Écart (h)
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Séances
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Planif.
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Non planif.
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Taux
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.parMatiere.map((row: ComparisonParMatiereRow) => (
                  <tr
                    key={row.matiereId}
                    className="border-b border-slate-100/90 odd:bg-white even:bg-indigo-50/30"
                  >
                    <th
                      scope="row"
                      className="max-w-[min(40vw,16rem)] px-[1.5vw] py-[1vh] text-left font-medium text-slate-900"
                    >
                      {row.matiereNom}
                    </th>
                    <BreakdownCells row={row} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details className="rounded-xl border border-indigo-200/70 bg-white/80 shadow-sm">
          <summary className="cursor-pointer select-none px-[2.5vw] py-[1.25vh] text-[clamp(0.88rem,1.2vw,0.98rem)] font-semibold text-indigo-950 marker:text-indigo-500">
            Détail formation et matière ({stats.formationMatiere.length})
          </summary>
          <div className="max-w-full overflow-x-auto border-t border-indigo-100/90">
            <table className="w-full min-w-[min(96vw,56rem)] border-collapse text-[clamp(0.72rem,1.05vw,0.85rem)]">
              <thead>
                <tr>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh]`}>
                    Formation
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh]`}>
                    Matière
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Prévu (h)
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Planif. (h)
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Non placé (h)
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Écart (h)
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Séances
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Planif.
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Non planif.
                  </th>
                  <th scope="col" className={`${TABLE_HEAD} px-[1.5vw] py-[1vh] text-right`}>
                    Taux
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.formationMatiere.map((row: ComparisonFormationMatiereRow) => (
                  <tr
                    key={`${row.formationId}-${row.matiereId}`}
                    className="border-b border-slate-100/90 odd:bg-white even:bg-indigo-50/30"
                  >
                    <td className="max-w-[min(36vw,14rem)] px-[1.5vw] py-[1vh] font-medium text-slate-900">
                      {row.formationNom}
                    </td>
                    <td className="max-w-[min(36vw,14rem)] px-[1.5vw] py-[1vh] text-slate-800">
                      {row.matiereNom}
                    </td>
                    <BreakdownCells row={row} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <p className="mt-[1.5vh] text-[clamp(0.72rem,1vw,0.82rem)] text-slate-600">
        En <strong>mode répété</strong>, les heures prévues affichées dans les demandes
        restent les volumes <strong>annuels</strong> du référentiel ; les séances
        planifiées reflètent le motif répété sur le gabarit (voir la doc planning).
      </p>
    </section>
  );
}
