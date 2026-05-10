/** Types partagés client + serveur — contraintes de formation (toutes obligatoires au référentiel). */

export const FORMATION_CONTRAINTE_KINDS = [
  "pause_midi",
  "heure_demarrage",
  "heure_fin",
  "jours_formation",
] as const;

export type FormationContrainteKind =
  (typeof FORMATION_CONTRAINTE_KINDS)[number];

/**
 * Contraintes formation : **toujours appliquées** par le planner (pas de mode souple).
 * Ordre libre dans le JSON ; la validation impose exactement une entrée par `kind`.
 */
export type FormationContrainteWire =
  | {
      kind: "pause_midi";
      /** Début pause (heure entière), intervalle [heureDebut, heureFin) comme la grille planning. */
      heureDebut: number;
      heureFin: number;
    }
  | {
      kind: "heure_demarrage";
      /** Première heure autorisée pour le **début** d’un cours (`slot.heureDebut`). */
      heureMin: number;
    }
  | {
      kind: "heure_fin";
      /** Dernière heure de **fin** de cours autorisée, **inclusive** (`slot.heureFin ≤ heureFinMax`). */
      heureFinMax: number;
    }
  | {
      kind: "jours_formation";
      /** Jours où la formation peut être planifiée (1 = lundi … 7 = dimanche). */
      joursSemaine: number[];
    };

export function isFormationContrainteKind(x: string): x is FormationContrainteKind {
  return (FORMATION_CONTRAINTE_KINDS as readonly string[]).includes(x);
}

/** Chevauchement entre créneau cours [dD, dF) et pause [pD, pF) (fin exclusive des deux). */
export function formationPauseChevaucheCreneau(
  coursDebut: number,
  coursFin: number,
  pauseDebut: number,
  pauseFin: number
): boolean {
  return coursDebut < pauseFin && pauseDebut < coursFin;
}

/** Jeu par défaut à la création / pour données sans bloc contraintes en planning (compatibilité). */
export function defaultFormationContraintesWire(): FormationContrainteWire[] {
  return [
    { kind: "pause_midi", heureDebut: 12, heureFin: 13 },
    { kind: "heure_demarrage", heureMin: 8 },
    { kind: "heure_fin", heureFinMax: 18 },
    { kind: "jours_formation", joursSemaine: [1, 2, 3, 4, 5] },
  ];
}
