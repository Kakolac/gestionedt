import type { FormationContrainteWire } from "@/lib/formationContraintes.shared";
import type { MatiereContrainteWire } from "@/lib/matiereContraintes.shared";
import type { ProfesseurContrainteWire } from "@/lib/professeurContraintes.shared";

/** Version du document `planningData` produit par la normalisation. */
export const PLANNING_DATA_VERSION = 1 as const;

/** Mode d’affectation des salles (aligné sur `Matiere` / export JSON). */
export type PlanningSalleMode = "classique" | "liste";

/** Durée possible d’une séance (créneau contigu sur la grille horaire). */
export type PlanningSeanceDureeHeures = 1 | 2 | 4;

/** Taille maximale d’un bloc lors du découpage des heures prévues (historique : `2`). */
export type PlanningMaxSeanceHeuresDecoupage = 2 | 4;

/** JSON d’export multi-formations (`exportFormationSnapshot`, ou équivalent mocké). */
export type PlanningExportRaw = {
  meta?: {
    version?: number;
    exportedAt?: string;
    formationIdsRequested?: string[];
    /**
     * Découpage des heures en séances : blocs jusqu’à 4 h si `4`.
     * Priorité inférieure à `PlanningGridConfig.maxSeanceHeures` passée au builder.
     */
    maxSeanceHeures?: PlanningMaxSeanceHeuresDecoupage;
  };
  formations?: unknown;
  matieres?: unknown;
  professeurs?: unknown;
};

/** Grille hebdomadaire répétée sur plusieurs semaines : pas d’1h, `heureFin` exclusive (dernier créneau 1h commence à `heureFin - 1`). */
export type PlanningGridConfig = {
  /** Nombre de semaines distinctes dans l’horizon (créneaux = semaine × jour × heure). Défaut implicite : 1. */
  nombreSemaines?: number;
  /**
   * Découpage des `nombreHeuresPrevues` : avec `4`, séquences 4 h puis 2 h puis 1 h ;
   * avec `2` ou absent, comportement historique (2 h puis 1 h). Prioritaire sur `meta.maxSeanceHeures`.
   */
  maxSeanceHeures?: PlanningMaxSeanceHeuresDecoupage;
  /** Jours ISO : 1 = lundi … 7 = dimanche. */
  joursSemaine: number[];
  heureDebut: number;
  heureFin: number;
  pasHeures: 1;
  /**
   * ISO date `YYYY-MM-DD` du **lundi** de la première semaine de grille (`semaine === 1`).
   * Déduit des **`dateDemarrageIso`** des formations du snapshot (plus tôt lundi de semaine civile) ou saisi manuellement ; requis pour placer dès qu’il y a des formations dans le jeu.
   */
  semaine1LundiIso?: string;
};

/** Ligne « formation » telle que lue dans le JSON (après narrow). */
export type FormationLigneNormalisee = {
  matiereId: string;
  professeurIds: string[];
  nombreHeuresPrevues: number;
};

export type FormationReference = {
  id: string;
  nom: string;
  lignes: FormationLigneNormalisee[];
  /**
   * Export incomplet → `[]` : pas de filtre formation au planner (rétrocompatibilité).
   * Si les quatre natures sont présentes, contraintes toujours strictes (`sessionPlacementBlocker`).
   */
  contraintes: FormationContrainteWire[];
  /** Pays ISO pour jours fériés (`date-holidays`) ; vide = pas de contrainte férié. */
  localisationPays?: string;
  /** Subdivision (ex. état / communauté) au sens `date-holidays`, optionnelle. */
  localisationRegion?: string;
  /** Date de démarrage civile `YYYY-MM-DD` (planning : lundi S1 = lundi de la même semaine lun–dim). */
  dateDemarrageIso?: string;
};

export type MatiereReference = {
  id: string;
  nom: string;
  salleMode: PlanningSalleMode;
  salleIds: string[];
  /** Contraintes référentiel matière (copiées sur chaque `PlanningDemand` comme `contraintesMatiere`). */
  contraintes: MatiereContrainteWire[];
};

export type ProfesseurReference = {
  id: string;
  prenom: string;
  nom: string;
  matiereIds: string[];
  contraintes: ProfesseurContrainteWire[];
};

export type PlanningMetaOut = {
  version: typeof PLANNING_DATA_VERSION;
  generatedAt: string;
  sourceExportedAt?: string;
};

export type PlanningReferences = {
  formations: FormationReference[];
  matieres: MatiereReference[];
  professeurs: ProfesseurReference[];
};

/** Partie « paquet » de séances pour une demande (découpage glouton, blocs jusqu’à `maxSeanceHeures`). */
export type SeanceDureePaquet = {
  duree: PlanningSeanceDureeHeures;
  quantite: number;
};

export type PlanningDemand = {
  id: string;
  formationId: string;
  formationNom: string;
  matiereId: string;
  matiereNom: string;
  professeurId: string;
  professeurNom: string;
  nombreHeuresPrevues: number;
  seances: SeanceDureePaquet[];
  salleMode: PlanningSalleMode;
  salleIds: string[];
  contraintesProfesseur: ProfesseurContrainteWire[];
  contraintesMatiere: MatiereContrainteWire[];
  /** Copie des contraintes formation ; vide si export sans bloc complet — sinon placement strict. */
  contraintesFormation: FormationContrainteWire[];
  localisationPays?: string;
  localisationRegion?: string;
  /** Date de démarrage civile `YYYY-MM-DD` — aucun cours placé avant ce jour (scheduler). */
  dateDemarrageIso?: string;
};

/** Créneau assigné : semaine 1-based × jour ISO × intervalle d’heures entières [heureDebut, heureFin) (fin exclusive). */
export type AssignedSlot = {
  /** Semaine dans l’horizon (1 = première semaine). Absent ou invalide → traité comme 1 (compatibilité JSON). */
  semaine?: number;
  jour: number;
  heureDebut: number;
  heureFin: number;
};

export type SessionStatut = "pending" | "scheduled" | "unscheduled";

export type PlanningSession = {
  id: string;
  demandId: string;
  formationId: string;
  matiereId: string;
  professeurId: string;
  duree: PlanningSeanceDureeHeures;
  statut: SessionStatut;
  assignedSlot?: AssignedSlot;
  assignedSalleId?: string;
};

export type PlanningData = {
  meta: PlanningMetaOut;
  references: PlanningReferences;
  demands: PlanningDemand[];
  sessions: PlanningSession[];
};
