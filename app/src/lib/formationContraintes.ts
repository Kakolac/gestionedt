import {
  FORMATION_CONTRAINTE_KINDS,
  defaultFormationContraintesWire,
  isFormationContrainteKind,
  type FormationContrainteKind,
  type FormationContrainteWire,
} from "@/lib/formationContraintes.shared";

export type {
  FormationContrainteKind,
  FormationContrainteWire,
} from "@/lib/formationContraintes.shared";

export {
  FORMATION_CONTRAINTE_KINDS,
  defaultFormationContraintesWire,
  formationPauseChevaucheCreneau,
  isFormationContrainteKind,
} from "@/lib/formationContraintes.shared";

export type FormationContrainteMongo = {
  kind: FormationContrainteKind;
  heureDebut?: number;
  heureFin?: number;
  heureMin?: number;
  heureFinMax?: number;
  joursSemaine?: number[];
};

/** Valeurs par défaut au **stockage** (`Formation.create` sans champ explicite). */
export function defaultFormationContraintesMongo(): FormationContrainteMongo[] {
  const w = defaultFormationContraintesWire();
  return w.map((x) => {
    switch (x.kind) {
      case "pause_midi":
        return {
          kind: x.kind,
          heureDebut: x.heureDebut,
          heureFin: x.heureFin,
        };
      case "heure_demarrage":
        return { kind: x.kind, heureMin: x.heureMin };
      case "heure_fin":
        return { kind: x.kind, heureFinMax: x.heureFinMax };
      case "jours_formation":
        return { kind: x.kind, joursSemaine: [...x.joursSemaine] };
    }
  });
}

function heureEntiere(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return Number.isInteger(n) ? n : Math.floor(v);
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Valide le JSON posté : exactement **une** entrée par kind, cohérence horaires et jours.
 */
export function parseFormationContraintesJsonForSave(
  rawJson: unknown
):
  | { ok: true; contraintes: FormationContrainteMongo[] }
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
        return { ok: false, error: "Contraintes formation : JSON invalide." };
      }
    }
  } else {
    parsed = rawJson;
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Contraintes formation : liste attendue." };
  }

  if (parsed.length !== FORMATION_CONTRAINTE_KINDS.length) {
    return {
      ok: false,
      error: `Contraintes formation : exactement ${FORMATION_CONTRAINTE_KINDS.length} entrées requises (pause midi, heure démarrage, heure fin, jours).`,
    };
  }

  const seenKind = new Set<string>();
  let pause: FormationContrainteMongo | null = null;
  let dem: FormationContrainteMongo | null = null;
  let fin: FormationContrainteMongo | null = null;
  let jours: FormationContrainteMongo | null = null;

  for (let i = 0; i < parsed.length; i += 1) {
    const entry = parsed[i];
    if (!entry || typeof entry !== "object") {
      return {
        ok: false,
        error: `Contrainte formation #${i + 1} : entrée invalide.`,
      };
    }
    const o = entry as Record<string, unknown>;
    const kindRaw = o.kind;
    if (typeof kindRaw !== "string" || !isFormationContrainteKind(kindRaw)) {
      return {
        ok: false,
        error: `Contrainte formation #${i + 1} : type inconnu.`,
      };
    }
    if (seenKind.has(kindRaw)) {
      return {
        ok: false,
        error: `Contrainte formation : le type « ${kindRaw} » est en double.`,
      };
    }
    seenKind.add(kindRaw);

    if (kindRaw === "pause_midi") {
      const hd = heureEntiere(o.heureDebut);
      const hf = heureEntiere(o.heureFin);
      if (
        hd === null ||
        hf === null ||
        hd < 0 ||
        hf > 24 ||
        hd >= hf
      ) {
        return {
          ok: false,
          error: `Contrainte formation #${i + 1} : pause midi — heures entières 0–24 avec début < fin.`,
        };
      }
      pause = { kind: "pause_midi", heureDebut: hd, heureFin: hf };
      continue;
    }

    if (kindRaw === "heure_demarrage") {
      const hm = heureEntiere(o.heureMin);
      if (hm === null || hm < 0 || hm > 23) {
        return {
          ok: false,
          error: `Contrainte formation #${i + 1} : heure de démarrage entre 0 et 23.`,
        };
      }
      dem = { kind: "heure_demarrage", heureMin: hm };
      continue;
    }

    if (kindRaw === "heure_fin") {
      const hx = heureEntiere(o.heureFinMax);
      if (hx === null || hx < 1 || hx > 24) {
        return {
          ok: false,
          error: `Contrainte formation #${i + 1} : heure de fin entre 1 et 24 (inclusive).`,
        };
      }
      fin = { kind: "heure_fin", heureFinMax: hx };
      continue;
    }

    const jRaw = o.joursSemaine;
    if (!Array.isArray(jRaw) || jRaw.length === 0) {
      return {
        ok: false,
        error: `Contrainte formation #${i + 1} : choisir au moins un jour de formation.`,
      };
    }
    const days: number[] = [];
    for (const j of jRaw) {
      const n =
        typeof j === "number" ? j : typeof j === "string" ? Number(j) : NaN;
      if (!Number.isInteger(n) || n < 1 || n > 7) {
        return {
          ok: false,
          error: `Contrainte formation #${i + 1} : jours 1–7 uniquement (1=lundi).`,
        };
      }
      days.push(n);
    }
    const unique = [...new Set(days)].sort((a, b) => a - b);
    jours = { kind: "jours_formation", joursSemaine: unique };
  }

  if (
    seenKind.size !== FORMATION_CONTRAINTE_KINDS.length ||
    pause == null ||
    dem == null ||
    fin == null ||
    jours == null
  ) {
    return {
      ok: false,
      error:
        "Contraintes formation : les quatre types (pause midi, heure démarrage, heure fin, jours) sont obligatoires.",
    };
  }

  const heureMin = dem.heureMin!;
  const heureFinMax = fin.heureFinMax!;
  if (heureMin >= heureFinMax) {
    return {
      ok: false,
      error:
        "Contraintes formation : l’heure de démarrage doit être strictement inférieure à l’heure de fin.",
    };
  }

  const pd = pause.heureDebut!;
  const pf = pause.heureFin!;
  if (pd < heureMin || pf > heureFinMax) {
    return {
      ok: false,
      error:
        "Contraintes formation : la pause midi doit être comprise entre l’heure de démarrage et l’heure de fin.",
    };
  }

  const out: FormationContrainteMongo[] = [pause, dem, fin, jours];
  return { ok: true, contraintes: out };
}

