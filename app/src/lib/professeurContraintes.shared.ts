/** Types / constantes partagés client + serveur (aucune dépendance Mongoose). */

export const PROFESSEUR_CONTRAINTE_KINDS = [
  "jours_travail",
  "bloc_consecutif_matiere",
  "volume_jour_matiere",
] as const;

export type ProfesseurContrainteKind =
  (typeof PROFESSEUR_CONTRAINTE_KINDS)[number];

export const CONTRAINTE_MAX_COUNT = 50;
export const MAX_HEURES_CONSECUTIVES = 12;
export const MAX_COURS_PAR_JOUR = 20;

/**
 * Représentation échangée formulaire → action (JSON `contraintesJson`).
 * Priorité : plus la valeur est faible, plus la contrainte est prioritaire pour un futur arbitrage EDT.
 */
export type ProfesseurContrainteWire =
  | {
      kind: "jours_travail";
      priorite: number;
      actif: boolean;
      joursSemaine: number[];
    }
  | {
      kind: "bloc_consecutif_matiere";
      priorite: number;
      actif: boolean;
      matiereId: string;
      maxHeuresConsecutives: number;
    }
  | {
      kind: "volume_jour_matiere";
      priorite: number;
      actif: boolean;
      matiereId: string;
      maxCoursParJour: number;
    };

export function isProfesseurContrainteKind(
  x: string
): x is ProfesseurContrainteKind {
  return (PROFESSEUR_CONTRAINTE_KINDS as readonly string[]).includes(x);
}

/** Même règle que Mongoose `isValidObjectId` pour éviter d’importer `mongoose` côté client. */
export function isLikelyMongoObjectId(id: string): boolean {
  return /^[0-9a-f]{24}$/i.test(id.trim());
}

export function canonObjectIdKey(id: string): string {
  return id.trim().toLowerCase();
}

export function matiereIdSet(matiereIds: string[]): Set<string> {
  const s = new Set<string>();
  for (const id of matiereIds) {
    const c = canonObjectIdKey(id);
    if (c) {
      s.add(c);
    }
  }
  return s;
}
