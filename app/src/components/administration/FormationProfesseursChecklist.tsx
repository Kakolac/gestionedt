"use client";

import type { ReactNode } from "react";

/** `matiereIds` sert au filtrage côté client (liste des `_id` matière référencées par le professeur). */
export type ProfesseurOption = {
  id: string;
  label: string;
  matiereIds?: string[];
};

type Props = {
  options: ProfesseurOption[];
  defaultSelectedIds?: readonly string[];
  disabled?: boolean;
  emptyState?: ReactNode;
  /** Nom du champ form (pour une modale secondaire éviter collision avec un autre groupe de cases). */
  checkboxName?: string;
};

export function FormationProfesseursChecklist({
  options,
  defaultSelectedIds,
  disabled,
  emptyState,
  checkboxName = "professeurIds",
}: Props) {
  const selected = new Set(
    defaultSelectedIds?.map((id) => id.trim()).filter(Boolean) ?? []
  );

  const defaultEmpty = (
    <p className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900">
      Aucun professeur dans le référentiel. Créez-en dans « Création professeur
      » pour les affecter ici.
    </p>
  );

  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="font-medium text-slate-800">Professeurs</legend>
      {options.length === 0 ? (
        emptyState ?? defaultEmpty
      ) : (
        <ul className="max-h-[35vh] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          {options.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-start gap-2 text-slate-800">
                <input
                  type="checkbox"
                  name={checkboxName}
                  value={p.id}
                  defaultChecked={selected.has(p.id)}
                  disabled={disabled}
                  className="mt-1 accent-indigo-600 disabled:opacity-50"
                />
                <span>{p.label}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">
        Case(s) facultative(s) si la fiche doit exister avant l’affectation
        d’enseignants.
      </p>
    </fieldset>
  );
}
