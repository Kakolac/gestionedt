"use client";

import { useActionState, useEffect } from "react";
import {
  deleteFormationFormAction,
  type FormationActionState,
} from "@/app/administration/_actions/formation";

type Props = {
  open: boolean;
  onClose: () => void;
  formationId: string | null;
  formationLabel: string | null;
};

const initial: FormationActionState | undefined = undefined;

export function SupprimerFormationConfirmModal({
  open,
  onClose,
  formationId,
  formationLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(
    deleteFormationFormAction,
    initial
  );

  useEffect(() => {
    if (state?.ok) {
      onClose();
    }
  }, [state, onClose]);

  if (!open || !formationId || !formationLabel) {
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
        aria-labelledby="supprimer-formation-titre"
        className="w-full max-w-[min(92vw,24rem)] rounded-2xl border border-white/60 bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="supprimer-formation-titre"
          className="text-lg font-semibold text-slate-900"
        >
          Supprimer cette formation ?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Formation : <strong>{formationLabel}</strong>. Le document sera supprimé ; les{" "}
          matières et les fiches professeur du référentiel restent inchangées.
        </p>

        <form action={formAction} className="mt-6 flex flex-wrap gap-2">
          <input type="hidden" name="formationId" value={formationId} />
          {state && !state.ok ? (
            <p role="alert" className="w-full text-sm text-red-700">
              {state.error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {pending ? "Suppression…" : "Supprimer"}
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={onClose}
          >
            Annuler
          </button>
        </form>
      </div>
    </div>
  );
}