/** Mongo lean → filaire formulaire / planning. */
export function leanWireFromFormationContraintesDoc(
  raw: unknown
): FormationContrainteWire[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  const byKind = new Map<FormationContrainteKind, FormationContrainteWire>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const kind = typeof o.kind === "string" ? o.kind : "";
    if (!isFormationContrainteKind(kind)) continue;

    if (kind === "pause_midi") {
      const hd = heureEntiere(o.heureDebut);
      const hf = heureEntiere(o.heureFin);
      if (hd === null || hf === null || hd >= hf) continue;
      byKind.set(kind, { kind: "pause_midi", heureDebut: hd, heureFin: hf });
      continue;
    }
    if (kind === "heure_demarrage") {
      const hm = heureEntiere(o.heureMin);
      if (hm === null || hm < 0 || hm > 23) continue;
      byKind.set(kind, { kind: "heure_demarrage", heureMin: hm });
      continue;
    }
    if (kind === "heure_fin") {
      const hx = heureEntiere(o.heureFinMax);
      if (hx === null || hx < 1 || hx > 24) continue;
      byKind.set(kind, { kind: "heure_fin", heureFinMax: hx });
      continue;
    }
    const jRaw = o.joursSemaine;
    if (!Array.isArray(jRaw) || jRaw.length === 0) continue;
    const days: number[] = [];
    for (const j of jRaw) {
      const n =
        typeof j === "number" ? j : typeof j === "string" ? Number(j) : NaN;
      if (!Number.isInteger(n) || n < 1 || n > 7) continue;
      days.push(n);
    }
    const unique = [...new Set(days)].sort((a, b) => a - b);
    if (unique.length === 0) continue;
    byKind.set(kind, { kind: "jours_formation", joursSemaine: unique });
  }

  const ordered: FormationContrainteWire[] = [];
  for (const k of FORMATION_CONTRAINTE_KINDS) {
    const v = byKind.get(k);
    if (v) ordered.push(v);
  }
  return ordered;
}

/**
 * Pour un export JSON : bloc absent ou incomplet → tableau vide (pas de filtre formation au planner — compatibilité).
 */
export function formationContraintesWirePourPlanning(raw: unknown): FormationContrainteWire[] {
  const ordered = leanWireFromFormationContraintesDoc(raw);
  return ordered.length === FORMATION_CONTRAINTE_KINDS.length ? ordered : [];
}

/** Complète avec les défauts les entrées manquantes (fiches legacy ou Lean partiel). */
export function mergeFormationDefaultsWire(
  list: FormationContrainteWire[]
): FormationContrainteWire[] {
  const defs = defaultFormationContraintesWire();
  const byKind = new Map(list.map((c) => [c.kind, c]));
  return defs.map((d) => {
    const o = byKind.get(d.kind);
    const src = o ?? d;
    return src.kind === "jours_formation"
      ? { ...src, joursSemaine: [...src.joursSemaine] }
      : { ...src };
  });
}

const JOUR_COURT_FR: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mer",
  4: "Jeu",
  5: "Ven",
  6: "Sam",
  7: "Dim",
};

/** Résumé une ligne du tableau administration (UI). */
export function formatFormationContraintesListeCourte(
  wires: FormationContrainteWire[]
): string {
  if (wires.length < FORMATION_CONTRAINTE_KINDS.length) {
    return "—";
  }
  let pause: Extract<FormationContrainteWire, { kind: "pause_midi" }> | null =
    null;
  let dem: Extract<FormationContrainteWire, { kind: "heure_demarrage" }> | null =
    null;
  let fin: Extract<FormationContrainteWire, { kind: "heure_fin" }> | null =
    null;
  let jours: Extract<
    FormationContrainteWire,
    { kind: "jours_formation" }
  > | null = null;
  for (const w of wires) {
    switch (w.kind) {
      case "pause_midi":
        pause = w;
        break;
      case "heure_demarrage":
        dem = w;
        break;
      case "heure_fin":
        fin = w;
        break;
      case "jours_formation":
        jours = w;
        break;
    }
  }
  if (!pause || !dem || !fin || !jours) {
    return "—";
  }
  const jlab = jours.joursSemaine
    .map((d) => JOUR_COURT_FR[d] ?? String(d))
    .join(" · ");
  return `${jlab} · ${dem.heureMin}h–${fin.heureFinMax}h · pause ${pause.heureDebut}h–${pause.heureFin}h`;
}
