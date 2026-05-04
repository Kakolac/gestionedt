import mongoose from "mongoose";
import {
  CONTRAINTE_MAX_COUNT,
  MAX_COURS_PAR_JOUR,
  MAX_HEURES_CONSECUTIVES,
  canonObjectIdKey,
  isLikelyMongoObjectId,
  isProfesseurContrainteKind,
  matiereIdSet,
  type ProfesseurContrainteKind,
  type ProfesseurContrainteWire,
} from "@/lib/professeurContraintes.shared";

export type {
  ProfesseurContrainteKind,
  ProfesseurContrainteWire,
} from "@/lib/professeurContraintes.shared";

export {
  CONTRAINTE_MAX_COUNT,
  MAX_COURS_PAR_JOUR,
  MAX_HEURES_CONSECUTIVES,
  PROFESSEUR_CONTRAINTE_KINDS,
} from "@/lib/professeurContraintes.shared";

export type ProfesseurContrainteMongo = {
  kind: ProfesseurContrainteKind;
  priorite: number;
  actif: boolean;
  joursSemaine?: number[];
  matiereId?: mongoose.Types.ObjectId;
  maxHeuresConsecutives?: number;
  maxCoursParJour?: number;
};

/**
 * Valide et normalise le JSON posté ; les `matiereId` des contraintes doivent être dans `matiereIds`.
 */
export function parseContraintesJsonForSave(
  rawJson: unknown,
  matiereIds: string[]
): { ok: true; contraintes: ProfesseurContrainteMongo[] } | { ok: false; error: string } {
  let parsed: unknown;
  if (rawJson === null || rawJson === undefined) {
    parsed = [];
  } else if (typeof rawJson === "string") {
    const t = rawJson.trim();
    if (!t) {
      parsed = [];
    } else {
      try {
        parsed = JSON.parse(t) as unknown;
      } catch {
        return { ok: false, error: "Contraintes : JSON invalide." };
      }
    }
  } else {
    parsed = rawJson;
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Contraintes : liste attendue." };
  }
  if (parsed.length > CONTRAINTE_MAX_COUNT) {
    return {
      ok: false,
      error: `Contraintes : maximum ${CONTRAINTE_MAX_COUNT} entrées.`,
    };
  }

  const allowedMatieres = matiereIdSet(matiereIds);
  const out: ProfesseurContrainteMongo[] = [];

  let countJoursTravail = 0;
  const blocMatieres = new Set<string>();
  const volumeMatieres = new Set<string>();

  for (let i = 0; i < parsed.length; i += 1) {
    const entry = parsed[i];
    if (!entry || typeof entry !== "object") {
      return {
        ok: false,
        error: `Contrainte #${i + 1} : entrée invalide.`,
      };
    }
    const o = entry as Record<string, unknown>;

    const kindRaw = o.kind;
    if (typeof kindRaw !== "string" || !isProfesseurContrainteKind(kindRaw)) {
      return {
        ok: false,
        error: `Contrainte #${i + 1} : type inconnu.`,
      };
    }

    const pr = o.priorite;
    if (typeof pr !== "number" || !Number.isFinite(pr) || !Number.isInteger(pr)) {
      return {
        ok: false,
        error: `Contrainte #${i + 1} : priorité entière requise.`,
      };
    }

    const actif = o.actif !== false;

    if (kindRaw === "jours_travail") {
      const joursRaw = o.joursSemaine;
      if (!Array.isArray(joursRaw) || joursRaw.length === 0) {
        return {
          ok: false,
          error: `Contrainte #${i + 1} : choisir au moins un jour (lundi–dimanche).`,
        };
      }
      const days: number[] = [];
      for (const j of joursRaw) {
        const n = typeof j === "number" ? j : Number(j);
        if (!Number.isInteger(n) || n < 1 || n > 7) {
          return {
            ok: false,
            error: `Contrainte #${i + 1} : jours 1–7 uniquement (1=lundi).`,
          };
        }
        days.push(n);
      }
      const unique = [...new Set(days)].sort((a, b) => a - b);
      countJoursTravail += 1;
      if (countJoursTravail > 1) {
        return {
          ok: false,
          error:
            "Une seule contrainte « Jours de travail » est autorisée. Retirez les doublons ou fusionnez les jours dans une seule ligne.",
        };
      }
      out.push({
        kind: "jours_travail",
        priorite: pr,
        actif,
        joursSemaine: unique,
      });
      continue;
    }

    const midRaw = o.matiereId;
    if (typeof midRaw !== "string" || !mongoose.isValidObjectId(midRaw.trim())) {
      return {
        ok: false,
        error: `Contrainte #${i + 1} : matière invalide.`,
      };
    }
    const mid = midRaw.trim();
    if (!allowedMatieres.has(canonObjectIdKey(mid))) {
      return {
        ok: false,
        error: `Contrainte #${i + 1} : la matière doit être parmi les matières cochées pour ce professeur.`,
      };
    }
    const oid = new mongoose.Types.ObjectId(mid);
    const midKey = canonObjectIdKey(mid);

    if (kindRaw === "bloc_consecutif_matiere") {
      if (blocMatieres.has(midKey)) {
        return {
          ok: false,
          error: `Contrainte #${i + 1} : une seule contrainte « Heures consécutives » par matière.`,
        };
      }
      blocMatieres.add(midKey);
      const mx = o.maxHeuresConsecutives;
      const n =
        typeof mx === "number" ? mx : typeof mx === "string" ? Number(mx) : NaN;
      if (!Number.isInteger(n) || n < 1 || n > MAX_HEURES_CONSECUTIVES) {
        return {
          ok: false,
          error: `Contrainte #${i + 1} : heures consécutives entre 1 et ${MAX_HEURES_CONSECUTIVES}.`,
        };
      }
      out.push({
        kind: "bloc_consecutif_matiere",
        priorite: pr,
        actif,
        matiereId: oid,
        maxHeuresConsecutives: n,
      });
      continue;
    }

    if (volumeMatieres.has(midKey)) {
      return {
        ok: false,
        error: `Contrainte #${i + 1} : une seule contrainte « Cours par jour » par matière (déjà utilisée pour l’une des matières choisies).`,
      };
    }
    volumeMatieres.add(midKey);

    const mx = o.maxCoursParJour;
    const n =
      typeof mx === "number" ? mx : typeof mx === "string" ? Number(mx) : NaN;
    if (!Number.isInteger(n) || n < 1 || n > MAX_COURS_PAR_JOUR) {
      return {
        ok: false,
        error: `Contrainte #${i + 1} : cours par jour entre 1 et ${MAX_COURS_PAR_JOUR}.`,
      };
    }
    out.push({
      kind: "volume_jour_matiere",
      priorite: pr,
      actif,
      matiereId: oid,
      maxCoursParJour: n,
    });
  }

  return { ok: true, contraintes: out };
}

