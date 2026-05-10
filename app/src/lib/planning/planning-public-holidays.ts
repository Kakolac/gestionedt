import Holidays from "date-holidays";
import { slotSemaine } from "@/lib/planning/planning-slot";
import type {
  AssignedSlot,
  PlanningExportRaw,
  PlanningGridConfig,
} from "@/lib/planning/planning.types";

/** Types de jours fériés pris en compte pour bloquer un cours (pas les « observance » / école). */
const HOLIDAY_TYPES_BLOCKS: Array<"public" | "bank"> = ["public", "bank"];

/** Pays proposés en administration (ISO 3166-1 alpha-2). Aligné sur `date-holidays`. */
export const LOCALISATIONS_FERIES_ADMIN_OPTIONS: readonly {
  code: string;
  labelFr: string;
}[] = [
  { code: "FR", labelFr: "France" },
  { code: "BE", labelFr: "Belgique" },
  { code: "CH", labelFr: "Suisse" },
  { code: "DE", labelFr: "Allemagne" },
  { code: "LU", labelFr: "Luxembourg" },
  { code: "ES", labelFr: "Espagne" },
  { code: "IT", labelFr: "Italie" },
  { code: "NL", labelFr: "Pays-Bas" },
  { code: "AT", labelFr: "Autriche" },
  { code: "PT", labelFr: "Portugal" },
  { code: "CA", labelFr: "Canada" },
];

export function isLocalisationPaysSupporteeAdmin(code: string): boolean {
  const u = code.trim().toUpperCase();
  return LOCALISATIONS_FERIES_ADMIN_OPTIONS.some((x) => x.code === u);
}

export function libellePaysLocalisationAdmin(code: string): string {
  const u = code.trim().toUpperCase();
  if (!u) return "—";
  const o = LOCALISATIONS_FERIES_ADMIN_OPTIONS.find((x) => x.code === u);
  return o ? `${o.labelFr} (${o.code})` : u;
}

const holidaysCache = new Map<string, Holidays>();

function cacheKey(pays: string, subdivision?: string): string {
  const p = pays.trim().toUpperCase();
  const s = subdivision?.trim();
  return s ? `${p}|${s}` : p;
}

/**
 * Récupère une instance `Holidays` pour pays (+ subdivision optionnelle passée comme « state »
 * au sens `date-holidays`, ex. `WAL` pour la Belgique).
 */
function getHolidaysCached(pays: string, subdivision?: string): Holidays | null {
  const country = pays.trim().toUpperCase();
  if (!country) return null;
  const sub = subdivision?.trim();
  const key = cacheKey(country, sub);
  const existing = holidaysCache.get(key);
  if (existing) return existing;
  try {
    const opts = { types: HOLIDAY_TYPES_BLOCKS };
    const h =
      sub && sub.length > 0
        ? new Holidays(country, sub, opts)
        : new Holidays(country, opts);
    holidaysCache.set(key, h);
    return h;
  } catch {
    return null;
  }
}

