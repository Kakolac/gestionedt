import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { Formation } from "@/lib/models/Formation";
import { Matiere } from "@/lib/models/Matiere";
import { Professeur } from "@/lib/models/Professeur";
import { PeriodeVacances } from "@/lib/models/PeriodeVacances";
import { PERMISSION_CREATION_FORMATION } from "@/lib/permissions/keys";
import {
  leanWireFromFormationContraintesDoc,
  mergeFormationDefaultsWire,
} from "@/lib/formationContraintes";
import { GestionFormationPanel } from "@/components/administration/GestionFormationPanel";
import type {
  FormationLigneListe,
  FormationRow,
} from "@/components/administration/ModifierFormationModal";
import type { ProfesseurOption } from "@/components/administration/FormationProfesseursChecklist";

export type PeriodeVacancesOption = {
  id: string;
  nom: string;
  debut: string;
  fin: string;
};

function libelleProfesseurCourte(p: {
  prenom?: string | null;
  nom: string;
}): string {
  const pr = (p.prenom ?? "").trim();
  const n = (p.nom ?? "").trim();
  return pr ? `${pr} ${n}` : n;
}

function matiereIdsDuProfesseurLean(p: unknown): string[] {
  if (typeof p !== "object" || p == null || !("matiereIds" in p)) {
    return [];
  }
  const raw = (p as { matiereIds?: unknown }).matiereIds;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((x) => String(x)).filter(Boolean);
}

function matiereIdsFromFicheLean(f: Record<string, unknown>): string[] {
  const rawLignes = f.lignes;
  if (Array.isArray(rawLignes) && rawLignes.length > 0) {
    const ids: string[] = [];
    for (const ligne of rawLignes) {
      if (
        typeof ligne !== "object" ||
        ligne == null ||
        !("matiereId" in ligne)
      ) {
        continue;
      }
      const mid = String((ligne as { matiereId: unknown }).matiereId);
      if (!mid || mid === "undefined") continue;
      ids.push(mid);
    }
    if (ids.length > 0) return ids;
  }
  const raw = f.matiereIds;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((x) => String(x));
  }
  if (f.matiereId != null) {
    const s = String(f.matiereId);
    if (s.length > 0) {
      return [s];
    }
  }
  return [];
}

function nomEtDescriptionDepuisLean(
  f: Record<string, unknown>,
  mids: string[],
  nomMatiere: Map<string, string>
): { nom: string; description: string } {
  const nom =
    typeof f.nom === "string" && f.nom.trim().length > 0
      ? f.nom.trim()
      : mids.length === 1
        ? (nomMatiere.get(mids[0]) ?? "Formation")
        : "Formation";

  let description =
    typeof f.description === "string" && f.description.trim().length > 0
      ? f.description.trim()
      : "";

  if (!description && mids.length === 1) {
    const matNom = nomMatiere.get(mids[0]);
    if (matNom != null && nom === matNom) {
      description = "";
    }
  }

  return { nom, description };
}

