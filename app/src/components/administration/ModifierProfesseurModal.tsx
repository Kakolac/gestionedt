"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState } from "react";
import {
  updateProfesseurAction,
  type ProfesseurActionState,
} from "@/app/administration/_actions/professeurs";
import { ProfesseurContraintesEditor } from "@/components/administration/ProfesseurContraintesEditor";
import {
  ProfesseurMatieresChecklist,
  stableMatiereIdsKey,
  type MatiereOption,
} from "@/components/administration/ProfesseurMatieresChecklist";
import type { ProfesseurContrainteWire } from "@/lib/professeurContraintes.shared";

export type ProfesseurRow = {
  id: string;
  prenom: string;
  nom: string;
  description: string;
  matiereIds: string[];
  contraintes: ProfesseurContrainteWire[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  row: ProfesseurRow | null;
  matiereOptions: MatiereOption[];
};

const initial: ProfesseurActionState | undefined = undefined;

export function ModifierProfesseurModal({
  open,
  onClose,
  row,
  matiereOptions,
}: Props) {
  const router = useRouter();
  const [allowedMatiereIds, setAllowedMatiereIds] = useState<string[]>(
    () => row?.matiereIds ?? []
  );
  const onPickedChange = useCallback((ids: string[]) => {
    setAllowedMatiereIds(ids);
  }, []);
  const [state, formAction, pending] = useActionState(
    updateProfesseurAction,
    initial
  );

  useEffect(() => {
    if (!state?.ok) {
      return;
    }
    let cancelled = false;
    void (async () => {
      await router.refresh();
      if (!cancelled) {
        onClose();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, onClose, router]);

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
        aria-labelledby="modifier-professeur-titre"
        className="max-h-[90vh] w-full max-w-[min(92vw,36rem)] overflow-y-auto rounded-2xl border border-white/60 bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="modifier-professeur-titre"
          className="text-lg font-semibold text-slate-900"
        >
          Modifier le professeur
        </h2>

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="professeurId" value={row.id} />

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Prénom</span>
            <input
              name="prenom"
              type="text"
              maxLength={120}
              readOnly={pending}
              autoComplete="given-name"
              defaultValue={row.prenom}
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none read-only:pointer-events-none read-only:bg-slate-50 read-only:opacity-80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Nom</span>
            <input
              name="nom"
              type="text"
              required
              maxLength={120}
              readOnly={pending}
              autoComplete="family-name"
              defaultValue={row.nom}
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none read-only:pointer-events-none read-only:bg-slate-50 read-only:opacity-80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
            />
          </label>
          <ProfesseurMatieresChecklist
            key={`${row.id}-${stableMatiereIdsKey(row.matiereIds)}`}
            options={matiereOptions}
            defaultSelectedIds={row.matiereIds}
            freezeDuringSubmit={pending}
            onPickedChange={onPickedChange}
          />
          <ProfesseurContraintesEditor
            key={`contraintes-${row.id}`}
            allowedMatiereIds={allowedMatiereIds}
            matiereOptions={matiereOptions}
            defaultContraintes={row.contraintes}
            freezeDuringSubmit={pending}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">
              Notes / contact (optionnel)
            </span>
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              readOnly={pending}
              defaultValue={row.description}
              className="resize-y rounded-xl border border-slate-200 px-3 py-2 outline-none read-only:pointer-events-none read-only:bg-slate-50 read-only:opacity-80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
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
