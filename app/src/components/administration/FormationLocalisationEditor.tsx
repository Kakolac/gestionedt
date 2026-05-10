"use client";

import { LOCALISATIONS_FERIES_ADMIN_OPTIONS } from "@/lib/planning/planning-public-holidays";

type Props = {
  /** Valeurs initiales (édition fiche). Chaînes vides = aucune localisation. */
  defaultPays: string;
  defaultRegion: string;
  freezeDuringSubmit: boolean;
};

export function FormationLocalisationEditor({
  defaultPays,
  defaultRegion,
  freezeDuringSubmit,
}: Props) {
  const freeze = freezeDuringSubmit ? "pointer-events-none opacity-60" : "";

  return (
    <div
      role="group"
      aria-labelledby="formation-localisation-titre"
      className={`rounded-2xl border border-slate-200 bg-slate-50/60 p-[min(4vw,0.875rem)] text-sm ${freeze}`}
    >
      <p id="formation-localisation-titre" className="font-medium text-slate-800">
        Localisation (jours fériés)
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Facultatif. Si vous choisissez un <strong>pays</strong>, le planner bloque les cours les{" "}
        <strong>jours fériés publics / bancaires</strong> de ce pays (via une bibliothèque de
        référence — pas une garantie juridique). Une <strong>subdivision</strong> optionnelle
        permet d’affiner lorsque le pays la prévoit (codes sans accent, ex. WAL pour la Belgique).
      </p>
      <div className="mt-[1.5vh] flex flex-col gap-[1.5vh] sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[min(88vw,16rem)] flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Pays</span>
          <select
            name="localisationPays"
            defaultValue={defaultPays.trim().toUpperCase()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
          >
            <option value="">— Aucune —</option>
            {LOCALISATIONS_FERIES_ADMIN_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.labelFr} ({o.code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[min(88vw,14rem)] flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">
            Subdivision <span className="font-normal text-slate-500">(optionnel)</span>
          </span>
          <input
            name="localisationRegion"
            type="text"
            maxLength={32}
            defaultValue={defaultRegion}
            placeholder="ex. WAL, BRU…"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
          />
        </label>
      </div>
    </div>
  );
}
