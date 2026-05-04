"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  deleteMetierRoleAction,
  type MetierRoleActionState,
} from "@/app/administration/_actions/metierRoles";

type Props = {
  open: boolean;
  onClose: () => void;
  slug: string | null;
  label: string | null;
};

const initial: MetierRoleActionState | undefined = undefined;

export function SupprimerRoleMetierModal({
  open,
  onClose,
  slug,
  label,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    deleteMetierRoleAction,
    initial
  );

  useEffect(() => {
    if (state?.ok) {
      onClose();
      router.refresh();
    }
  }, [state, onClose, router]);

  if (!open || !slug || !label) {
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
        aria-labelledby="supprimer-role-metier-titre"
        className="w-full max-w-md rounded-2xl border border-white/60 bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="supprimer-role-metier-titre"
          className="text-lg font-semibold text-slate-900"
        >
          Supprimer ce rôle métier ?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          <strong>{label}</strong>{" "}
          <span className="font-mono text-xs text-slate-500">({slug})</span>.
          Les utilisateurs perdront ce rôle métier ; les lignes de la matrice des
          menus qui ne contiendraient plus aucun métier deviendront sans
          visibilité (mode strict).
        </p>

        <form action={formAction} className="mt-6 flex flex-wrap gap-2">
          <input type="hidden" name="slug" value={slug} />
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
