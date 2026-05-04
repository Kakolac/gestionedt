"use client";

import { useActionState, useEffect, useState } from "react";
import {
  updateMatiereAction,
  type MatiereActionState,
} from "@/app/administration/_actions/matieres";
import {
  MatiereSallesChecklist,
  stableSalleIdsKey,
  type SalleOption,
} from "@/components/administration/MatiereSallesChecklist";
import type { MatiereSalleMode } from "@/lib/models/Matiere";

export type MatiereRow = {
  id: string;
  nom: string;
  description: string;
  salleMode: MatiereSalleMode;
  salleIds: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  row: MatiereRow | null;
  salleOptions: SalleOption[];
};

const initial: MatiereActionState | undefined = undefined;

export function ModifierMatiereModal({
  open,
  onClose,
  row,
  salleOptions,
}: Props) {
  const [salleMode, setSalleMode] = useState<MatiereSalleMode>(
    () => row?.salleMode ?? "classique"
  );
  const [state, formAction, pending] = useActionState(
    updateMatiereAction,
    initial
  );

  useEffect(() => {
    if (state?.ok) {
      onClose();
    }
  }, [state, onClose]);

  if (!open || !row) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-[2vw]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modifier-matiere-titre"
        className="max-h-[90vh] w-full max-w-[min(92vw,28rem)] overflow-y-auto rounded-2xl border border-white/60 bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="modifier-matiere-titre"
          className="text-lg font-semibold text-slate-900"
        >
          Modifier la matière
        </h2>

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="matiereId" value={row.id} />

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Nom</span>
            <input
              name="nom"
              type="text"
              required
              maxLength={200}
              disabled={pending}
              defaultValue={row.nom}
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">
              Description (optionnel)
            </span>
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              disabled={pending}
              defaultValue={row.description}
              className="resize-y rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            />
          </label>

          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="font-medium text-slate-800">Salles</legend>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="salleMode"
                value="classique"
                checked={salleMode === "classique"}
                disabled={pending}
                onChange={() => setSalleMode("classique")}
                className="text-indigo-600"
              />
              <span>Classique uniquement (sans liste précise)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="salleMode"
                value="liste"
                checked={salleMode === "liste"}
                disabled={pending}
                onChange={() => setSalleMode("liste")}
                className="text-indigo-600"
              />
              <span>Salles déterminées (une ou plusieurs)</span>
            </label>
          </fieldset>

          {salleMode === "liste" ? (
            <MatiereSallesChecklist
              key={`edit-${row.id}-${stableSalleIdsKey(row.salleIds)}`}
              options={salleOptions}
              defaultSelectedIds={row.salleIds}
              disabled={pending}
              freezeDuringSubmit={pending}
            />
          ) : null}

          {state && !state.ok ? (
            <p role="alert" className="text-sm text-red-700">
              {state.error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-fuchsia-500 disabled:opacity-60"
            >
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              onClick={onClose}
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
