"use client";

import type { FormationListOption } from "@/lib/formation/listFormationExportOptions";

export type FormationCheckboxListProps = {
  options: FormationListOption[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  disabled?: boolean;
  legend: string;
  description?: string;
};

/**
 * Liste à cases à cocher pour sélectionner plusieurs formations (export JSON, planning).
 */
export function FormationCheckboxList({
  options,
  selectedIds,
  onToggle,
  disabled = false,
  legend,
  description,
}: FormationCheckboxListProps) {
  const selectedSet = new Set(selectedIds.map((x) => x.trim()).filter(Boolean));

  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="font-medium text-slate-800">{legend}</legend>
      {description ? (
        <p className="text-xs text-slate-500">{description}</p>
      ) : null}
      <ul className="max-h-[min(40vh,22rem)] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        {options.map((o) => (
          <li key={o.id}>
            <label className="flex cursor-pointer items-start gap-2 text-slate-800">
              <input
                type="checkbox"
                checked={selectedSet.has(o.id)}
                disabled={disabled}
                onChange={(e) => onToggle(o.id, e.target.checked)}
                className="mt-1 accent-indigo-600 disabled:opacity-50"
              />
              <span>{o.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
