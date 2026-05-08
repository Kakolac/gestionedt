import type { PlanningData } from "@/lib/planning/planning.types";

/** Agrégat numérique commun (global, formation, matière ou couple formation–matière). */
export type ComparisonBreakdownNums = {
  heuresPrevu: number;
  heuresPlanifiees: number;
  heuresNonPlanifiees: number;
  nombreSeancesTotal: number;
  nombreSeancesPlanifiees: number;
  nombreSeancesNonPlanifiees: number;
  tauxPlacement: number;
  ecartHeures: number;
};

/** Statistiques globales : contrat (demandes) vs séances générées et placement. */
export type ComparisonStats = ComparisonBreakdownNums;

/** Détail pour une formation (somme de toutes ses matières). */
export type ComparisonParFormationRow = ComparisonBreakdownNums & {
  formationId: string;
  formationNom: string;
};

/** Détail pour une matière, toutes formations confondues. */
export type ComparisonParMatiereRow = ComparisonBreakdownNums & {
  matiereId: string;
  matiereNom: string;
};

/** Détail par couple formation × matière (plusieurs profs sur la même ligne sont regroupés). */
export type ComparisonFormationMatiereRow = ComparisonBreakdownNums & {
  formationId: string;
  formationNom: string;
  matiereId: string;
  matiereNom: string;
};

export type ComparisonStatsExtended = ComparisonStats & {
  parFormation: ComparisonParFormationRow[];
  parMatiere: ComparisonParMatiereRow[];
  formationMatiere: ComparisonFormationMatiereRow[];
};

type PartialAgg = {
  heuresPrevu: number;
  heuresPlanifiees: number;
  heuresNonPlanifiees: number;
  nombreSeancesPlanifiees: number;
  nombreSeancesNonPlanifiees: number;
};

function formationMatiereKey(formationId: string, matiereId: string): string {
  return `${formationId}::${matiereId}`;
}

function toBreakdown(p: PartialAgg): ComparisonBreakdownNums {
  const nombreSeancesTotal =
    p.nombreSeancesPlanifiees + p.nombreSeancesNonPlanifiees;
  const tauxPlacement =
    nombreSeancesTotal > 0
      ? Math.round((p.nombreSeancesPlanifiees / nombreSeancesTotal) * 1000) /
        10
      : 100;
  const ecartHeures =
    Math.round((p.heuresPrevu - p.heuresPlanifiees) * 100) / 100;
  return {
    heuresPrevu: p.heuresPrevu,
    heuresPlanifiees: p.heuresPlanifiees,
    heuresNonPlanifiees: p.heuresNonPlanifiees,
    nombreSeancesTotal,
    nombreSeancesPlanifiees: p.nombreSeancesPlanifiees,
    nombreSeancesNonPlanifiees: p.nombreSeancesNonPlanifiees,
    tauxPlacement,
    ecartHeures,
  };
}

function emptyPartial(): PartialAgg {
  return {
    heuresPrevu: 0,
    heuresPlanifiees: 0,
    heuresNonPlanifiees: 0,
    nombreSeancesPlanifiees: 0,
    nombreSeancesNonPlanifiees: 0,
  };
}

function addSessionToPartial(p: PartialAgg, duree: number, scheduled: boolean) {
  if (scheduled) {
    p.heuresPlanifiees += duree;
    p.nombreSeancesPlanifiees += 1;
  } else {
    p.heuresNonPlanifiees += duree;
    p.nombreSeancesNonPlanifiees += 1;
  }
}

/**
 * Agrégation pour comparer le volume issu des demandes et le résultat du placement
 * (y compris retouches manuelles si `planningData.sessions` les reflète).
 */
