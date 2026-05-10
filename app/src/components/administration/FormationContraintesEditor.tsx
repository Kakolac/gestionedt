"use client";

import { useCallback, useMemo, useState } from "react";
import {
  FORMATION_CONTRAINTE_KINDS,
  type FormationContrainteWire,
} from "@/lib/formationContraintes.shared";
import { mergeFormationDefaultsWire } from "@/lib/formationContraintes";

const JOURS_CHECK: { value: number; label: string }[] = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

function replaceKind(
  bundle: FormationContrainteWire[],
  next: FormationContrainteWire
): FormationContrainteWire[] {
  return bundle.map((c) => (c.kind === next.kind ? next : c));
}

type Props = {
  defaultContraintes: FormationContrainteWire[];
  freezeDuringSubmit: boolean;
};

export function FormationContraintesEditor({
  defaultContraintes,
  freezeDuringSubmit,
}: Props) {
  const [bundle, setBundle] = useState<FormationContrainteWire[]>(() =>
    mergeFormationDefaultsWire(defaultContraintes)
  );

  const jsonPayload = useMemo(
    () =>
      JSON.stringify(
        FORMATION_CONTRAINTE_KINDS.map((k) => bundle.find((c) => c.kind === k)!)
      ),
    [bundle]
  );

  const pause = bundle.find((c): c is Extract<FormationContrainteWire, { kind: "pause_midi" }> => c.kind === "pause_midi");
  const dem = bundle.find(
    (c): c is Extract<FormationContrainteWire, { kind: "heure_demarrage" }> =>
      c.kind === "heure_demarrage"
  );
  const fin = bundle.find(
    (c): c is Extract<FormationContrainteWire, { kind: "heure_fin" }> =>
      c.kind === "heure_fin"
  );
  const jours = bundle.find(
    (c): c is Extract<FormationContrainteWire, { kind: "jours_formation" }> =>
      c.kind === "jours_formation"
  );

  const toggleJour = useCallback((jour: number) => {
    setBundle((prev) => {
      const j = prev.find((c) => c.kind === "jours_formation");
      if (!j || j.kind !== "jours_formation") return prev;
      const set = new Set(j.joursSemaine);
      if (set.has(jour)) {
        if (set.size <= 1) return prev;
        set.delete(jour);
      } else {
        set.add(jour);
      }
      const sorted = [...set].sort((a, b) => a - b);
      return replaceKind(prev, {
        kind: "jours_formation",
        joursSemaine: sorted,
      });
    });
  }, []);

  const wrapCls = freezeDuringSubmit
    ? "pointer-events-none space-y-[2vh] opacity-60"
    : "space-y-[2vh]";

  return (
    <div
      role="group"
      aria-labelledby="formation-contraintes-editeur-titre"
      className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-[min(4vw,0.875rem)] text-sm"
    >
      <input type="hidden" name="formationContraintesJson" value={jsonPayload} readOnly />
      <p
        id="formation-contraintes-editeur-titre"
        className="font-medium text-slate-800"
      >
        Contraintes de planification (formation)
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Quatre réglages <strong className="font-semibold text-slate-700">obligatoires</strong> pour le moteur :
        pause méridienne sans cours, première heure de cours possible, dernière heure de fin possible
        (inclusive), et jours où la formation peut être placée. Pas de mode « souple » : hors contrainte,
        le créneau est refusé.
      </p>

      <div className={wrapCls}>
        {/* 1 — Pause midi */}
        <div className="space-y-2 rounded-xl border border-white/80 bg-white px-3 py-2 shadow-sm">
          <p className="text-xs font-semibold text-slate-700">
            1. Pause du midi (aucun cours pendant cet intervalle — fin exclusive, comme la grille)
          </p>
          {pause ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[0.65rem] font-medium text-slate-600">Début (h)</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  step={1}
                  value={pause.heureDebut}
                  onChange={(e) => {
                    const v = Math.trunc(Number(e.target.value));
                    if (!Number.isFinite(v)) return;
                    setBundle((prev) =>
                      replaceKind(prev, {
                        kind: "pause_midi",
                        heureDebut: v,
                        heureFin: pause.heureFin,
                      })
                    );
                  }}
                  className="max-w-[min(18vw,5rem)] rounded-lg border border-slate-200 px-2 py-1 tabular-nums outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[0.65rem] font-medium text-slate-600">Fin (h)</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  step={1}
                  value={pause.heureFin}
                  onChange={(e) => {
                    const v = Math.trunc(Number(e.target.value));
                    if (!Number.isFinite(v)) return;
                    setBundle((prev) =>
                      replaceKind(prev, {
                        kind: "pause_midi",
                        heureDebut: pause.heureDebut,
                        heureFin: v,
                      })
                    );
                  }}
                  className="max-w-[min(18vw,5rem)] rounded-lg border border-slate-200 px-2 py-1 tabular-nums outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
                />
              </label>
            </div>
          ) : null}
        </div>

        {/* 2 — Heure démarrage */}
        <div className="space-y-2 rounded-xl border border-white/80 bg-white px-3 py-2 shadow-sm">
          <p className="text-xs font-semibold text-slate-700">
            2. Heure de démarrage (première heure possible pour le <em>début</em> d’un cours)
          </p>
          {dem ? (
            <label className="flex flex-col gap-1">
              <span className="text-[0.65rem] font-medium text-slate-600">À partir de (h)</span>
              <input
                type="number"
                min={0}
                max={23}
                step={1}
                value={dem.heureMin}
                onChange={(e) => {
                  const v = Math.trunc(Number(e.target.value));
                  if (!Number.isFinite(v)) return;
                  setBundle((prev) =>
                    replaceKind(prev, { kind: "heure_demarrage", heureMin: v })
                  );
                }}
                className="max-w-[min(18vw,5rem)] rounded-lg border border-slate-200 px-2 py-1 tabular-nums outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>
          ) : null}
        </div>

        {/* 3 — Heure fin */}
        <div className="space-y-2 rounded-xl border border-white/80 bg-white px-3 py-2 shadow-sm">
          <p className="text-xs font-semibold text-slate-700">
            3. Heure de fin (dernière heure de <em>fin</em> de cours autorisée, inclusive)
          </p>
          {fin ? (
            <label className="flex flex-col gap-1">
              <span className="text-[0.65rem] font-medium text-slate-600">Au plus tard (h)</span>
              <input
                type="number"
                min={1}
                max={24}
                step={1}
                value={fin.heureFinMax}
                onChange={(e) => {
                  const v = Math.trunc(Number(e.target.value));
                  if (!Number.isFinite(v)) return;
                  setBundle((prev) =>
                    replaceKind(prev, { kind: "heure_fin", heureFinMax: v })
                  );
                }}
                className="max-w-[min(18vw,5rem)] rounded-lg border border-slate-200 px-2 py-1 tabular-nums outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>
          ) : null}
        </div>

        {/* 4 — Jours */}
        <div className="space-y-2 rounded-xl border border-white/80 bg-white px-3 py-2 shadow-sm">
          <p className="text-xs font-semibold text-slate-700">
            4. Jours de la formation (1 = lundi … 7 = dimanche)
          </p>
          {jours ? (
            <div className="flex flex-wrap gap-x-[min(3vw,0.75rem)] gap-y-2">
              {JOURS_CHECK.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700"
                >
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/40"
                    checked={jours.joursSemaine.includes(value)}
                    onChange={() => toggleJour(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          ) : null}
          <p className="text-[0.65rem] text-slate-500">
            Au moins un jour doit rester coché — la sauvegarde refuse une liste vide.
          </p>
        </div>
      </div>
    </div>
  );
}