/** Parse `YYYY-MM-DD` en date « civile » stable (midi UTC). */
export function parseIsoDateOnlyUtc(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (
    !Number.isFinite(y) ||
    mo < 0 ||
    mo > 11 ||
    d < 1 ||
    d > 31
  ) {
    return null;
  }
  const dt = new Date(Date.UTC(y, mo, d, 12, 0, 0));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

/** Lundi ISO : `getUTCDay() === 1`. */
export function estLundiGregorianUtc(date: Date): boolean {
  return date.getUTCDay() === 1;
}

/** Valide que la chaîne est un lundi au format ISO date. */
export function parseSemaine1LundiIso(
  iso: string | undefined
): Date | null {
  if (iso == null || iso.trim() === "") return null;
  const d = parseIsoDateOnlyUtc(iso.trim());
  if (!d || !estLundiGregorianUtc(d)) return null;
  return d;
}

/**
 * Lit une `dateDemarrageIso` depuis un export JSON / lean (chaîne seule, préfixe avant `T`,
 * ou objet `Date` BSON). Évite d’ignorer les valeurs du type `2026-05-18T12:00:00.000Z`.
 */
export function extractDateDemarrageIsoDepuisValeurExport(
  raw: unknown
): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    const withTail = /^(\d{4}-\d{2}-\d{2})(?:T|[\s]|$)/.exec(t);
    if (withTail && parseIsoDateOnlyUtc(withTail[1])) {
      return withTail[1];
    }
    const only = /^(\d{4}-\d{2}-\d{2})$/.exec(t);
    if (only && parseIsoDateOnlyUtc(only[1])) {
      return only[1];
    }
    return null;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getUTCFullYear();
    const mo = raw.getUTCMonth() + 1;
    const day = raw.getUTCDate();
    const iso = `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return parseIsoDateOnlyUtc(iso) ? iso : null;
  }
  return null;
}

/** `YYYY-MM-DD` UTC du jour civil du créneau (pour comparaisons lexicographiques). */
export function isoDateCivilPourSlot(
  grid: PlanningGridConfig,
  slot: AssignedSlot
): string | null {
  const d = dateCivilPourSlot(grid, slot);
  if (!d) return null;
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Date locale navigateur → `YYYY-MM-DD` (préférable à `toISOString().slice` pour les défauts de formulaire). */
export function isoDateCalendrierLocal(d: Date): string {
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Jour ISO projet (lun = 1 … dim = 7) pour une date à midi UTC. */
export function jourIsoDepuisDateUtc(d: Date): number {
  const dow = d.getUTCDay();
  return dow === 0 ? 7 : dow;
}

/**
 * Lundi de la même semaine civile (lun → dim) qu'une date `YYYY-MM-DD`,
 * renvoyé au format `YYYY-MM-DD` (composantes UTC).
 */
export function lundiSemaineCivileIsoPourDateIso(
  dateDemarrageIso: string
): string | null {
  const d = parseIsoDateOnlyUtc(dateDemarrageIso.trim());
  if (!d) return null;
  const isoJour = jourIsoDepuisDateUtc(d);
  const offsetBack = isoJour - 1;
  const mondayMs = d.getTime() - offsetBack * 86400000;
  const m = new Date(mondayMs);
  const y = m.getUTCFullYear();
  const mo = m.getUTCMonth() + 1;
  const day = m.getUTCDate();
  return `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Snapshot avec au moins une entrée dans `formations`. */
export function exportRawHasFormations(raw: PlanningExportRaw): boolean {
  const arr = raw.formations;
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * Plus petit lundi de semaine civile parmi les `dateDemarrageIso` des formations ;
 * sert de **`semaine1LundiIso`** par défaut pour la grille planning.
 */
export function deriveSemaine1LundiIsoDepuisExportRaw(
  raw: PlanningExportRaw
): string | null {
  const arr = raw.formations;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const mondays: string[] = [];
  for (const f of arr) {
    if (typeof f !== "object" || f === null) continue;
    const dd = extractDateDemarrageIsoDepuisValeurExport(
      (f as Record<string, unknown>).dateDemarrageIso
    );
    if (!dd) continue;
    const mon = lundiSemaineCivileIsoPourDateIso(dd);
    if (mon) mondays.push(mon);
  }
  if (mondays.length === 0) return null;
  mondays.sort();
  return mondays[0];
}

/**
 * Date civile du **jour** de la grille (sans heure de cours), à partir du lundi de la
 * semaine 1 (`semaine1LundiIso`) et des indices **semaine** (1-based) et **jour** ISO (1–7).
 */
export function dateCivilPourJourSemaine(
  grid: PlanningGridConfig,
  semaine: number,
  jourIso: number
): Date | null {
  const monday = parseSemaine1LundiIso(grid.semaine1LundiIso);
  if (!monday) return null;
  const w =
    typeof semaine === "number" && Number.isFinite(semaine) && semaine >= 1
      ? Math.floor(semaine)
      : 1;
  if (!Number.isInteger(jourIso) || jourIso < 1 || jourIso > 7) return null;
  const offsetDays = (w - 1) * 7 + (jourIso - 1);
  const ms = monday.getTime() + offsetDays * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

/** Libellé court français pour une date déjà en « jour civile » UTC (ex. entête colonne planning). */
export function formatDateEntetePlanningFrUtc(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Date civile du **jour** du créneau (sans tenir compte de l’heure de cours),
 * à partir du lundi de la semaine 1 et des indices `semaine` / `jour` ISO.
 */
export function dateCivilPourSlot(
  grid: PlanningGridConfig,
  slot: AssignedSlot
): Date | null {
  return dateCivilPourJourSemaine(grid, slotSemaine(slot), slot.jour);
}

export function holidaysCalculatorAvailable(
  pays: string,
  subdivision?: string
): boolean {
  return getHolidaysCached(pays, subdivision) != null;
}

export function exportRawHasFormationLocalisation(
  raw: PlanningExportRaw
): boolean {
  const arr = raw.formations;
  if (!Array.isArray(arr)) return false;
  for (const f of arr) {
    if (typeof f !== "object" || f === null) continue;
    const p = (f as Record<string, unknown>).localisationPays;
    if (typeof p === "string" && p.trim().length > 0) return true;
  }
  return false;
}

export function estJourFeriePourLocalisation(
  date: Date,
  pays: string,
  subdivision?: string
): boolean {
  const h = getHolidaysCached(pays, subdivision);
  if (!h) return false;
  const res = h.isHoliday(date);
  return res !== false && Array.isArray(res) && res.length > 0;
}
