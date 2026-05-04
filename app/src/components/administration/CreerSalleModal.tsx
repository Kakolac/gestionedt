"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createSalleAction,
  type SalleActionState,
} from "@/app/administration/_actions/salles";

type Props = {
  open: boolean;
  onClose: () => void;
};

const initial: SalleActionState | undefined = undefined;

export function CreerSalleModal({ open, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createSalleAction, initial);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onClose();
    }
  }, [state, onClose]);

  if (!open) {
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
        aria-labelledby="creer-salle-titre"
        className="max-h-[90vh] w-full max-w-[min(92vw,28rem)] overflow-y-auto rounded-2xl border border-white/60 bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="creer-salle-titre"
          className="text-lg font-semibold text-slate-900"
        >
          Nouvelle salle
        </h2>

        <form
          ref={formRef}
          action={formAction}
          className="mt-4 flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Nom</span>
            <input
              name="nom"
              type="text"
              required
              maxLength={200}
              disabled={pending}
              autoComplete="off"
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            />
          </label>

          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="font-medium text-slate-800">Type de salle</legend>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="kind"
                value="classique"
                defaultChecked
                disabled={pending}
                className="text-indigo-600"
              />
              <span>Classique</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="kind"
                value="specifique"
                disabled={pending}
                className="text-indigo-600"
              />
              <span>Salle spécifique (équipement pédagogique)</span>
            </label>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">
              Description (optionnel)
            </span>
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              disabled={pending}
              placeholder="Pour une salle spécifique : précisez l’équipement (vidéoprojecteur, atelier, etc.)."
              className="resize-y rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            />
          </label>
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
              {pending ? "Enregistrement…" : "Créer"}
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
