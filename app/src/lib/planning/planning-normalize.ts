import {
  isProfesseurContrainteKind,
  MAX_CRENEAUX_PAR_CONTRAINTE,
  MAX_HEURES_PLAFOND_JOUR,
  MAX_HEURES_PLAFOND_SEMAINE,
  type ProfesseurContrainteWire,
} from "@/lib/professeurContraintes.shared";
import {
  PLANNING_DATA_VERSION,
  type FormationLigneNormalisee,
  type FormationReference,
  type MatiereReference,
  type PlanningData,
  type PlanningDemand,
  type PlanningExportRaw,
  type PlanningGridConfig,
  type PlanningMaxSeanceHeuresDecoupage,
  type PlanningMetaOut,
  type PlanningReferences,
  type PlanningSeanceDureeHeures,
  type PlanningSalleMode,
  type PlanningSession,
  type ProfesseurReference,
  type SeanceDureePaquet,
} from "@/lib/planning/planning.types";

/** Identifiant Mongo / JSON stringifié : trim + minuscules pour clés stables. */
export function canonPlanningId(id: string): string {
  return id.trim().toLowerCase();
}

function asString(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return v != null ? String(v).trim() || null : null;
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

/**
 * Répartition entière des heures prévues entre les professeurs d’une même ligne.
 * Hypothèse V1 (documentée) : pas de duplication du volume complet pour chaque
 * co-titulaire ; le reste de la division est attribué aux premiers de la liste.
 */
export function splitHoursAmongProfesseurs(
  nombreHeuresPrevues: number,
  professeurIds: readonly string[]
): number[] {
  const n = professeurIds.length;
  if (n === 0) return [];
  const base = Math.floor(nombreHeuresPrevues / n);
  const rem = nombreHeuresPrevues % n;
  return professeurIds.map((_, i) => base + (i < rem ? 1 : 0));
}

/**
 * Découpe gloutonne des heures prévues en séances (durées entières).
 * - `maxBlocHeures === 2` (défaut) : blocs 2 h puis 1 h (ex. 5 h → 2×2 h + 1×1 h).
 * - `maxBlocHeures === 4` : blocs 4 h puis 2 h puis 1 h (ex. 11 h → 2×4 h + 1×2 h + 1×1 h).
 */
export function splitHoursIntoSeancePaquets(
  totalHeures: number,
  maxBlocHeures: PlanningMaxSeanceHeuresDecoupage = 2
): SeanceDureePaquet[] {
  if (totalHeures <= 0) return [];
  const durations: PlanningSeanceDureeHeures[] = [];
  let r = totalHeures;
  if (maxBlocHeures === 4) {
    while (r >= 4) {
      durations.push(4);
      r -= 4;
    }
  }
  while (r >= 2) {
    durations.push(2);
    r -= 2;
  }
  if (r === 1) durations.push(1);

  const out: SeanceDureePaquet[] = [];
  for (const d of durations) {
    const last = out[out.length - 1];
    if (last && last.duree === d) {
      last.quantite += 1;
    } else {
      out.push({ duree: d, quantite: 1 });
    }
  }
  return out;
}

/**
 * Données pour une **semaine type** : chaque demande utilise un volume
 * `arrondi(heures sur la ligne / nombreSemainesGrille)` puis paquets et séances régénérés.
 * Avec copie du motif sur les `nombreSemainesGrille` semaines, le total planifié **approxime**
 * le contrat annuel des lignes (écart dû à l’arrondi semaine par semaine).
 */
export function buildWeeklyTemplatePlanningData(
  data: PlanningData,
  nombreSemainesGrille: number,
  maxBlocHeures: PlanningMaxSeanceHeuresDecoupage
): PlanningData {
  const nw = Math.max(1, Math.floor(Number(nombreSemainesGrille)) || 1);
  const demands: PlanningDemand[] = data.demands.map((d) => {
    const hWeek = Math.max(0, Math.round(d.nombreHeuresPrevues / nw));
    const seances = splitHoursIntoSeancePaquets(hWeek, maxBlocHeures);
    return { ...d, nombreHeuresPrevues: hWeek, seances };
  });
  const sessions: PlanningSession[] = [];
  let sessionSeq = 0;
  for (const d of demands) {
    for (const paquet of d.seances) {
      for (let q = 0; q < paquet.quantite; q += 1) {
        sessions.push({
          id: makeSessionId(d.id, sessionSeq),
          demandId: d.id,
          formationId: d.formationId,
          matiereId: d.matiereId,
          professeurId: d.professeurId,
          duree: paquet.duree,
          statut: "pending",
        });
        sessionSeq += 1;
      }
    }
  }
  return { ...data, demands, sessions };
}

/** Priorité : grille (`maxSeanceHeures`) puis `meta.maxSeanceHeures`, sinon blocs max 2 h. */
export function resolveMaxSeanceHeuresDecoupage(
  raw: PlanningExportRaw,
  grid?: Pick<PlanningGridConfig, "maxSeanceHeures">
): PlanningMaxSeanceHeuresDecoupage {
  if (grid?.maxSeanceHeures === 4 || grid?.maxSeanceHeures === 2) {
    return grid.maxSeanceHeures;
  }
  return raw.meta?.maxSeanceHeures === 4 ? 4 : 2;
}

function parseSalleMode(v: unknown): PlanningSalleMode {
  return v === "liste" ? "liste" : "classique";
}

function parseObjectIdsArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = asString(x);
    if (s) out.push(canonPlanningId(s));
  }
  return out;
}

