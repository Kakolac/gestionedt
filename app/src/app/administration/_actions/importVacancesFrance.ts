"use server";

import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { PeriodeVacances } from "@/lib/models/PeriodeVacances";
import { PERMISSION_GESTION_VACANCES } from "@/lib/permissions/keys";
import { slugifyMetierLabel } from "@/lib/slugifyMetier";
import { revalidatePath } from "next/cache";
import {
  VACANCES_FRANCE_API_URL,
  API_TIMEOUT_MS,
  isAnneeScolaireValide,
  construireNomPeriode,
  isPeriodeNationale,
  type VacancesFranceAPIResponse,
  type VacancesFranceAPIRecord,
} from "@/lib/vacancesFrance";

export type ImportVacancesFranceState =
  | { ok: true; imported: number; skipped: number; message: string }
  | { ok: false; error: string };

const VACANCES_PATH = "/administration/gestion-vacances";

async function ensureVacancesPermission(): Promise<ImportVacancesFranceState | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Non connecté." };
  }
  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_GESTION_VACANCES,
  ]);
  if (!allowed) {
    return { ok: false, error: "Permission refusée." };
  }
  return null;
}

async function allocateUniqueSlug(
  label: string,
  existingSlugs: Set<string>
): Promise<string> {
  let base = slugifyMetierLabel(label);
  if (!base) base = "vacances";
  let candidate = base;
  let n = 0;
  
  for (;;) {
    // Vérifier d'abord dans le Set local (plus rapide)
    if (!existingSlugs.has(candidate)) {
      // Double-vérifier dans la base
      const existing = await PeriodeVacances.findOne({ slug: candidate })
        .select("_id")
        .lean();
      if (!existing) {
        existingSlugs.add(candidate);
        return candidate;
      }
    }
    n += 1;
    candidate = `${base}_${n}`;
  }
}

/**
 * Récupère les données de vacances depuis l'API Education Nationale
 */
async function fetchVacancesFromAPI(
  anneeScolaire: string
): Promise<VacancesFranceAPIResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const url = new URL(VACANCES_FRANCE_API_URL);
    url.searchParams.set("where", `annee_scolaire="${anneeScolaire}"`);
    url.searchParams.set("limit", "-1");
    url.searchParams.set("timezone", "UTC");

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Aucune donnée disponible pour l'année scolaire ${anneeScolaire}`);
      }
      throw new Error(`Erreur API (${response.status}): ${response.statusText}`);
    }

    const data = await response.json();
    return data as VacancesFranceAPIResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("Timeout: l'API n'a pas répondu dans les temps");
      }
      throw error;
    }
    throw new Error("Erreur inconnue lors de l'appel API");
  }
}

/**
 * Groupe les périodes par (description, zone) pour éviter les doublons
 */
function grouperPeriodes(records: VacancesFranceAPIRecord[]): Map<string, VacancesFranceAPIRecord> {
  const grouped = new Map<string, VacancesFranceAPIRecord>();
  
  for (const record of records) {
    // Filtrer uniquement les périodes pour les élèves (ou population non spécifiée)
    // L'API peut retourner "-" ou "Élèves" pour les périodes scolaires
    if (record.population && record.population !== "-" && record.population !== "Élèves") {
      continue;
    }
    
    const zone = record.zones || "";
    const key = `${record.description}|${zone}`;
    
    // Garder le premier enregistrement pour chaque groupe
    if (!grouped.has(key)) {
      grouped.set(key, record);
    }
  }
  
  return grouped;
}

/**
 * Importe les vacances scolaires françaises pour une année donnée
 */
export async function importVacancesFranceAction(
  anneeScolaire: string
): Promise<ImportVacancesFranceState> {
  // Vérifier la permission
  const denied = await ensureVacancesPermission();
  if (denied) return denied;

  // Valider l'année scolaire
  if (!isAnneeScolaireValide(anneeScolaire)) {
    return {
      ok: false,
      error: "Format d'année scolaire invalide (attendu: YYYY-YYYY, ex: 2025-2026)",
    };
  }

  try {
    // Appeler l'API
    const apiData = await fetchVacancesFromAPI(anneeScolaire);

    if (!apiData.results || apiData.results.length === 0) {
      return {
        ok: false,
        error: `Aucune donnée disponible pour l'année scolaire ${anneeScolaire}`,
      };
    }

    // Grouper les périodes pour éviter les doublons
    const periodesGroupees = grouperPeriodes(apiData.results);

    await connectDB();

    let imported = 0;
    let skipped = 0;
    const existingSlugs = new Set<string>();

    // Créer les périodes
    for (const record of periodesGroupees.values()) {
      const zone = record.zones || undefined;
      const nom = construireNomPeriode(record.description, anneeScolaire, zone);
      
      // Vérifier si une période avec ce nom existe déjà
      const existingByName = await PeriodeVacances.findOne({ nom }).select("_id").lean();
      if (existingByName) {
        skipped++;
        continue;
      }

      // Convertir les dates du format ISO au format YYYY-MM-DD
      const debut = record.start_date.split("T")[0];
      const fin = record.end_date.split("T")[0];

      // Valider les dates
      if (debut > fin) {
        console.warn(`Date invalide pour ${nom}: ${debut} > ${fin}`);
        skipped++;
        continue;
      }

      // Générer un slug unique
      const slug = await allocateUniqueSlug(nom, existingSlugs);

      // Construire la description
      let description = "";
      if (zone && !isPeriodeNationale(record.description)) {
        description = record.location || `Vacances pour la ${zone}`;
      } else {
        description = "Vacances communes à toutes les zones";
      }

      // Créer la période
      try {
        await PeriodeVacances.create({
          nom,
          slug,
          debut,
          fin,
          description,
        });
        imported++;
      } catch (e) {
        console.error(`Erreur lors de la création de ${nom}:`, e);
        skipped++;
      }
    }

    revalidatePath(VACANCES_PATH);

    if (imported === 0 && skipped > 0) {
      return {
        ok: false,
        error: `Toutes les périodes (${skipped}) existent déjà ou sont invalides`,
      };
    }

    let message = `${imported} période(s) importée(s) avec succès`;
    if (skipped > 0) {
      message += ` (${skipped} ignorée(s) car déjà existante(s))`;
    }

    return {
      ok: true,
      imported,
      skipped,
      message,
    };
  } catch (error) {
    console.error("Erreur lors de l'import des vacances:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("Aucune donnée disponible")) {
        return { ok: false, error: error.message };
      }
      if (error.message.includes("Timeout")) {
        return {
          ok: false,
          error: "L'API de l'Éducation nationale ne répond pas. Veuillez réessayer plus tard.",
        };
      }
      return {
        ok: false,
        error: `Erreur: ${error.message}`,
      };
    }
    
    return {
      ok: false,
      error: "Impossible de contacter l'API de l'Éducation nationale",
    };
  }
}
