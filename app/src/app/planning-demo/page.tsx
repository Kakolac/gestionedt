import Link from "next/link";
import { PlanningBuilder } from "@/components/planning/planning-builder";
import type { PlanningExportRaw } from "@/lib/planning/planning.types";

const IDS = {
  f1: "64fcb3a1b2c3d4e5f6789a01",
  f2: "64fcb3a1b2c3d4e5f6789a02",
  mMath: "64fcb3a1b2c3d4e5f6789a11",
  mInfo: "64fcb3a1b2c3d4e5f6789a12",
  mAng: "64fcb3a1b2c3d4e5f6789a13",
  pDupont: "64fcb3a1b2c3d4e5f6789a21",
  pMartin: "64fcb3a1b2c3d4e5f6789a22",
  s101: "64fcb3a1b2c3d4e5f6789a31",
  s102: "64fcb3a1b2c3d4e5f6789a32",
} as const;

/** Jeu de données proche de `exportFormationSnapshot` (formations / matières / professeurs). */
const RAW_DATA_DEMO: PlanningExportRaw = {
  meta: {
    version: 1,
    exportedAt: new Date().toISOString(),
    formationIdsRequested: [IDS.f1, IDS.f2],
  },
  formations: [
    {
      _id: IDS.f1,
      nom: "BTS SIO — groupe A",
      description: "",
      nombreHeures: 13,
      lignes: [
        {
          matiereId: IDS.mMath,
          professeurIds: [IDS.pDupont],
          nombreHeuresPrevues: 5,
        },
        {
          matiereId: IDS.mInfo,
          professeurIds: [IDS.pDupont, IDS.pMartin],
          nombreHeuresPrevues: 8,
        },
      ],
    },
    {
      _id: IDS.f2,
      nom: "BTS SIO — groupe B",
      description: "",
      nombreHeures: 6,
      lignes: [
        {
          matiereId: IDS.mAng,
          professeurIds: [IDS.pMartin],
          nombreHeuresPrevues: 6,
        },
      ],
    },
  ],
  matieres: [
    {
      _id: IDS.mMath,
      nom: "Mathématiques",
      slug: "mathematiques",
      salleMode: "classique",
      salleIds: [],
    },
    {
      _id: IDS.mInfo,
      nom: "Informatique",
      slug: "informatique",
      salleMode: "liste",
      salleIds: [IDS.s101, IDS.s102],
    },
    {
      _id: IDS.mAng,
      nom: "Anglais",
      slug: "anglais",
      salleMode: "classique",
      salleIds: [],
    },
  ],
  professeurs: [
    {
      _id: IDS.pDupont,
      prenom: "Jean",
      nom: "Dupont",
      slug: "jean-dupont",
      matiereIds: [IDS.mMath, IDS.mInfo],
      contraintes: [
        {
          kind: "jours_travail",
          priorite: 1,
          actif: true,
          joursSemaine: [1, 2, 3, 4, 5],
        },
        {
          kind: "bloc_consecutif_matiere",
          priorite: 2,
          actif: true,
          matiereId: IDS.mMath,
          maxHeuresConsecutives: 2,
        },
      ],
    },
    {
      _id: IDS.pMartin,
      prenom: "Claire",
      nom: "Martin",
      slug: "claire-martin",
      matiereIds: [IDS.mInfo, IDS.mAng],
      contraintes: [
        {
          kind: "jours_travail",
          priorite: 1,
          actif: true,
          joursSemaine: [1, 3, 5],
        },
        {
          kind: "volume_jour_matiere",
          priorite: 2,
          actif: true,
          matiereId: IDS.mAng,
          maxCoursParJour: 2,
        },
      ],
    },
  ],
};

export const metadata = {
  title: "Démo PlanningBuilder | Gestion EDT",
  description:
    "Normalisation JSON export + placement glouton multi-formations (V1).",
};

export default function PlanningDemoPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-indigo-50 via-white to-sky-50">
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <p className="rounded-xl border border-indigo-200/80 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
          <strong>Données réelles :</strong> connectez-vous et ouvrez{" "}
          <Link
            href="/administration/planning-formation"
            className="font-semibold text-indigo-600 underline-offset-2 hover:underline"
          >
            Administration → Planning formation
          </Link>{" "}
          pour générer le planning à partir d&apos;une formation de la base.
        </p>
      </div>
      <PlanningBuilder rawData={RAW_DATA_DEMO} />
    </div>
  );
}
