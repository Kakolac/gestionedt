/**
 * Configuration et utilitaires pour l'import des vacances scolaires françaises
 * depuis l'API officielle du ministère de l'Éducation nationale.
 */

/** URL de l'API officielle data.education.gouv.fr */
export const VACANCES_FRANCE_API_URL =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records" as const;

/** Timeout pour les appels API (en millisecondes) */
export const API_TIMEOUT_MS = 30000;

/** Mapping des zones académiques avec leurs académies */
export const ZONES_ACADEMIQUES = {
  "Zone A": [
    "Besançon",
    "Bordeaux",
    "Clermont-Ferrand",
    "Dijon",
    "Grenoble",
    "Limoges",
    "Lyon",
    "Poitiers",
  ],
  "Zone B": [
    "Aix-Marseille",
    "Amiens",
    "Caen",
    "Lille",
    "Nancy-Metz",
    "Nantes",
    "Nice",
    "Orléans-Tours",
    "Reims",
    "Rennes",
    "Rouen",
    "Strasbourg",
  ],
  "Zone C": ["Créteil", "Montpellier", "Paris", "Toulouse", "Versailles"],
  "Corse": ["Ajaccio"],
} as const;

/**
 * Liste des périodes de vacances communes à toutes les zones
 * (qui ne nécessitent pas de mention de zone dans le nom)
 */
export const PERIODES_NATIONALES = [
  "Vacances de la Toussaint",
  "Vacances de Noël",
  "Vacances d'été",
  "Vacances de printemps",
] as const;

/**
 * Type pour les données retournées par l'API
 */
export type VacancesFranceAPIRecord = {
  annee_scolaire: string;
  description: string;
  population: string;
  zones?: string;
  start_date: string;
  end_date: string;
  location?: string;
};

export type VacancesFranceAPIResponse = {
  total_count: number;
  results: VacancesFranceAPIRecord[];
};

/**
 * Génère une liste d'années scolaires disponibles
 * (année courante - 1 à année courante + 2)
 */
export function getAnneesDisponibles(): string[] {
  const anneeActuelle = new Date().getFullYear();
  const annees: string[] = [];
  
  for (let i = -1; i <= 2; i++) {
    const debut = anneeActuelle + i;
    const fin = debut + 1;
    annees.push(`${debut}-${fin}`);
  }
  
  return annees;
}

/**
 * Valide le format d'une année scolaire (YYYY-YYYY)
 */
export function isAnneeScolaireValide(annee: string): boolean {
  const regex = /^\d{4}-\d{4}$/;
  if (!regex.test(annee)) return false;
  
  const [debut, fin] = annee.split("-").map(Number);
  return fin === debut + 1;
}

/**
 * Détermine si une période est nationale (commune à toutes les zones)
 */
export function isPeriodeNationale(description: string): boolean {
  return PERIODES_NATIONALES.some((p) =>
    description.toLowerCase().includes(p.toLowerCase())
  );
}

/**
 * Construit le nom d'une période selon qu'elle soit nationale ou zonée
 */
export function construireNomPeriode(
  description: string,
  annee: string,
  zone?: string
): string {
  // Extraire l'année de fin (ex: "2025-2026" → "2026")
  const anneeFin = annee.split("-")[1];
  
  if (!zone || isPeriodeNationale(description)) {
    return `${description} ${anneeFin}`;
  }
  
  return `${description} ${anneeFin} - ${zone}`;
}
