"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  PLANNING_PROF_PALETTE_HUES,
  defaultHueForProfesseur,
  hexToHueDegrees,
  hueDegreesToHex,
  normalizeHueDegrees,
  normalizeHex6,
  type PlanningProfessorColorOverride,
} from "@/lib/planning/planning-professor-accent";

export type PlanningProfessorColorPickPopoverProps = {
  open: boolean;
  x: number;
  y: number;
  professeurId: string;
  professeurLabel: string;
  /** Surcharge : teinte pastel, hex exact ou `undefined` = automatique. */
  colorOverride: PlanningProfessorColorOverride | undefined;
  /** Palette ou raccourci : carte en pastel selon cette teinte. */
  onSelectHue: (hueDegrees: number) => void;
  /** Couleur libre : hex imposé sur le fond de la carte. */
  onSelectExactHex: (hex: string) => void;
  onClearOverride: () => void;
  onClose: () => void;
};

const POPOVER_W = 280;
const POPOVER_HINT_H = 390;

/** Égalité modulo 360 avec tolérance (flottants navigateur). */
function huesMatch(a: number, b: number, eps = 0.85): boolean {
  const da = Math.abs(a - b) % 360;
  const d = Math.min(da, 360 - da);
  return d < eps;
}

export function PlanningProfessorColorPickPopover({
  open,
  x,
  y,
  professeurId,
  professeurLabel,
  colorOverride,
  onSelectHue,
  onSelectExactHex,
  onClearOverride,
  onClose,
}: PlanningProfessorColorPickPopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const defaultHue = useMemo(
    () => defaultHueForProfesseur(professeurId),
    [professeurId]
  );

  const effectiveHueDegrees = useMemo(() => {
    if (colorOverride == null) return defaultHue;
    if (colorOverride.mode === "hue") return colorOverride.hueDegrees;
    const h = hexToHueDegrees(colorOverride.hex);
    return h != null ? h : defaultHue;
  }, [colorOverride, defaultHue]);

  const colorInputHex = useMemo(() => {
    if (colorOverride?.mode === "hex") {
      const hex = normalizeHex6(colorOverride.hex);
      if (hex != null) return hex;
    }
    return hueDegreesToHex(effectiveHueDegrees);
  }, [colorOverride, effectiveHueDegrees]);

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
  const iw =
    typeof window !== "undefined" ? window.innerWidth : x + POPOVER_W + pad;
  const ih =
    typeof window !== "undefined"
      ? window.innerHeight
      : y + POPOVER_HINT_H + pad;
  const left = Math.max(pad, Math.min(x, iw - POPOVER_W - pad));
  const top = Math.max(pad, Math.min(y, ih - POPOVER_HINT_H - pad));

  const freeColorLabel =
    colorOverride?.mode === "hex" && normalizeHex6(colorOverride.hex)
      ? normalizeHex6(colorOverride.hex)!
      : `${Math.round(normalizeHueDegrees(effectiveHueDegrees))}°`;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Choisir la couleur du professeur"
      className="fixed z-[90] flex w-[min(88vw,17.5rem)] flex-col gap-[1.25vh] rounded-xl border border-slate-200/95 bg-white p-[2vw] shadow-[0_12px_40px_rgba(15,23,42,0.2)]"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      <div>
        <p className="text-[clamp(0.72rem,1vw,0.8rem)] font-medium uppercase tracking-[0.1em] text-indigo-600/85">
          Couleur du professeur
        </p>
        <p className="mt-1 line-clamp-2 text-[clamp(0.85rem,1.2vw,0.97rem)] font-semibold text-slate-900">
          {professeurLabel}
        </p>
      </div>

      <label className="flex cursor-pointer flex-col gap-[0.6vh] rounded-lg border border-slate-200/90 bg-slate-50/80 px-[2vw] py-[1.2vh]">
        <span className="text-[clamp(0.78rem,1.05vw,0.88rem)] font-medium text-slate-800">
          Couleur libre
        </span>
        <span className="flex flex-wrap items-center gap-[min(2vw,0.65rem)]">
          <input
            type="color"
            aria-label="Choisir une couleur sur tout le spectre"
            value={colorInputHex}
            className="h-[min(8vw,2.65rem)] w-[min(24vw,4.75rem)] cursor-pointer rounded-md border border-slate-300/90 bg-white p-[0.35rem]"
            onChange={(e) => {
              const hex = normalizeHex6(e.target.value);
              if (hex != null) onSelectExactHex(hex);
            }}
          />
          <span className="max-w-[10rem] font-mono text-[clamp(0.72rem,0.98vw,0.8rem)] text-slate-600">
            {freeColorLabel}
          </span>
        </span>
      </label>

      <p className="text-[clamp(0.72rem,1vw,0.8rem)] text-slate-500">
        Raccourcis (même cercle chromatique) :
      </p>
      <div
        className="grid gap-[min(1.2vw,0.35rem)]"
        style={{
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
        }}
      >
        {PLANNING_PROF_PALETTE_HUES.map((hue) => {
          const isActive =
            huesMatch(effectiveHueDegrees, hue) && colorOverride?.mode !== "hex";
          return (
            <button
              key={hue}
              type="button"
              title={`${hue}°`}
              className={`aspect-square shrink-0 rounded-lg border shadow-sm outline-none ring-offset-2 transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                isActive
                  ? "ring-2 ring-indigo-600 ring-offset-2 scale-[1.02]"
                  : "border-slate-300/70"
              }`}
              style={{ background: `hsl(${hue} 45% 55%)` }}
              onClick={() => {
                onSelectHue(hue);
                onClose();
              }}
            />
          );
        })}
      </div>
      <button
        type="button"
        className="rounded-lg border border-slate-300/90 bg-slate-50 px-[2vw] py-[1vh] text-left text-[clamp(0.78rem,1.05vw,0.88rem)] font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        onClick={() => {
          onClearOverride();
          onClose();
        }}
      >
        Couleur automatique (défaut)
        <span className="mt-0.5 block font-normal text-slate-500">
          Dérivée du professeur, comme au chargement
        </span>
      </button>
    </div>
  );
}