/** Convertit un document lean Mongo vers le format fil de fer (formulaire client). */
export function leanWireFromContraintesDoc(raw: unknown): ProfesseurContrainteWire[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: ProfesseurContrainteWire[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const o = item as Record<string, unknown>;
    const kind = typeof o.kind === "string" ? o.kind : "";
    if (!isProfesseurContrainteKind(kind)) {
      continue;
    }
    const pr = typeof o.priorite === "number" ? o.priorite : Number(o.priorite);
    const priorite = Number.isFinite(pr) ? Math.trunc(pr) : 0;
    const actif = o.actif !== false;

    if (kind === "jours_travail") {
      const joursRaw = o.joursSemaine;
      if (!Array.isArray(joursRaw)) {
        continue;
      }
      const days = joursRaw
        .map((j) => (typeof j === "number" ? j : Number(j)))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
      if (days.length === 0) {
        continue;
      }
      out.push({
        kind: "jours_travail",
        priorite,
        actif,
        joursSemaine: [...new Set(days)].sort((a, b) => a - b),
      });
      continue;
    }

    let mid = "";
    const ref = o.matiereId;
    if (ref && typeof ref === "object" && ref !== null && "_bsontype" in ref) {
      mid = String((ref as { toString(): string }).toString());
    } else if (typeof ref === "string") {
      mid = ref;
    } else {
      mid = String(ref ?? "");
    }
    mid = mid.trim();
    if (!isLikelyMongoObjectId(mid)) {
      continue;
    }

    if (kind === "bloc_consecutif_matiere") {
      const mx = o.maxHeuresConsecutives;
      const n = typeof mx === "number" ? mx : Number(mx);
      if (!Number.isInteger(n) || n < 1) {
        continue;
      }
      out.push({
        kind: "bloc_consecutif_matiere",
        priorite,
        actif,
        matiereId: mid,
        maxHeuresConsecutives: n,
      });
      continue;
    }

    const mx = o.maxCoursParJour;
    const n = typeof mx === "number" ? mx : Number(mx);
    if (!Number.isInteger(n) || n < 1) {
      continue;
    }
    out.push({
      kind: "volume_jour_matiere",
      priorite,
      actif,
      matiereId: mid,
      maxCoursParJour: n,
    });
  }

  return out;
}
