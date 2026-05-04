"use client";

import { useActionState, useEffect } from "react";
import {
  deleteUserFormAction,
  type UserActionState,
} from "@/app/administration/_actions/users";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  emailLabel: string | null;
};

const initial: UserActionState | undefined = undefined;

export function SupprimerUtilisateurConfirmModal({
  open,
  onClose,
  userId,
  emailLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(
    deleteUserFormAction,
    initial
  );

  useEffect(() => {
    if (state?.ok) {
      onClose();
    }
  }, [state, onClose]);

  if (!open || !userId || !emailLabel) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
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
        aria-labelledby="supprimer-utilisateur-titre"
        className="w-full max-w-md rounded-2xl border border-white/60 bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="supprimer-utilisateur-titre"
          className="text-lg font-semibold text-slate-900"
        >
          Supprimer l&apos;utilisateur ?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Compte : <strong>{emailLabel}</strong>. Cette action est définitive.
        </p>

        <form action={formAction} className="mt-6 flex flex-wrap gap-2">
          <input type="hidden" name="userId" value={userId} />
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
