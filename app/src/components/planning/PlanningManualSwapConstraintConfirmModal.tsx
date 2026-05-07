"use client";

import type { ManualSwapProfessorConstraintIssue } from "@/lib/planning/planning-manual-swap-constraints";
import { useEffect } from "react";

export type PlanningManualSwapConstraintConfirmModalProps = {
  open: boolean;
  issues: ManualSwapProfessorConstraintIssue[];
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmation lorsqu’un échange de blocs place un professeur sur un créneau
 * incompatible avec ses contraintes (voir `collectProfessorConstraintIssuesAfterSwap`).
 */
export function PlanningManualSwapConstraintConfirmModal({
  open,
  issues,
  onConfirm,
  onCancel,
}: PlanningManualSwapConstraintConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || issues.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-[2vw]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-contrainte-titre"
        className="max-h-[min(88dvh,90vh)] w-full max-w-[min(92vw,36rem)] overflow-hidden rounded-2xl border border-amber-200/90 bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-amber-100 bg-amber-50/95 px-[3vw] py-[1.75vh]">
          <h2
            id="swap-contrainte-titre"
            className="text-[clamp(1rem,1.5vw,1.15rem)] font-semibold text-amber-950"
          >
            Conflit avec les contraintes professeur
          </h2>
          <p className="mt-[0.75vh] text-[clamp(0.82rem,1.15vw,0.95rem)] leading-snug text-amber-950/85">
            Après cet échange, au moins un professeur se retrouve sur un créneau ou une
            combinaison (salle, volume, blocs…) qui ne respecte pas les mêmes règles
            que le moteur de placement automatique. Vous pouvez annuler ou confirmer
            l’échange pour appliquer quand même ce réglage.
          </p>
        </div>
        <div className="max-h-[min(52dvh,50vh)] overflow-y-auto px-[3vw] py-[1.5vh]">
          <ul className="list-none space-y-[1.5vh] text-[clamp(0.8rem,1.12vw,0.92rem)] text-slate-800">
            {issues.map((issue) => (
              <li
                key={issue.professeurId}
                className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-[2.25vw] py-[1.25vh]"
              >
                <p className="font-semibold text-slate-900">
                  {issue.professeurLabel}
                </p>
                <ul className="mt-[0.75vh] list-disc space-y-1 pl-[1.25rem] text-slate-700">
                  {issue.lignes.map((line, i) => (
                    <li key={i} className="leading-snug">
                      {line}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-[1.5vw] border-t border-slate-100 bg-slate-50/60 px-[3vw] py-[1.5vh]">
          <button
            type="button"
            className="rounded-xl bg-amber-600 px-[3vw] py-[1vh] text-[clamp(0.82rem,1.1vw,0.95rem)] font-semibold text-white shadow-sm hover:bg-amber-500 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/80"
            onClick={onConfirm}
          >
            Confirmer l’échange
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-[3vw] py-[1vh] text-[clamp(0.82rem,1.1vw,0.95rem)] font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-slate-400/50"
            onClick={onCancel}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