function parseFormationLigne(ligne: unknown): FormationLigneNormalisee | null {
  if (typeof ligne !== "object" || ligne === null) return null;
  const o = ligne as Record<string, unknown>;
  const matiereId = asString(o.matiereId);
  if (!matiereId) return null;
  const rawProf = o.professeurIds;
  const professeurIds = Array.isArray(rawProf)
    ? rawProf
        .map((p) => asString(p))
        .filter((x): x is string => x != null)
        .map(canonPlanningId)
    : [];
  const heures = asNonNegativeInt(o.nombreHeuresPrevues);
  if (heures === null) {
    return null;
  }
  return {
    matiereId: canonPlanningId(matiereId),
    professeurIds,
    nombreHeuresPrevues: heures,
  };
}

function parseFormation(raw: unknown): FormationReference | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = asString(o._id);
  const nom = asString(o.nom) ?? "(sans nom)";
  if (!id) return null;
  const lignesIn = o.lignes;
  const lignes: FormationLigneNormalisee[] = [];
  if (Array.isArray(lignesIn)) {
    for (const ligne of lignesIn) {
      const p = parseFormationLigne(ligne);
      if (p) lignes.push(p);
    }
  }
  if (lignes.length === 0) return null;
  return { id: canonPlanningId(id), nom, lignes };
}

function parseMatiere(raw: unknown): MatiereReference | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = asString(o._id);
  if (!id) return null;
  const nom = asString(o.nom) ?? "(matière)";
  return {
    id: canonPlanningId(id),
    nom,
    salleMode: parseSalleMode(o.salleMode),
    salleIds: parseObjectIdsArray(o.salleIds),
  };
}