export default async function CreationFormationPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_CREATION_FORMATION,
  ]);
  if (!allowed) {
    redirect("/administration");
  }

  await connectDB();

  const [fichesLean, matsLean, profsLean, periodesVacancesLean] = await Promise.all([
    Formation.find({}).lean(),
    Matiere.find({}).sort({ nom: 1 }).select("nom description").lean(),
    Professeur.find({})
      .sort({ nom: 1, prenom: 1 })
      .select("prenom nom matiereIds")
      .lean(),
    PeriodeVacances.find({})
      .sort({ debut: 1, nom: 1 })
      .select("nom debut fin")
      .lean(),
  ]);

  const nomMatiere = new Map<string, string>();
  const descMatiere = new Map<string, string>();
  for (const m of matsLean) {
    const id = String(m._id);
    nomMatiere.set(id, m.nom);
    if (typeof (m as { description?: unknown }).description === "string") {
      descMatiere.set(id, ((m as { description: string }).description ?? "").trim());
    }
  }

  const labelProfesseurParId = new Map<string, string>();
  const professeurOptions: ProfesseurOption[] = [];
  for (const p of profsLean) {
    const id = String(p._id);
    const label = libelleProfesseurCourte(p);
    labelProfesseurParId.set(id, label);
    professeurOptions.push({
      id,
      label,
      matiereIds: matiereIdsDuProfesseurLean(p),
    });
  }

  const toutesLesMatieres = matsLean.map((m) => ({
    id: String(m._id),
    nom: m.nom,
  }));

  const matiereDisponiblesPourCreation = toutesLesMatieres;

  const periodeVacancesOptions: PeriodeVacancesOption[] = periodesVacancesLean.map((p) => ({
    id: String(p._id),
    nom: p.nom,
    debut: p.debut,
    fin: p.fin,
  }));

  const periodeVacancesMap = new Map<string, { nom: string; debut: string; fin: string }>();
  for (const p of periodeVacancesOptions) {
    periodeVacancesMap.set(p.id, { nom: p.nom, debut: p.debut, fin: p.fin });
  }

  const rows: FormationRow[] = [...fichesLean]
    .sort((a, b) => {
      const ma = matiereIdsFromFicheLean(a as Record<string, unknown>);
      const mb = matiereIdsFromFicheLean(b as Record<string, unknown>);
      const ta = nomMatiere.get(ma[0] ?? "") ?? "";
      const tb = nomMatiere.get(mb[0] ?? "") ?? "";
      return ta.localeCompare(tb, "fr");
    })
    .map((fRaw) => {
      const f = fRaw as Record<string, unknown>;
      const mids = matiereIdsFromFicheLean(f);
      const base = nomEtDescriptionDepuisLean(f, mids, nomMatiere);
      let description = base.description;

      /* Ancien jeu de données sans `nom` : une description matière peut servir pour l’historique court. */
      if (
        mids.length === 1 &&
        (!description ||
          !(typeof f.nom === "string" && f.nom.trim().length > 0))
      ) {
        const dm = descMatiere.get(mids[0]);
        if (dm && !description) {
          description = dm;
        }
      }

      const nom = base.nom;

      const rawLignes = f.lignes;
      let lignesListe: FormationLigneListe[];

      if (Array.isArray(rawLignes) && rawLignes.length > 0) {
        lignesListe = [];
        for (const ligne of rawLignes) {
          if (
            typeof ligne !== "object" ||
            ligne == null ||
            !("matiereId" in ligne)
          ) {
            continue;
          }
          const mid = String((ligne as { matiereId: unknown }).matiereId);
          const pidsLi: string[] = (
            Array.isArray((ligne as { professeurIds?: unknown }).professeurIds)
              ? (ligne as { professeurIds: unknown[] }).professeurIds
              : []
          ).map((x: unknown) => String(x));

          const rawHp = (ligne as { nombreHeuresPrevues?: unknown }).nombreHeuresPrevues;
          let nombreHeuresPrevues = 0;
          if (typeof rawHp === "number" && Number.isFinite(rawHp)) {
            nombreHeuresPrevues = Math.round(rawHp);
          }

          const nomsProfLi = pidsLi
            .map((pid: string) => labelProfesseurParId.get(pid))
            .filter((lbl): lbl is string => typeof lbl === "string");
          const profLab =
            nomsProfLi.length > 0 ? nomsProfLi.join(", ") : "—";

          lignesListe.push({
            matiereId: mid,
            matiereNom: nomMatiere.get(mid) ?? "Matière",
            professeurIds: pidsLi,
            professeursLabel: profLab,
            nombreHeuresPrevues,
          });
        }
      } else {
        const pids: string[] = (
          Array.isArray(f.professeurIds) ? f.professeurIds : []
        ).map((x: unknown) => String(x));
        lignesListe = mids.map((mid) => {
          const nomsProfLin = pids
            .map((pid: string) => labelProfesseurParId.get(pid))
            .filter((lbl): lbl is string => typeof lbl === "string");
          const profLab =
            nomsProfLin.length > 0 ? nomsProfLin.join(", ") : "—";
          return {
            matiereId: mid,
            matiereNom: nomMatiere.get(mid) ?? "Matière",
            professeurIds: pids,
            professeursLabel: profLab,
            nombreHeuresPrevues: 0,
          };
        });
      }

      const pidsUnion = [...new Set(lignesListe.flatMap((l) => l.professeurIds))];
      const nomsUnion = pidsUnion
        .map((pid) => labelProfesseurParId.get(pid))
        .filter((lbl): lbl is string => typeof lbl === "string");
      const professeursLabel =
        nomsUnion.length > 0 ? nomsUnion.join(", ") : "—";

      let nombreHeures = lignesListe.reduce((s, l) => s + l.nombreHeuresPrevues, 0);
      let docNombreHeures = 0;
      if (
        typeof f.nombreHeures === "number" &&
        Number.isFinite(f.nombreHeures)
      ) {
        docNombreHeures = Math.round(f.nombreHeures);
      }
      if (nombreHeures === 0 && docNombreHeures > 0) {
        nombreHeures = docNombreHeures;
      }

      const matieresLabel = mids
        .map((id) => nomMatiere.get(id))
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .join(", ");

      const rawCtr = (f as { contraintes?: unknown }).contraintes;

      const lpRaw = (f as { localisationPays?: unknown }).localisationPays;
      const lrRaw = (f as { localisationRegion?: unknown }).localisationRegion;
      const localisationPays =
        typeof lpRaw === "string" ? lpRaw.trim().toUpperCase() : "";
      const localisationRegion =
        typeof lrRaw === "string" ? lrRaw.trim() : "";

      const ddRaw = (f as { dateDemarrageIso?: unknown }).dateDemarrageIso;
      const dateDemarrageIso =
        typeof ddRaw === "string" ? ddRaw.trim().slice(0, 10) : "";

      const datesVacancesRaw = (f as { datesVacances?: unknown }).datesVacances;
      let datesVacances: Array<{ debut: string; fin: string; nom: string }> = [];
      if (Array.isArray(datesVacancesRaw)) {
        datesVacances = datesVacancesRaw
          .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
          .map((p) => ({
            debut: typeof p.debut === "string" ? p.debut.trim() : "",
            fin: typeof p.fin === "string" ? p.fin.trim() : "",
            nom: typeof p.nom === "string" ? p.nom.trim() : "",
          }))
          .filter((p) => p.debut && p.fin && p.nom);
      }

      const periodeVacancesIdsRaw = (f as { periodeVacancesIds?: unknown }).periodeVacancesIds;
      let periodeVacancesIds: string[] = [];
      if (Array.isArray(periodeVacancesIdsRaw)) {
        periodeVacancesIds = periodeVacancesIdsRaw
          .map((id) => String(id))
          .filter((id) => id && id !== "undefined");
      }

      return {
        id: String((fRaw as { _id: unknown })._id ?? ""),
        nom,
        description,
        matiereIds: mids,
        matieresLabel: matieresLabel.length > 0 ? matieresLabel : "—",
        lignesListe,
        professeurIds: pidsUnion,
        professeursLabel,
        nombreHeures,
        contraintes: mergeFormationDefaultsWire(
          leanWireFromFormationContraintesDoc(rawCtr)
        ),
        localisationPays,
        localisationRegion,
        dateDemarrageIso,
        datesVacances,
        periodeVacancesIds,
      };
    });

  return (
    <main className="flex min-h-[40vh] flex-col gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
          Administration
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Formations
        </h1>
        <p className="mt-2 max-w-[92vw] text-slate-600">
          Ajoutez un <strong>intitulé</strong>, une <strong>description</strong>, puis&nbsp;
          une <strong>matière à la fois</strong> (existante ou nouvelle comme avant)&nbsp;: pour
          chacune vous indiquez les <strong>heures prévues</strong>, le ou les{" "}
          <strong>professeurs</strong> dans une modale, puis enchaînez sur d&apos;autres matières.
          Définissez aussi les <strong>contraintes de planning de la formation</strong> (pause
          midi, plage horaire, jours)&nbsp;: elles sont obligatoires à l&apos;enregistrement et
          appliquées strictement par le moteur de placement. Le champ <strong>total</strong> du bloc est la somme des heures par matière. La même
          matière du référentiel peut être utilisée dans <strong>plusieurs</strong> formations ;
          dans une formation donnée, elle ne peut figurer qu&apos;<strong>une fois</strong> par
          bloc. Création d&apos;une matière également via{" "}
          <Link
            href="/administration/creation-matiere"
            className="font-medium text-indigo-600 underline-offset-4 hover:underline"
          >
            création matière
          </Link>
          ). Permission{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            {PERMISSION_CREATION_FORMATION}
          </code>
          .
        </p>
      </header>

      <GestionFormationPanel
        rows={rows}
        matiereDisponiblesPourCreation={matiereDisponiblesPourCreation}
        toutesLesMatieres={toutesLesMatieres}
        professeurOptions={professeurOptions}
        periodeVacancesOptions={periodeVacancesOptions}
      />

      <p className="text-sm">
        <Link
          href="/administration"
          className="font-medium text-indigo-600 underline-offset-4 hover:underline"
        >
          Retour au hub Administration
        </Link>
      </p>
    </main>
  );
}
