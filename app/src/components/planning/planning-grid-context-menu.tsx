"use client";

import { useEffect, useRef } from "react";

export type PlanningGridContextMenuProps = {
  open: boolean;
  x: number;
  y: number;
  /** Au moins un bloc est sélectionné pour échange. */
  hasSelection: boolean;
  /** « Intervertir » pertinent (sélection + bloc cible différent). */
  canSwap: boolean;
  /** Affiche l’entrée couleur professeur (grille planning). */
  showProfessorColorPick?: boolean;
  onClose: () => void;
  /** Enregistrer le bloc sous le curseur comme sélection. */
  onSelectBloc: () => void;
  /** Choisir une couleur pour le professeur du bloc sous le curseur. */
  onPickProfessorColor?: () => void;
  /** Échanger avec la sélection (bloc sous le curseur = cible). */
  onSwapWithSelection: () => void;
  /** Effacer la sélection sans fermer si besoin — parent peut aussi fermer menu. */
  onClearSelection: () => void;
};

/**
 * Menu contextuel léger (pas Radix) pour actions sur un bloc de la grille planning.
 */
export function PlanningGridContextMenu({
  open,
  x,
  y,
  hasSelection,
  canSwap,
  showProfessorColorPick = false,
  onClose,
  onSelectBloc,
  onPickProfessorColor,
  onSwapWithSelection,
  onClearSelection,
}: PlanningGridContextMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: MouseEvent | PointerEvent) => {
      const el = rootRef.current;
      if (el != null && e.target instanceof Node && el.contains(e.target)) {
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const pad = 8;
  const menuW = 260;
  const menuH = showProfessorColorPick ? 200 : 140;
  const iw = typeof window !== "undefined" ? window.innerWidth : x + menuW + pad;
  const ih = typeof window !== "undefined" ? window.innerHeight : y + menuH + pad;
  const left = Math.max(pad, Math.min(x, iw - menuW - pad));
  const top = Math.max(pad, Math.min(y, ih - menuH - pad));

  return (
    <div
      ref={rootRef}
      role="menu"
      aria-label="Actions bloc planning"
      className="fixed z-[80] min-w-[min(72vw,14rem)] rounded-xl border border-slate-200/95 bg-white py-[0.75vh] shadow-[0_12px_40px_rgba(15,23,42,0.18)]"
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      <button
        type="button"
        role="menuitem"
        className="block w-full px-[3vw] py-[1.2vh] text-left text-[clamp(0.8rem,1.15vw,0.95rem)] font-medium text-slate-800 hover:bg-indigo-50 focus-visible:bg-indigo-50 focus-visible:outline-none"
        onClick={() => {
          onSelectBloc();
          onClose();
        }}
      >
        Sélectionner
      </button>
      {showProfessorColorPick && onPickProfessorColor != null ? (
        <button
          type="button"
          role="menuitem"
          className="block w-full px-[3vw] py-[1.2vh] text-left text-[clamp(0.8rem,1.15vw,0.95rem)] font-medium text-slate-800 hover:bg-violet-50 focus-visible:bg-violet-50 focus-visible:outline-none"
          onClick={() => {
            onPickProfessorColor();
          }}
        >
          Couleur du professeur…
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        disabled={!canSwap}
        className="block w-full px-[3vw] py-[1.2vh] text-left text-[clamp(0.8rem,1.15vw,0.95rem)] font-medium text-slate-800 hover:bg-indigo-50 focus-visible:bg-indigo-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
        onClick={() => {
          if (!canSwap) return;
          onSwapWithSelection();
          onClose();
        }}
      >
        Intervertir avec la sélection
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!hasSelection}
        className="block w-full px-[3vw] py-[1.2vh] text-left text-[clamp(0.8rem,1.15vw,0.95rem)] font-medium text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
        onClick={() => {
          if (!hasSelection) return;
          onClearSelection();
          onClose();
        }}
      >
        Annuler la sélection
      </button>
    </div>
  );
}
