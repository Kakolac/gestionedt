"use client";

import { useState, useTransition } from "react";
import { exportFormationSnapshotAction } from "@/app/administration/_actions/exportFormationSnapshot";

export type FormationExportOption = { id: string; label: string };

type Props = {
  options: FormationExportOption[];
};

export function ExportFormationJsonPanel({ options }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedSet = new Set(selectedIds.map((x) => x.trim()).filter(Boolean));

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

  function downloadSnapshot() {
    setError(null);
    startTransition(async () => {
      const res = await exportFormationSnapshotAction(selectedIds);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const blob = new Blob([res.jsonText], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filenameSuggested;
      a.rel = "noopener";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (options.length === 0) {
    return (
      <p className="max-w-[92vw] rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-600">
        Aucune formation en base pour l&apos;instant. Créez des formations depuis le
        hub Administration.
      </p>
    );
  }

  return (
    <div className="flex max-w-[92vw] flex-col gap-4">
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="font-medium text-slate-800">
          Formations à inclure dans l&apos;export
        </legend>
        <p className="text-xs text-slate-500">
          Cochez une ou plusieurs formations. Le fichier JSON contient les documents
          bruts des formations sélectionnées, plus les matières et professeurs
          référencés dans leurs lignes.
        </p>
        <ul className="max-h-[min(40vh,22rem)] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          {options.map((o) => (
            <li key={o.id}>
              <label className="flex cursor-pointer items-start gap-2 text-slate-800">
                <input
                  type="checkbox"
                  checked={selectedSet.has(o.id)}
                  disabled={isPending}
                  onChange={(e) => toggle(o.id, e.target.checked)}
                  className="mt-1 accent-indigo-600 disabled:opacity-50"
                />
                <span>{o.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50/95 px-3 py-2 text-sm text-red-900"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={downloadSnapshot}
          disabled={isPending || selectedIds.length === 0}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Préparation…" : "Télécharger le JSON"}
        </button>
        {selectedIds.length === 0 ? (
          <span className="text-xs text-slate-500">
            Sélectionnez au moins une formation.
          </span>
        ) : null}
      </div>
    </div>
  );
}
