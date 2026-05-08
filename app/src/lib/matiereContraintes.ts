import {
  CONTRAINTE_MAX_COUNT_MATIERE,
  isMatiereContrainteKind,
  isMatierePlageHoraire,
  type MatiereContrainteKind,
  type MatiereContrainteWire,
} from "@/lib/matiereContraintes.shared";

export type {
  MatiereContrainteKind,
  MatiereContrainteWire,
} from "@/lib/matiereContraintes.shared";

export {
  CONTRAINTE_MAX_COUNT_MATIERE,
  MATIERE_CONTRAINTE_KINDS,
  MATIERE_PRIORITE_DEFAUT_EDITION,
  MATIERE_PRIORITE_MAX_STRICT,
  PLAGE_HORAIRE_SEUIL_MIDI,
  MATIERE_PLAGES,
  slotMatchesPlageHoraire,
  matiereContrainteEstStricte,
} from "@/lib/matiereContraintes.shared";

export type MatiereContrainteMongo = {
  kind: MatiereContrainteKind;
  priorite: number;
  actif: boolean;
  plage?: "matin" | "apres_midi";
};

/**
 * Valide et normalise le JSON posté pour une matière.
 * Au plus une contrainte `plage_horaire` par matière (sinon combinaisons impossibles ou ambiguës).
 */
export function parseMatiereContraintesJsonForSave(
  rawJson: unknown
):
  | { ok: true; contraintes: MatiereContrainteMongo[] }
  | { ok: false; error: string } {
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
        return { ok: false, error: "Contraintes matière : JSON invalide." };
      }
    }
  } else {
    parsed = rawJson;
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Contraintes matière : liste attendue." };
  }
  if (parsed.length > CONTRAINTE_MAX_COUNT_MATIERE) {
    return {
      ok: false,
      error: `Contraintes matière : maximum ${CONTRAINTE_MAX_COUNT_MATIERE} entrées.`,
    };
  }

  const out: MatiereContrainteMongo[] = [];
  let countPlage = 0;

  for (let i = 0; i < parsed.length; i += 1) {
    const entry = parsed[i];
    if (!entry || typeof entry !== "object") {
      return {
        ok: false,
        error: `Contrainte matière #${i + 1} : entrée invalide.`,
      };
    }
    const o = entry as Record<string, unknown>;

    const kindRaw = o.kind;
    if (typeof kindRaw !== "string" || !isMatiereContrainteKind(kindRaw)) {
      return {
        ok: false,
        error: `Contrainte matière #${i + 1} : type inconnu.`,
      };
    }

    const pr = o.priorite;
    if (typeof pr !== "number" || !Number.isFinite(pr) || !Number.isInteger(pr)) {
      return {
        ok: false,
        error: `Contrainte matière #${i + 1} : priorité entière requise.`,
      };
    }

    const actif = o.actif !== false;

    if (kindRaw === "plage_horaire") {
      countPlage += 1;
      if (countPlage > 1) {
        return {
          ok: false,
          error:
            "Une seule contrainte « Plage horaire (matin / après-midi) » est autorisée par matière.",
        };
      }
      const plageRaw = o.plage;
      if (typeof plageRaw !== "string" || !isMatierePlageHoraire(plageRaw)) {
        return {
          ok: false,
          error: `Contrainte matière #${i + 1} : plage « matin » ou « apres_midi » requise.`,
        };
      }
      out.push({
        kind: "plage_horaire",
        priorite: pr,
        actif,
        plage: plageRaw,
      });
    }
  }

  return { ok: true, contraintes: out };
}

/** Convertit un document lean Mongo vers le format fil de fer (formulaire client). */
export function leanWireFromMatiereContraintesDoc(
  raw: unknown
): MatiereContrainteWire[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: MatiereContrainteWire[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const o = item as Record<string, unknown>;
    const kind = typeof o.kind === "string" ? o.kind : "";
    if (kind !== "plage_horaire") {
      continue;
    }
    const pr = typeof o.priorite === "number" ? o.priorite : Number(o.priorite);
    const priorite = Number.isFinite(pr) ? Math.trunc(pr) : 0;
    const actif = o.actif !== false;
    const plageRaw = o.plage;
    if (typeof plageRaw !== "string" || !isMatierePlageHoraire(plageRaw)) {
      continue;
    }
    out.push({
      kind: "plage_horaire",
      priorite,
      actif,
      plage: plageRaw,
    });
  }
  return out;
}
