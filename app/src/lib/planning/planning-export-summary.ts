import type { PlanningExportRaw } from "@/lib/planning/planning.types";

export type ExportExtractLine = {
  matiereId: string;
  matiereNom: string;
  nombreHeuresPrevues: number;
  professeurIds: string[];
  professeurLabels: string[];
};

export type ExportExtractFormation = {
  id: string;
  nom: string;
  nombreHeuresFormation?: number;
  lignes: ExportExtractLine[];
  sommeHeuresLignes: number;
};

export type PlanningExportSummary = {
  exportedAt?: string;
  formationIdsRequested: string[];
  counts: {
    formations: number;
    matieres: number;
    professeurs: number;
    lignesTotal: number;
    sommeHeuresPrevues: number;
  };
  formations: ExportExtractFormation[];
  notes: string[];
};

function canonKey(id: string): string {
  return id.trim().toLowerCase();
}

function asNonNegativeInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.floor(v);
    return n >= 0 ? n : null;
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function idShort(id: string): string {
  const t = id.trim();
  if (t.length <= 10) return t;
  return `…${t.slice(-8)}`;
}

function buildMatiereNomMap(matieresRaw: unknown): Map<string, string> {
  const m = new Map<string, string>();
  if (!Array.isArray(matieresRaw)) return m;
  for (const item of matieresRaw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const id = o._id != null ? String(o._id).trim() : "";
    if (!id) continue;
    const nom =
      typeof o.nom === "string" && o.nom.trim()
        ? o.nom.trim()
        : "(sans nom)";
    m.set(canonKey(id), nom);
  }
  return m;
}

function buildProfLabelMap(profsRaw: unknown): Map<string, string> {
  const m = new Map<string, string>();
  if (!Array.isArray(profsRaw)) return m;
  for (const item of profsRaw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const id = o._id != null ? String(o._id).trim() : "";
    if (!id) continue;
    const prenom = typeof o.prenom === "string" ? o.prenom.trim() : "";
    const nom = typeof o.nom === "string" ? o.nom.trim() : "";
    const full = `${prenom} ${nom}`.trim() || nom || idShort(id);
    m.set(canonKey(id), full);
  }
  return m;
}

function parseFormationLigne(
  ligne: unknown,
  matiereNomById: Map<string, string>,
  profLabelById: Map<string, string>
): ExportExtractLine | null {
  if (typeof ligne !== "object" || ligne === null) return null;
  const o = ligne as Record<string, unknown>;
  const midRaw = o.matiereId;
  const matiereId = midRaw != null ? String(midRaw).trim() : "";
  if (!matiereId) return null;
  const heures = asNonNegativeInt(o.nombreHeuresPrevues);
  if (heures === null) return null;

  const rawProf = o.professeurIds;
  const professeurIds: string[] = Array.isArray(rawProf)
    ? rawProf
        .map((p) => (p != null ? String(p).trim() : ""))
        .filter(Boolean)
    : [];

  const matiereNom =
    matiereNomById.get(canonKey(matiereId)) ??
    `Matière non résolue (${idShort(matiereId)})`;

  const professeurLabels = professeurIds.map(
    (pid) =>
      profLabelById.get(canonKey(pid)) ?? `Prof. ${idShort(pid)}`
  );

  return {
    matiereId,
    matiereNom,
    nombreHeuresPrevues: heures,
    professeurIds,
    professeurLabels,
  };
}

function parseFormationDoc(
  raw: unknown,
  matiereNomById: Map<string, string>,
  profLabelById: Map<string, string>
): ExportExtractFormation | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = o._id != null ? String(o._id).trim() : "";
  if (!id) return null;
  const nom =
    typeof o.nom === "string" && o.nom.trim() ? o.nom.trim() : "(sans nom)";
  const lignesIn = o.lignes;
  const lignes: ExportExtractLine[] = [];
  if (Array.isArray(lignesIn)) {
    for (const ligne of lignesIn) {
      const p = parseFormationLigne(ligne, matiereNomById, profLabelById);
      if (p) lignes.push(p);
    }
  }
  if (lignes.length === 0) return null;
  const sommeHeuresLignes = lignes.reduce(
    (acc, l) => acc + l.nombreHeuresPrevues,
    0
  );
  const nh = asNonNegativeInt(o.nombreHeures);
  return {
    id,
    nom,
    nombreHeuresFormation: nh ?? undefined,
    lignes,
    sommeHeuresLignes,
  };
}

/**
 * Récapitule le JSON brut d’export (formations / matières / professeurs) pour affichage utilisateur.
 */
export function summarizePlanningExportRaw(
  raw: PlanningExportRaw
): PlanningExportSummary {
  const notes: string[] = [];
  const meta = raw.meta;
  const exportedAt =
    typeof meta?.exportedAt === "string" ? meta.exportedAt : undefined;
  const formationIdsRequested = Array.isArray(meta?.formationIdsRequested)
    ? meta!.formationIdsRequested!.map((x) => String(x).trim()).filter(Boolean)
    : [];

  const matiereNomById = buildMatiereNomMap(raw.matieres);
  const profLabelById = buildProfLabelMap(raw.professeurs);

  const formationsArr = Array.isArray(raw.formations) ? raw.formations : [];
  const matieresArr = Array.isArray(raw.matieres) ? raw.matieres : [];
  const professeursArr = Array.isArray(raw.professeurs)
    ? raw.professeurs
    : [];

  if (!Array.isArray(raw.formations)) {
    notes.push("Le champ « formations » n’est pas un tableau dans ce JSON.");
  }
  if (!Array.isArray(raw.matieres)) {
    notes.push("Le champ « matieres » n’est pas un tableau dans ce JSON.");
  }
  if (!Array.isArray(raw.professeurs)) {
    notes.push(
      "Le champ « professeurs » n’est pas un tableau (référentiel prof vide)."
    );
  }

  const formations: ExportExtractFormation[] = [];
  for (const f of formationsArr) {
    const p = parseFormationDoc(f, matiereNomById, profLabelById);
    if (p) formations.push(p);
  }

  if (formationsArr.length > 0 && formations.length === 0) {
    notes.push(
      "Aucune formation exploitable : vérifiez que chaque document a un _id et des lignes avec matiereId + nombreHeuresPrevues."
    );
  }

  let lignesTotal = 0;
  let sommeHeuresPrevues = 0;
  for (const f of formations) {
    lignesTotal += f.lignes.length;
    sommeHeuresPrevues += f.sommeHeuresLignes;
    if (
      f.nombreHeuresFormation != null &&
      f.nombreHeuresFormation !== f.sommeHeuresLignes
    ) {
      notes.push(
        `Formation « ${f.nom} » : nombreHeures (${f.nombreHeuresFormation}) ≠ somme des lignes (${f.sommeHeuresLignes}).`
      );
    }
  }

  return {
    exportedAt,
    formationIdsRequested,
    counts: {
      formations: formations.length,
      matieres: matieresArr.filter(
        (m) => typeof m === "object" && m !== null && "_id" in m
      ).length,
      professeurs: professeursArr.filter(
        (p) => typeof p === "object" && p !== null && "_id" in p
      ).length,
      lignesTotal,
      sommeHeuresPrevues,
    },
    formations,
    notes,
  };
}
