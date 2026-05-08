/** Types / constantes partagés client + serveur (aucune dépendance Mongoose). */

export const MATIERE_CONTRAINTE_KINDS = ["plage_horaire"] as const;

export type MatiereContrainteKind =
  (typeof MATIERE_CONTRAINTE_KINDS)[number];

/** Seuil horaire (heure entière) entre matin et après-midi : créneau matin = fin ≤ seuil ; après-midi = début ≥ seuil. */
export const PLAGE_HORAIRE_SEUIL_MIDI = 12;

/** Au plus ce nombre de contraintes par document Matière. */
export const CONTRAINTE_MAX_COUNT_MATIERE = 20;

/**
 * Priorités strictement supérieures à cette valeur = contrainte « souple » : le placement
 * reste possible hors plage (pénalité dans le coût local).
 * Priorités ≤ cette valeur = contrainte « stricte » : hors plage bloque dans `sessionPlacementBlocker`.
 */
export const MATIERE_PRIORITE_MAX_STRICT = 50;

/** Valeur suggérée à la création d’une ligne dans l’UI : zone **stricte** (≤ `MATIERE_PRIORITE_MAX_STRICT` ⇒ blocage si hors plage). */
export const MATIERE_PRIORITE_DEFAUT_EDITION = 25;

export const MATIERE_PLAGES = ["matin", "apres_midi"] as const;
export type MatierePlageHoraire = (typeof MATIERE_PLAGES)[number];

/**
 * Représentation échangée formulaire → action (JSON `contraintesJson`).
 * Convention priorité : plus la valeur est faible, plus la contrainte est prioritaire pour l’arbitrage ;
 * le caractère strict/souple utilise `MATIERE_PRIORITE_MAX_STRICT`.
 */
export type MatiereContrainteWire = {
  kind: "plage_horaire";
  priorite: number;
  actif: boolean;
  plage: MatierePlageHoraire;
};

export function isMatiereContrainteKind(x: string): x is MatiereContrainteKind {
  return (MATIERE_CONTRAINTE_KINDS as readonly string[]).includes(x);
}

export function isMatierePlageHoraire(x: string): x is MatierePlageHoraire {
  return (MATIERE_PLAGES as readonly string[]).includes(x);
}

/** True si le créneau [heureDebut, heureFin) est entièrement dans la plage demandée. */
export function slotMatchesPlageHoraire(
  heureDebut: number,
  heureFin: number,
  plage: MatierePlageHoraire,
  seuilMidi: number = PLAGE_HORAIRE_SEUIL_MIDI
): boolean {
  if (plage === "matin") {
    return heureFin <= seuilMidi && heureDebut < heureFin;
  }
  return heureDebut >= seuilMidi && heureDebut < heureFin;
}

/** Stricte si priorité ≤ MATIERE_PRIORITE_MAX_STRICT. */
export function matiereContrainteEstStricte(priorite: number): boolean {
  return priorite <= MATIERE_PRIORITE_MAX_STRICT;
}
