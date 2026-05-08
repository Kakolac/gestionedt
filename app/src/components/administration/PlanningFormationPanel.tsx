"use client";

import { useCallback, useId, useRef, useState, useTransition } from "react";
import { loadFormationPlanningSnapshotAction } from "@/app/administration/_actions/exportFormationSnapshot";
import { FormationCheckboxList } from "@/components/administration/FormationCheckboxList";
import { PlanningExportExtractSummary } from "@/components/administration/PlanningExportExtractSummary";
import { PlanningBuilder } from "@/components/planning/planning-builder";
import type { FormationListOption } from "@/lib/formation/listFormationExportOptions";
import type { PlanningExportRaw } from "@/lib/planning/planning.types";

type Props = {
  options: FormationListOption[];
};

function isPlanningExportRawLoose(v: unknown): v is PlanningExportRaw {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  const o = v as Record<string, unknown>;
  const formations = o.formations;
  const matieres = o.matieres;
  return Array.isArray(formations) && Array.isArray(matieres);
}

export function PlanningFormationPanel({ options }: Props) {
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [nombreSemainesRepetition, setNombreSemainesRepetition] = useState(36);
  const [maxSeanceDecoupage, setMaxSeanceDecoupage] = useState<2 | 4>(2);
  const [rawData, setRawData] = useState<PlanningExportRaw | null>(null);
  const [modeRepetition, setModeRepetition] = useState(false);
  const [repetitionNombrePeriodes, setRepetitionNombrePeriodes] = useState<
    1 | 3 | 4
  >(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string, checked: boolean) {
    const trimmed = id.trim();
    if (!trimmed) return;
    setSelectedIds((prev) => {
      const next = new Set(prev.map((x) => x.trim()).filter(Boolean));
      if (checked) next.add(trimmed);
      else next.delete(trimmed);
      return [...next];
    });
  }

  function loadFromDatabase(useRepetitionMode: boolean) {
    setError(null);
    const ids = selectedIds.map((x) => x.trim()).filter(Boolean);
    if (ids.length === 0) {
      setError("Cochez au moins une formation dans la liste.");
      return;
    }
    startTransition(async () => {
      const res = await loadFormationPlanningSnapshotAction(ids);
      if (!res.ok) {
        setRawData(null);
        setError(res.error);
        return;
      }
      setRawData(res.rawData);
      setModeRepetition(useRepetitionMode);
    });
  }

  const onJsonFile = useCallback((fileList: FileList | null) => {
    setError(null);
    const file = fileList?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed: unknown = JSON.parse(text);
        if (!isPlanningExportRawLoose(parsed)) {
          setError(
            "JSON invalide : attendu un objet avec tableaux « formations » et « matieres » (export AdAgile)."
          );
          return;
        }
        setRawData(parsed);
        setModeRepetition(false);
        setRepetitionNombrePeriodes(1);
      } catch {
        setError("Impossible de lire le fichier (JSON invalide).");
      }
    };
    reader.readAsText(file, "UTF-8");
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }, []);

  if (options.length === 0) {
    return (
      <p className="max-w-[92vw] rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-600">
        Aucune formation en base pour l&apos;instant. Créez une formation depuis le hub
        Administration.
      </p>
    );
  }

  const semaines = Math.min(
    52,
    Math.max(1, Math.floor(Number(nombreSemainesRepetition)) || 1)
  );

  return (
    <div className="flex w-full max-w-none flex-col gap-6">
      <div className="flex max-w-xl flex-col gap-4 rounded-2xl border border-indigo-100/80 bg-white/80 p-4 shadow-[0_8px_30px_rgba(49,46,129,0.06)]">
        <FormationCheckboxList
          options={options}
          selectedIds={selectedIds}
          onToggle={toggle}
          disabled={isPending}
          legend="Formations à planifier"
          description="Même périmètre que l’export JSON : formations cochées, matières et professeurs référencés dans les lignes."
        />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-800">
            Gabarit répété sur combien de semaines ?
          </span>
          <span className="text-xs text-slate-500">
            Le placement utilise une grille jour × heures répétée sur ce nombre de semaines
            (indices S1 … SN dans les créneaux planifiés). Les séances à placer restent celles
            déduites des lignes formation ; l&apos;horizon élargit les créneaux disponibles.
          </span>
          <input
            type="number"
            min={1}
            max={52}
            value={semaines}
            disabled={isPending}
            onChange={(e) => setNombreSemainesRepetition(Number(e.target.value))}
            className="max-w-[min(28vw,8rem)] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-800">
            Blocs séances au plus…
          </span>
          <span className="text-xs text-slate-500">
            Détermine comment les heures prévues sont découpées avant placement : jusqu’à 2 h
            (historique) ou jusqu’à 4 h (ex. un cours après-midi d&apos;un seul créneau).
            Prioritaire sur <code className="text-[0.85em]">meta.maxSeanceHeures</code> dans le
            JSON importé.
          </span>
          <select
            value={maxSeanceDecoupage}
            disabled={isPending}
            onChange={(e) =>
              setMaxSeanceDecoupage(
                Number(e.target.value) === 4 ? 4 : 2
              )
            }
            className="max-w-[min(36vw,14rem)] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value={2}>2 h par séance max</option>
            <option value={4}>4 h par séance max</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-800">
            Répétition : périodes sur le gabarit
          </span>
          <span className="text-xs text-slate-500">
            S&apos;applique à <strong>Créer un planning répété</strong> : 1 = même motif chaque semaine ;
            3 ou 4 = blocs successifs (ex. trimestres) avec un placement recalculé par bloc quand cela ne
            crée pas plus de séances non planifiées. Le volume horaire des lignes est réparti en
            moyenne par semaine sur le nombre de semaines du gabarit ci‑dessus.
          </span>
          <select
            value={repetitionNombrePeriodes}
            disabled={isPending}
            onChange={(e) => {
              const v = Number(e.target.value);
              setRepetitionNombrePeriodes(
                v === 3 ? 3 : v === 4 ? 4 : 1
              );
            }}
            className="max-w-[min(42vw,16rem)] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value={1}>1 — même motif sur tout le gabarit</option>
            <option value={3}>3 — trois blocs (ex. trimestres)</option>
            <option value={4}>4 — quatre blocs (ex. trimestres)</option>
          </select>
        </label>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
          <button
            type="button"
            disabled={isPending || selectedIds.length === 0}
            onClick={() => loadFromDatabase(false)}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Chargement…" : "Charger depuis la base"}
          </button>
          <button
            type="button"
            disabled={isPending || selectedIds.length === 0}
            onClick={() => loadFromDatabase(true)}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-emerald-200/90 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
            title="Une semaine type est calculée puis copiée sur toutes les semaines du gabarit (même emploi du temps chaque semaine)."
          >
            {isPending ? "Chargement…" : "Créer un planning répété"}
          </button>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <p className="text-xs font-medium text-slate-700">
            Ou importer un fichier JSON (export brut)
          </p>
          <input
            ref={fileRef}
            id={fileInputId}
            type="file"
            accept="application/json,.json"
            className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            onChange={(e) => onJsonFile(e.target.files)}
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="max-w-xl rounded-xl border border-red-200 bg-red-50/95 px-3 py-2 text-sm text-red-900"
        >
          {error}
        </p>
      ) : null}

      {rawData ? (
        <div className="flex w-full min-w-0 flex-col gap-[2vh] rounded-2xl border border-indigo-100/60 bg-gradient-to-br from-indigo-50/40 via-white to-sky-50/30 p-[2vw] shadow-[0_8px_30px_rgba(49,46,129,0.07)] sm:p-[2.5vw]">
          <PlanningExportExtractSummary raw={rawData} />
          <PlanningBuilder
            rawData={rawData}
            nombreSemainesRepetition={semaines}
            gridConfig={{ maxSeanceHeures: maxSeanceDecoupage }}
            modeRepetition={modeRepetition}
            repetitionNombrePeriodes={repetitionNombrePeriodes}
          />
        </div>
      ) : null}
    </div>
  );
}