export function computeComparisonStats(
  planningData: PlanningData
): ComparisonStatsExtended {
  const fmMap = new Map<
    string,
    PartialAgg & {
      formationId: string;
      formationNom: string;
      matiereId: string;
      matiereNom: string;
    }
  >();

  function ensureFm(
    formationId: string,
    matiereId: string,
    formationNomFallback: string,
    matiereNomFallback: string
  ) {
    const k = formationMatiereKey(formationId, matiereId);
    let row = fmMap.get(k);
    if (!row) {
      row = {
        ...emptyPartial(),
        formationId,
        formationNom: formationNomFallback,
        matiereId,
        matiereNom: matiereNomFallback,
      };
      fmMap.set(k, row);
    }
    return row;
  }

  for (const d of planningData.demands) {
    const row = ensureFm(
      d.formationId,
      d.matiereId,
      d.formationNom,
      d.matiereNom
    );
    row.heuresPrevu += Number(d.nombreHeuresPrevues) || 0;
    if (d.formationNom?.trim()) row.formationNom = d.formationNom.trim();
    if (d.matiereNom?.trim()) row.matiereNom = d.matiereNom.trim();
  }

  for (const s of planningData.sessions) {
    const refF = planningData.references.formations.find(
      (x) => x.id === s.formationId
    );
    const refM = planningData.references.matieres.find(
      (x) => x.id === s.matiereId
    );
    const row = ensureFm(
      s.formationId,
      s.matiereId,
      refF?.nom ?? s.formationId,
      refM?.nom ?? s.matiereId
    );
    if (refF?.nom?.trim()) row.formationNom = refF.nom.trim();
    if (refM?.nom?.trim()) row.matiereNom = refM.nom.trim();

    const scheduled = s.statut === "scheduled";
    addSessionToPartial(row, s.duree, scheduled);
  }

  const formationMatiere: ComparisonFormationMatiereRow[] = [...fmMap.values()]
    .map((r) => {
      const {
        formationId,
        formationNom,
        matiereId,
        matiereNom,
        ...partial
      } = r;
      return {
        formationId,
        formationNom,
        matiereId,
        matiereNom,
        ...toBreakdown(partial),
      };
    })
    .sort((a, b) => {
      const c = a.formationNom.localeCompare(b.formationNom, "fr", {
        sensitivity: "base",
      });
      if (c !== 0) return c;
      return a.matiereNom.localeCompare(b.matiereNom, "fr", {
        sensitivity: "base",
      });
    });

  const byFormation = new Map<
    string,
    PartialAgg & { formationId: string; formationNom: string }
  >();
  for (const row of formationMatiere) {
    let agg = byFormation.get(row.formationId);
    if (!agg) {
      agg = {
        ...emptyPartial(),
        formationId: row.formationId,
        formationNom: row.formationNom,
      };
      byFormation.set(row.formationId, agg);
    }
    agg.heuresPrevu += row.heuresPrevu;
    agg.heuresPlanifiees += row.heuresPlanifiees;
    agg.heuresNonPlanifiees += row.heuresNonPlanifiees;
    agg.nombreSeancesPlanifiees += row.nombreSeancesPlanifiees;
    agg.nombreSeancesNonPlanifiees += row.nombreSeancesNonPlanifiees;
    if (row.formationNom.trim()) agg.formationNom = row.formationNom;
  }

  const parFormation: ComparisonParFormationRow[] = [...byFormation.values()]
    .map((r) => ({
      formationId: r.formationId,
      formationNom: r.formationNom,
      ...toBreakdown({
        heuresPrevu: r.heuresPrevu,
        heuresPlanifiees: r.heuresPlanifiees,
        heuresNonPlanifiees: r.heuresNonPlanifiees,
        nombreSeancesPlanifiees: r.nombreSeancesPlanifiees,
        nombreSeancesNonPlanifiees: r.nombreSeancesNonPlanifiees,
      }),
    }))
    .sort((a, b) =>
      a.formationNom.localeCompare(b.formationNom, "fr", {
        sensitivity: "base",
      })
    );

  const byMatiere = new Map<
    string,
    PartialAgg & { matiereId: string; matiereNom: string }
  >();
  for (const row of formationMatiere) {
    let agg = byMatiere.get(row.matiereId);
    if (!agg) {
      agg = {
        ...emptyPartial(),
        matiereId: row.matiereId,
        matiereNom: row.matiereNom,
      };
      byMatiere.set(row.matiereId, agg);
    }
    agg.heuresPrevu += row.heuresPrevu;
    agg.heuresPlanifiees += row.heuresPlanifiees;
    agg.heuresNonPlanifiees += row.heuresNonPlanifiees;
    agg.nombreSeancesPlanifiees += row.nombreSeancesPlanifiees;
    agg.nombreSeancesNonPlanifiees += row.nombreSeancesNonPlanifiees;
    if (row.matiereNom.trim()) agg.matiereNom = row.matiereNom;
  }

  const parMatiere: ComparisonParMatiereRow[] = [...byMatiere.values()]
    .map((r) => ({
      matiereId: r.matiereId,
      matiereNom: r.matiereNom,
      ...toBreakdown({
        heuresPrevu: r.heuresPrevu,
        heuresPlanifiees: r.heuresPlanifiees,
        heuresNonPlanifiees: r.heuresNonPlanifiees,
        nombreSeancesPlanifiees: r.nombreSeancesPlanifiees,
        nombreSeancesNonPlanifiees: r.nombreSeancesNonPlanifiees,
      }),
    }))
    .sort((a, b) =>
      a.matiereNom.localeCompare(b.matiereNom, "fr", { sensitivity: "base" })
    );

  const globalPartial = emptyPartial();
  for (const d of planningData.demands) {
    globalPartial.heuresPrevu += Number(d.nombreHeuresPrevues) || 0;
  }
  for (const s of planningData.sessions) {
    addSessionToPartial(globalPartial, s.duree, s.statut === "scheduled");
  }

  return {
    ...toBreakdown(globalPartial),
    parFormation,
    parMatiere,
    formationMatiere,
  };
}
