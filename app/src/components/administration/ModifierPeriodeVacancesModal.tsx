"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useEffect, useState } from "react";
import { updatePeriodeVacancesAction } from "@/app/administration/_actions/vacances";
import type { VacancesActionState } from "@/app/administration/_actions/vacances";
import type { PeriodeVacancesRow } from "@/components/administration/GestionVacancesPanel";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? "Mise à jour…" : "Mettre à jour"}
    </button>
  );
}

type Props = {
  periode: PeriodeVacancesRow;
  onClose: () => void;
};

export function ModifierPeriodeVacancesModal({ periode, onClose }: Props) {
  const [state, formAction] = useActionState<VacancesActionState | undefined, FormData>(
    updatePeriodeVacancesAction,
    undefined
  );

  const [nom, setNom] = useState(periode.nom);
  const [debut, setDebut] = useState(periode.debut);
  const [fin, setFin] = useState(periode.fin);
  const [description, setDescription] = useState(periode.description);

  useEffect(() => {
    if (state?.ok) {
      onClose();
    }
  }, [state, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[90vw] max-w-[600px] rounded-2xl bg-white p-[min(5vw,1.5rem)] shadow-xl">
        <h2 className="mb-[2vh] text-xl font-semibold text-slate-800">
          Modifier la période de vacances
        </h2>

        <form action={formAction} className="space-y-[2vh]">
          <input type="hidden" name="periodeId" value={periode.id} />

          <div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">
                Nom de la période <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                name="nom"
                maxLength={100}
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex: Vacances de Noël 2025"
                className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-[2vh] md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">
                Date de début <span className="text-red-500">*</span>
              </span>
              <input
                type="date"
                name="debut"
                required
                value={debut}
                onChange={(e) => setDebut(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">
                Date de fin <span className="text-red-500">*</span>
              </span>
              <input
                type="date"
                name="fin"
                required
                value={fin}
                onChange={(e) => setFin(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>
          </div>

          <div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Description (optionnel)</span>
              <textarea
                name="description"
                maxLength={500}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Informations complémentaires..."
                className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>
          </div>

          {state && !state.ok && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}