function parseContrainte(raw: unknown): ProfesseurContrainteWire | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const kind = asString(o.kind);
  if (!kind || !isProfesseurContrainteKind(kind)) return null;
  const priorite = asNonNegativeInt(o.priorite);
  if (priorite === null) return null;
  const actif = o.actif === false ? false : true;

  if (kind === "jours_travail") {
    const joursRaw = o.joursSemaine;
    const joursSemaine: number[] = Array.isArray(joursRaw)
      ? joursRaw
          .map((j) => asNonNegativeInt(j))
          .filter((x): x is number => x !== null && x >= 1 && x <= 7)
      : [];
    return { kind: "jours_travail", priorite, actif, joursSemaine };
  }

  if (kind === "creneaux_interdits") {
    const creneauxRaw = o.creneaux;
    if (!Array.isArray(creneauxRaw) || creneauxRaw.length === 0) return null;
    const creneaux: Array<{
      jour: number;
      heureDebut: number;
      heureFin: number;
    }> = [];
    for (const cr of creneauxRaw.slice(0, MAX_CRENEAUX_PAR_CONTRAINTE)) {
      if (typeof cr !== "object" || cr === null) continue;
      const co = cr as Record<string, unknown>;
      const jourN =
        typeof co.jour === "number" ? co.jour : Number(co.jour);
      const hdN =
        typeof co.heureDebut === "number"
          ? co.heureDebut
          : Number(co.heureDebut);
      const hfN =
        typeof co.heureFin === "number" ? co.heureFin : Number(co.heureFin);
      if (
        !Number.isInteger(jourN) ||
        jourN < 1 ||
        jourN > 7 ||
        !Number.isInteger(hdN) ||
        !Number.isInteger(hfN) ||
        hdN < 0 ||
        hfN > 24 ||
        hdN >= hfN
      ) {
        continue;
      }
      creneaux.push({
        jour: jourN,
        heureDebut: hdN,
        heureFin: hfN,
      });
    }
    if (creneaux.length === 0) return null;
    return { kind: "creneaux_interdits", priorite, actif, creneaux };
  }

  if (kind === "heure_fin_max_jour") {
    const jourN = typeof o.jour === "number" ? o.jour : Number(o.jour);
    const hfm =
      typeof o.heureFinMax === "number"
        ? o.heureFinMax
        : Number(o.heureFinMax);
    if (
      !Number.isInteger(jourN) ||
      jourN < 1 ||
      jourN > 7 ||
      !Number.isInteger(hfm) ||
      hfm < 1 ||
      hfm > 24
    ) {
      return null;
    }
    return {
      kind: "heure_fin_max_jour",
      priorite,
      actif,
      jour: jourN,
      heureFinMax: hfm,
    };
  }

  if (kind === "volume_heures_jour") {
    const maxH = asNonNegativeInt(o.maxHeuresJour);
    if (
      maxH === null ||
      maxH < 1 ||
      maxH > MAX_HEURES_PLAFOND_JOUR
    ) {
      return null;
    }
    return {
      kind: "volume_heures_jour",
      priorite,
      actif,
      maxHeuresJour: maxH,
    };
  }

  if (kind === "volume_heures_semaine") {
    const maxH = asNonNegativeInt(o.maxHeuresSemaine);
    if (
      maxH === null ||
      maxH < 1 ||
      maxH > MAX_HEURES_PLAFOND_SEMAINE
    ) {
      return null;
    }
    return {
      kind: "volume_heures_semaine",
      priorite,
      actif,
      maxHeuresSemaine: maxH,
    };
  }

  if (kind === "bloc_consecutif_matiere") {
    const matiereId = asString(o.matiereId);
    const maxHeures = asNonNegativeInt(o.maxHeuresConsecutives);
    if (!matiereId || maxHeures === null || maxHeures < 1) return null;
    return {
      kind: "bloc_consecutif_matiere",
      priorite,
      actif,
      matiereId: canonPlanningId(matiereId),
      maxHeuresConsecutives: maxHeures,
    };
  }

  if (kind !== "volume_jour_matiere") return null;

  const matiereIdV = asString(o.matiereId);
  const maxCours = asNonNegativeInt(o.maxCoursParJour);
  if (!matiereIdV || maxCours === null || maxCours < 1) return null;
  return {
    kind: "volume_jour_matiere",
    priorite,
    actif,
    matiereId: canonPlanningId(matiereIdV),
    maxCoursParJour: maxCours,
  };
}

function parseProfesseur(raw: unknown): ProfesseurReference | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = asString(o._id);
  if (!id) return null;
  const prenom = asString(o.prenom) ?? "";
  const nom = asString(o.nom) ?? "(professeur)";
  const matiereIds = parseObjectIdsArray(o.matiereIds);
  const contraintesRaw = o.contraintes;
  const contraintes: ProfesseurContrainteWire[] = [];
  if (Array.isArray(contraintesRaw)) {
    for (const c of contraintesRaw) {
      const p = parseContrainte(c);
      if (p) contraintes.push(p);
    }
  }
  return {
    id: canonPlanningId(id),
    prenom,
    nom,
    matiereIds,
    contraintes,
  };
}

