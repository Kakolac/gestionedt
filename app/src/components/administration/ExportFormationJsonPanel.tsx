"use client";

import { useState, useTransition } from "react";
import { exportFormationSnapshotAction } from "@/app/administration/_actions/exportFormationSnapshot";
import { FormationCheckboxList } from "@/components/administration/FormationCheckboxList";
import type { FormationListOption } from "@/lib/formation/listFormationExportOptions";

export type FormationExportOption = FormationListOption;

type Props = {
  options: FormationListOption[];
};

export function ExportFormationJsonPanel({ options }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
      <FormationCheckboxList
        options={options}
        selectedIds={selectedIds}
        onToggle={toggle}
        disabled={isPending}
        legend="Formations à inclure dans l'export"
        description="Cochez une ou plusieurs formations. Le fichier JSON contient les documents bruts des formations sélectionnées, plus les matières et professeurs référencés dans leurs lignes."
      />

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
