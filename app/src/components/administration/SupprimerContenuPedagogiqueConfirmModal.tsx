"use client";

import { useActionState, useEffect } from "react";
import {
  deleteContenuPedagogiqueFormAction,
  type ContenuPedagogiqueActionState,
} from "@/app/administration/_actions/contenuPedagogique";

type Props = {
  open: boolean;
  onClose: () => void;
  contenuPedagogiqueId: string | null;
  contenuLabel: string | null;
};

const initial: ContenuPedagogiqueActionState | undefined = undefined;

export function SupprimerContenuPedagogiqueConfirmModal({
  open,
  onClose,
  contenuPedagogiqueId,
  contenuLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(
    deleteContenuPedagogiqueFormAction,
    initial
  );

  useEffect(() => {
    if (state?.ok) {
      onClose();
    }
  }, [state, onClose]);

  if (!open || !contenuPedagogiqueId || !contenuLabel) {
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
        aria-labelledby="supprimer-contenu-pedagogique-titre"
        className="w-full max-w-[min(92vw,24rem)] rounded-2xl border border-white/60 bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="supprimer-contenu-pedagogique-titre"
          className="text-lg font-semibold text-slate-900"
        >
          Supprimer ce contenu ?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Contenu : <strong>{contenuLabel}</strong>. Le document sera supprimé ; les{" "}
          matières et les fiches professeur du référentiel restent inchangées.
        </p>

        <form action={formAction} className="mt-6 flex flex-wrap gap-2">
          <input type="hidden" name="contenuPedagogiqueId" value={contenuPedagogiqueId} />
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