function professeurDisplayName(p: ProfesseurReference): string {
  const full = `${p.prenom} ${p.nom}`.trim();
  return full || p.nom;
}

function buildReferences(
  formations: FormationReference[],
  matieres: MatiereReference[],
  professeurs: ProfesseurReference[]
): PlanningReferences {
  return {
    formations,
    matieres,
    professeurs,
  };
}

function makeDemandId(parts: readonly string[]): string {
  return `demand|${parts.join("|")}`;
}

function makeSessionId(demandId: string, index: number): string {
  return `session|${demandId}|${index}`;
}

export function normalizePlanningExport(
  raw: PlanningExportRaw,
  gridForDecoupage?: Pick<PlanningGridConfig, "maxSeanceHeures">
): PlanningData {
  const maxBlocHeures = resolveMaxSeanceHeuresDecoupage(raw, gridForDecoupage);
  const metaIn = raw.meta;
  const metaOut: PlanningMetaOut = {
    version: PLANNING_DATA_VERSION,
    generatedAt: new Date().toISOString(),
    ...(metaIn?.exportedAt
      ? { sourceExportedAt: metaIn.exportedAt }
      : {}),
  };

  const formationsArr = Array.isArray(raw.formations) ? raw.formations : [];
  const matieresArr = Array.isArray(raw.matieres) ? raw.matieres : [];
  const professeursArr = Array.isArray(raw.professeurs) ? raw.professeurs : [];

  const formations: FormationReference[] = [];
  for (const f of formationsArr) {
    const p = parseFormation(f);
    if (p) formations.push(p);
  }

  const matieres: MatiereReference[] = [];
  const matiereMap = new Map<string, MatiereReference>();
  for (const m of matieresArr) {
    const p = parseMatiere(m);
    if (p) {
      matieres.push(p);
      matiereMap.set(p.id, p);
    }
  }

  const professeurs: ProfesseurReference[] = [];
  const profMap = new Map<string, ProfesseurReference>();
  for (const pr of professeursArr) {
    const p = parseProfesseur(pr);
    if (p) {
      professeurs.push(p);
      profMap.set(p.id, p);
    }
  }

  const demands: PlanningDemand[] = [];
  const sessions: PlanningSession[] = [];
  let sessionSeq = 0;

  for (const form of formations) {
    let ligneIndex = -1;
    for (const ligne of form.lignes) {
      ligneIndex += 1;
      const matiere = matiereMap.get(ligne.matiereId);
      if (!matiere) continue;

      const profIds = ligne.professeurIds.filter((pid) => profMap.has(pid));
      if (profIds.length === 0) continue;

      const heuresParProf = splitHoursAmongProfesseurs(
        ligne.nombreHeuresPrevues,
        profIds
      );

      let profIndex = -1;
      for (const profId of profIds) {
        profIndex += 1;
        const hours = heuresParProf[profIndex] ?? 0;
        if (hours <= 0) continue;

        const prof = profMap.get(profId);
        if (!prof) continue;

        const seances = splitHoursIntoSeancePaquets(hours, maxBlocHeures);
        const demandId = makeDemandId([
          form.id,
          String(ligneIndex),
          ligne.matiereId,
          profId,
        ]);

        demands.push({
          id: demandId,
          formationId: form.id,
          formationNom: form.nom,
          matiereId: matiere.id,
          matiereNom: matiere.nom,
          professeurId: prof.id,
          professeurNom: professeurDisplayName(prof),
          nombreHeuresPrevues: hours,
          seances,
          salleMode: matiere.salleMode,
          salleIds: [...matiere.salleIds],
          contraintesProfesseur: prof.contraintes.map((c) => ({ ...c })),
        });

        for (const paquet of seances) {
          for (let q = 0; q < paquet.quantite; q += 1) {
            sessions.push({
              id: makeSessionId(demandId, sessionSeq),
              demandId,
              formationId: form.id,
              matiereId: matiere.id,
              professeurId: prof.id,
              duree: paquet.duree,
              statut: "pending",
            });
            sessionSeq += 1;
          }
        }
      }
    }
  }

  return {
    meta: metaOut,
    references: buildReferences(formations, matieres, professeurs),
    demands,
    sessions,
  };
}
