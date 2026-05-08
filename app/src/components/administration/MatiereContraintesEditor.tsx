"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CONTRAINTE_MAX_COUNT_MATIERE,
  MATIERE_PRIORITE_DEFAUT_EDITION,
  MATIERE_PRIORITE_MAX_STRICT,
  PLAGE_HORAIRE_SEUIL_MIDI,
  type MatiereContrainteKind,
  type MatiereContrainteWire,
  type MatierePlageHoraire,
} from "@/lib/matiereContraintes.shared";

type Row = { key: string; data: MatiereContrainteWire };

const KIND_OPTIONS: { value: MatiereContrainteKind; label: string }[] = [
  { value: "plage_horaire", label: "Plage horaire (matin / après-midi)" },
];

const PLAGE_LABELS: Record<MatierePlageHoraire, string> = {
  matin: `Matin (créneau entièrement avant ${PLAGE_HORAIRE_SEUIL_MIDI} h)`,
  apres_midi: `Après-midi (créneau entièrement à partir de ${PLAGE_HORAIRE_SEUIL_MIDI} h)`,
};

function makeRowKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hasPlageRow(rows: Row[]): boolean {
  return rows.some((r) => r.data.kind === "plage_horaire");
}

function canAddAnotherRow(rows: Row[]): boolean {
  if (rows.length >= CONTRAINTE_MAX_COUNT_MATIERE) {
    return false;
  }
  return !hasPlageRow(rows);
}

function newContrainte(kind: MatiereContrainteKind): MatiereContrainteWire {
  switch (kind) {
    case "plage_horaire":
      return {
        kind: "plage_horaire",
        /** Défaut **strict** : le glouton rejette les créneaux hors plage (&gt; 50 pour passer en souple). */
        priorite: MATIERE_PRIORITE_DEFAUT_EDITION,
        actif: true,
        plage: "matin",
      };
  }
}

function migrateKind(prev: MatiereContrainteWire, kind: MatiereContrainteKind): MatiereContrainteWire {
  const { priorite, actif } = prev;
  const base = newContrainte(kind);
  return { ...base, priorite, actif };
}

function initialRows(defaultContraintes: MatiereContrainteWire[]): Row[] {
  return defaultContraintes.map((data) => ({
    key: makeRowKey(),
    data: { ...data },
  }));
}

type Props = {
  defaultContraintes: MatiereContrainteWire[];
  freezeDuringSubmit: boolean;
};

export function MatiereContraintesEditor({
  defaultContraintes,
  freezeDuringSubmit,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialRows(defaultContraintes)
  );

  const canAddMore = useMemo(() => canAddAnotherRow(rows), [rows]);

  const jsonPayload = useMemo(
    () => JSON.stringify(rows.map((r) => r.data)),
    [rows]
  );

  const addRow = useCallback(() => {
    setRows((prev) => {
      if (!canAddAnotherRow(prev)) {
        return prev;
      }
      return [
        ...prev,
        {
          key: makeRowKey(),
          data: newContrainte("plage_horaire"),
        },
      ];
    });
  }, []);

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const updateRow = useCallback((key: string, next: MatiereContrainteWire) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { key, data: next } : r))
    );
  }, []);

  const setRowKind = useCallback((key: string, kind: MatiereContrainteKind) => {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key ? { key, data: migrateKind(r.data, kind) } : r
      )
    );
  }, []);

  return (
    <div
      role="group"
      aria-labelledby="matiere-contraintes-editeur-titre"
      className="flex flex-col gap-3 text-sm"
    >
      <p
        id="matiere-contraintes-editeur-titre"
        className="font-medium text-slate-800"
      >
        Contraintes de planification
      </p>
      <input type="hidden" name="contraintesJson" value={jsonPayload} readOnly />
      <p className="text-xs text-slate-500">
        Optionnel. Au plus une contrainte « Plage horaire » par matière. Priorité ≤{" "}
        {MATIERE_PRIORITE_MAX_STRICT} : hors plage{" "}
        <strong className="font-semibold text-slate-700">bloque</strong> le placement
        glouton ; priorité &gt; {MATIERE_PRIORITE_MAX_STRICT} : préférence{" "}
        <strong className="font-semibold text-slate-700">souple</strong> (pénalité sans
        blocage si aucun créneau compatible). Frontière matin / après-midi :{" "}
        {PLAGE_HORAIRE_SEUIL_MIDI} h (la séance entière doit tenir dans la plage).
      </p>
      <div
        className={
          freezeDuringSubmit
            ? "pointer-events-none space-y-3 opacity-60"
            : "space-y-3"
        }
      >
        {rows.map((entry) => (
          <div
            key={entry.key}
            className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3"
          >
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[min(72vw,18rem)] flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Type</span>
                <select
                  value={entry.data.kind}
                  onChange={(e) => {
                    setRowKind(entry.key, e.target.value as MatiereContrainteKind);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
                >
                  {KIND_OPTIONS.map((o) => {
                    const dis =
                      o.value === "plage_horaire" &&
                      hasPlageRow(rows.filter((r) => r.key !== entry.key));
                    return (
                      <option key={o.value} value={o.value} disabled={dis}>
                        {o.label}
                        {dis ? " — déjà défini" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="flex w-[min(22vw,5.5rem)] flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Priorité</span>
                <input
                  type="number"
                  step={1}
                  value={entry.data.priorite}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const p = Number.isFinite(v) ? Math.trunc(v) : 0;
                    updateRow(entry.key, { ...entry.data, priorite: p });
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
                />
              </label>
              <label className="flex items-center gap-2 pb-1.5 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={entry.data.actif}
                  onChange={(e) => {
                    updateRow(entry.key, {
                      ...entry.data,
                      actif: e.target.checked,
                    });
                  }}
                  className="accent-indigo-600"
                />
                Actif
              </label>
              <button
                type="button"
                onClick={() => removeRow(entry.key)}
                className="ml-auto rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                Retirer
              </button>
            </div>

            {entry.data.kind === "plage_horaire" ? (
              <label className="flex max-w-[min(88vw,22rem)] flex-col gap-1 pt-1">
                <span className="text-xs font-medium text-slate-600">Plage souhaitée</span>
                <select
                  value={entry.data.plage}
                  onChange={(e) => {
                    const d = entry.data;
                    if (d.kind !== "plage_horaire") return;
                    updateRow(entry.key, {
                      ...d,
                      plage: e.target.value as MatierePlageHoraire,
                    });
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
                >
                  {(Object.keys(PLAGE_LABELS) as MatierePlageHoraire[]).map((p) => (
                    <option key={p} value={p}>
                      {PLAGE_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={
          freezeDuringSubmit ||
          rows.length >= CONTRAINTE_MAX_COUNT_MATIERE ||
          !canAddMore
        }
        onClick={addRow}
        className="self-start rounded-xl border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
      >
        Ajouter une contrainte
      </button>
    </div>
  );
}
