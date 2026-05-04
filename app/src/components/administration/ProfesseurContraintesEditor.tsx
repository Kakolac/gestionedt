"use client";

import { useCallback, useMemo, useState } from "react";
import type { MatiereOption } from "@/components/administration/ProfesseurMatieresChecklist";
import {
  CONTRAINTE_MAX_COUNT,
  MAX_COURS_PAR_JOUR,
  MAX_HEURES_CONSECUTIVES,
  type ProfesseurContrainteKind,
  type ProfesseurContrainteWire,
} from "@/lib/professeurContraintes.shared";

type Row = { key: string; data: ProfesseurContrainteWire };

const JOURS: { value: number; label: string }[] = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

const KIND_OPTIONS: { value: ProfesseurContrainteKind; label: string }[] = [
  { value: "jours_travail", label: "Jours de travail" },
  {
    value: "bloc_consecutif_matiere",
    label: "Heures consécutives (par matière)",
  },
  { value: "volume_jour_matiere", label: "Cours par jour (par matière)" },
];

function makeRowKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function canonMatiereId(id: string): string {
  return id.trim().toLowerCase();
}

type MatiereKind = "bloc_consecutif_matiere" | "volume_jour_matiere";

function matiereCanonTakenForKind(
  rows: Row[],
  excludeKey: string | null,
  kind: MatiereKind
): Set<string> {
  const taken = new Set<string>();
  for (const r of rows) {
    if (excludeKey !== null && r.key === excludeKey) {
      continue;
    }
    if (r.data.kind === kind) {
      taken.add(canonMatiereId(r.data.matiereId));
    }
  }
  return taken;
}

function firstFreeMatiereIdForKind(
  rows: Row[],
  excludeKey: string | null,
  kind: MatiereKind,
  matiereChoices: MatiereOption[]
): string {
  const taken = matiereCanonTakenForKind(rows, excludeKey, kind);
  for (const m of matiereChoices) {
    if (!taken.has(canonMatiereId(m.id))) {
      return m.id;
    }
  }
  return "";
}

function isJoursKindSelectable(rows: Row[], rowKey: string): boolean {
  return !rows.some(
    (r) => r.key !== rowKey && r.data.kind === "jours_travail"
  );
}

function isBlocKindSelectable(
  rows: Row[],
  rowKey: string,
  matiereChoices: MatiereOption[]
): boolean {
  if (matiereChoices.length === 0) {
    return false;
  }
  return (
    firstFreeMatiereIdForKind(
      rows,
      rowKey,
      "bloc_consecutif_matiere",
      matiereChoices
    ) !== ""
  );
}

function isVolumeKindSelectable(
  rows: Row[],
  rowKey: string,
  matiereChoices: MatiereOption[]
): boolean {
  if (matiereChoices.length === 0) {
    return false;
  }
  return (
    firstFreeMatiereIdForKind(rows, rowKey, "volume_jour_matiere", matiereChoices) !==
    ""
  );
}

function canAddAnotherRow(rows: Row[], matiereChoices: MatiereOption[]): boolean {
  if (!rows.some((r) => r.data.kind === "jours_travail")) {
    return true;
  }
  if (
    firstFreeMatiereIdForKind(
      rows,
      null,
      "bloc_consecutif_matiere",
      matiereChoices
    ) !== ""
  ) {
    return true;
  }
  if (
    firstFreeMatiereIdForKind(
      rows,
      null,
      "volume_jour_matiere",
      matiereChoices
    ) !== ""
  ) {
    return true;
  }
  return false;
}

function pickKindForNewRow(
  rows: Row[],
  matiereChoices: MatiereOption[]
): ProfesseurContrainteKind {
  if (!rows.some((r) => r.data.kind === "jours_travail")) {
    return "jours_travail";
  }
  if (
    firstFreeMatiereIdForKind(
      rows,
      null,
      "bloc_consecutif_matiere",
      matiereChoices
    )
  ) {
    return "bloc_consecutif_matiere";
  }
  if (
    firstFreeMatiereIdForKind(
      rows,
      null,
      "volume_jour_matiere",
      matiereChoices
    )
  ) {
    return "volume_jour_matiere";
  }
  return "jours_travail";
}

function isMatiereOptionTakenByOtherRow(
  rows: Row[],
  rowKey: string,
  kind: MatiereKind,
  optionMatiereId: string,
  currentMatiereId: string
): boolean {
  const opt = canonMatiereId(optionMatiereId);
  if (canonMatiereId(currentMatiereId) === opt) {
    return false;
  }
  return rows.some(
    (r) =>
      r.key !== rowKey &&
      r.data.kind === kind &&
      canonMatiereId(r.data.matiereId) === opt
  );
}

function newContrainte(
  kind: ProfesseurContrainteKind,
  defaultMatiereId: string
): ProfesseurContrainteWire {
  switch (kind) {
    case "jours_travail":
      return {
        kind,
        priorite: 10,
        actif: true,
        joursSemaine: [1, 2, 3, 4, 5],
      };
    case "bloc_consecutif_matiere":
      return {
        kind,
        priorite: 20,
        actif: true,
        matiereId: defaultMatiereId,
        maxHeuresConsecutives: 2,
      };
    case "volume_jour_matiere":
      return {
        kind,
        priorite: 30,
        actif: true,
        matiereId: defaultMatiereId,
        maxCoursParJour: 2,
      };
  }
}

function migrateKind(
  prev: ProfesseurContrainteWire,
  kind: ProfesseurContrainteKind,
  defaultMatiereId: string
): ProfesseurContrainteWire {
  const { priorite, actif } = prev;
  const base = newContrainte(kind, defaultMatiereId);
  return { ...base, priorite, actif };
}

function initialRows(defaultContraintes: ProfesseurContrainteWire[]): Row[] {
  return defaultContraintes.map((data) => ({
    key: makeRowKey(),
    data: { ...data },
  }));
}

function normalizedRowsForMatiereChoices(
  rows: Row[],
  matiereChoices: MatiereOption[]
): Row[] {
  if (matiereChoices.length === 0) {
    return rows;
  }
  let changed = false;
  const out: Row[] = rows.map((r) => ({
    key: r.key,
    data: { ...r.data },
  }));

  const assignSequential = (kind: MatiereKind) => {
    const used = new Set<string>();
    for (let i = 0; i < out.length; i += 1) {
      const r = out[i];
      if (r.data.kind !== kind) {
        continue;
      }
      const d = r.data;
      const c = canonMatiereId(d.matiereId);
      const inList =
        d.matiereId.trim() !== "" &&
        matiereChoices.some((m) => canonMatiereId(m.id) === c);
      const conflict = inList && used.has(c);
      if (inList && !conflict) {
        used.add(c);
        continue;
      }
      const next = matiereChoices.find(
        (m) => !used.has(canonMatiereId(m.id))
      );
      if (next) {
        if (next.id !== d.matiereId) {
          changed = true;
        }
        r.data = { ...d, matiereId: next.id };
        used.add(canonMatiereId(next.id));
      }
    }
  };

  assignSequential("bloc_consecutif_matiere");
  assignSequential("volume_jour_matiere");

  return changed ? out : rows;
}

type Props = {
  allowedMatiereIds: string[];
  matiereOptions: MatiereOption[];
  defaultContraintes: ProfesseurContrainteWire[];
  freezeDuringSubmit: boolean;
};

export function ProfesseurContraintesEditor({
  allowedMatiereIds,
  matiereOptions,
  defaultContraintes,
  freezeDuringSubmit,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialRows(defaultContraintes)
  );

  const allowedCanon = useMemo(
    () => new Set(allowedMatiereIds.map((id) => canonMatiereId(id))),
    [allowedMatiereIds]
  );

  const matiereChoices = useMemo(
    () =>
      matiereOptions.filter((m) => allowedCanon.has(canonMatiereId(m.id))),
    [matiereOptions, allowedCanon]
  );

  const rowsForUi = useMemo(
    () => normalizedRowsForMatiereChoices(rows, matiereChoices),
    [rows, matiereChoices]
  );

  const canAddMore = useMemo(
    () => canAddAnotherRow(rowsForUi, matiereChoices),
    [rowsForUi, matiereChoices]
  );

  const jsonPayload = useMemo(
    () => JSON.stringify(rowsForUi.map((r) => r.data)),
    [rowsForUi]
  );

  const addRow = useCallback(() => {
    setRows((prev) => {
      if (prev.length >= CONTRAINTE_MAX_COUNT) {
        return prev;
      }
      const normalized = normalizedRowsForMatiereChoices(prev, matiereChoices);
      if (!canAddAnotherRow(normalized, matiereChoices)) {
        return prev;
      }
      const kind = pickKindForNewRow(normalized, matiereChoices);
      const mid =
        kind === "bloc_consecutif_matiere"
          ? firstFreeMatiereIdForKind(
              normalized,
              null,
              "bloc_consecutif_matiere",
              matiereChoices
            )
          : kind === "volume_jour_matiere"
            ? firstFreeMatiereIdForKind(
                normalized,
                null,
                "volume_jour_matiere",
                matiereChoices
              )
            : "";
      return [
        ...prev,
        {
          key: makeRowKey(),
          data: newContrainte(kind, mid),
        },
      ];
    });
  }, [matiereChoices]);

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const updateRow = useCallback((key: string, next: ProfesseurContrainteWire) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { key, data: next } : r))
    );
  }, []);

  const setRowKind = useCallback(
    (key: string, kind: ProfesseurContrainteKind) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.key !== key) {
            return r;
          }
          let mid = "";
          if (kind === "bloc_consecutif_matiere") {
            mid =
              firstFreeMatiereIdForKind(
                prev,
                key,
                "bloc_consecutif_matiere",
                matiereChoices
              ) ||
              matiereChoices[0]?.id ||
              "";
          } else if (kind === "volume_jour_matiere") {
            mid =
              firstFreeMatiereIdForKind(
                prev,
                key,
                "volume_jour_matiere",
                matiereChoices
              ) ||
              matiereChoices[0]?.id ||
              "";
          }
          return {
            key,
            data: migrateKind(r.data, kind, mid),
          };
        })
      );
    },
    [matiereChoices]
  );

  const toggleJour = useCallback(
    (key: string, jour: number, checked: boolean) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.key !== key || r.data.kind !== "jours_travail") {
            return r;
          }
          const set = new Set(r.data.joursSemaine);
          if (checked) {
            set.add(jour);
          } else {
            set.delete(jour);
          }
          const joursSemaine = [...set].sort((a, b) => a - b);
          return {
            key,
            data: { ...r.data, joursSemaine },
          };
        })
      );
    },
    []
  );

  return (
    <div
      role="group"
      aria-labelledby="prof-contraintes-editeur-titre"
      className="flex flex-col gap-3 text-sm"
    >
      <p
        id="prof-contraintes-editeur-titre"
        className="font-medium text-slate-800"
      >
        Contraintes de planification
      </p>
      <input type="hidden" name="contraintesJson" value={jsonPayload} readOnly />
      <p className="text-xs text-slate-500">
        Plusieurs contraintes peuvent être actives en même temps. Règles : au plus
        une ligne « Jours de travail », et pour chaque matière au plus une ligne
        « Heures consécutives » et une ligne « Cours par jour ». Les types ou
        matières déjà pris sont grisés dans les listes.
      </p>
      <div
        className={
          freezeDuringSubmit
            ? "pointer-events-none space-y-3 opacity-60"
            : "space-y-3"
        }
      >
        {rowsForUi.map((entry) => {
          const matiereIdPourSelect =
            entry.data.kind === "bloc_consecutif_matiere" ||
            entry.data.kind === "volume_jour_matiere"
              ? entry.data.matiereId
              : "";
          return (
          <div
            key={entry.key}
            className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3"
          >
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[min(44vw,10rem)] flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Type</span>
                <select
                  value={entry.data.kind}
                  onChange={(e) => {
                    setRowKind(
                      entry.key,
                      e.target.value as ProfesseurContrainteKind
                    );
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
                >
                  {KIND_OPTIONS.map((o) => {
                    let dis = false;
                    if (o.value === "jours_travail") {
                      dis = !isJoursKindSelectable(rowsForUi, entry.key);
                    } else if (o.value === "bloc_consecutif_matiere") {
                      dis = !isBlocKindSelectable(
                        rowsForUi,
                        entry.key,
                        matiereChoices
                      );
                    } else {
                      dis = !isVolumeKindSelectable(
                        rowsForUi,
                        entry.key,
                        matiereChoices
                      );
                    }
                    if (entry.data.kind === o.value) {
                      dis = false;
                    }
                    return (
                      <option key={o.value} value={o.value} disabled={dis}>
                        {o.label}
                        {dis ? " — déjà utilisé" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="flex w-[min(22vw,5.5rem)] flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">
                  Priorité
                </span>
                <input
                  type="number"
                  step={1}
                  value={entry.data.priorite}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const p = Number.isFinite(v) ? Math.trunc(v) : 0;
                    const d = entry.data;
                    if (d.kind === "jours_travail") {
                      updateRow(entry.key, { ...d, priorite: p });
                    } else if (d.kind === "bloc_consecutif_matiere") {
                      updateRow(entry.key, { ...d, priorite: p });
                    } else {
                      updateRow(entry.key, { ...d, priorite: p });
                    }
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
                />
              </label>
              <label className="flex items-center gap-2 pb-1.5 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={entry.data.actif}
                  onChange={(e) => {
                    const d = entry.data;
                    if (d.kind === "jours_travail") {
                      updateRow(entry.key, { ...d, actif: e.target.checked });
                    } else if (d.kind === "bloc_consecutif_matiere") {
                      updateRow(entry.key, { ...d, actif: e.target.checked });
                    } else {
                      updateRow(entry.key, { ...d, actif: e.target.checked });
                    }
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

            {entry.data.kind === "jours_travail" ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {JOURS.map((j) => {
                  const d = entry.data;
                  if (d.kind !== "jours_travail") {
                    return null;
                  }
                  const checked = d.joursSemaine.includes(j.value);
                  return (
                    <label
                      key={j.value}
                      className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          toggleJour(entry.key, j.value, e.target.checked)
                        }
                        className="accent-indigo-600"
                      />
                      {j.label}
                    </label>
                  );
                })}
              </div>
            ) : null}

            {entry.data.kind === "bloc_consecutif_matiere" ? (
              <div className="flex flex-wrap gap-3 pt-1">
                <label className="flex min-w-[min(56vw,14rem)] flex-col gap-1">
                  <span className="text-xs font-medium text-slate-600">
                    Matière
                  </span>
                  <select
                    value={entry.data.matiereId}
                    onChange={(e) => {
                      const d = entry.data;
                      if (d.kind !== "bloc_consecutif_matiere") {
                        return;
                      }
                      updateRow(entry.key, {
                        ...d,
                        matiereId: e.target.value,
                      });
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
                  >
                    {matiereChoices.length === 0 ? (
                      <option value="">Cochez des matières ci‑dessus</option>
                    ) : null}
                    {matiereChoices.map((m) => {
                      const dis = isMatiereOptionTakenByOtherRow(
                        rowsForUi,
                        entry.key,
                        "bloc_consecutif_matiere",
                        m.id,
                        matiereIdPourSelect
                      );
                      return (
                        <option key={m.id} value={m.id} disabled={dis}>
                          {m.nom}
                          {dis ? " — déjà utilisé" : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-600">
                    Max. h. consécutives
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_HEURES_CONSECUTIVES}
                    value={entry.data.maxHeuresConsecutives}
                    onChange={(e) => {
                      const d = entry.data;
                      if (d.kind !== "bloc_consecutif_matiere") {
                        return;
                      }
                      const v = Number(e.target.value);
                      updateRow(entry.key, {
                        ...d,
                        maxHeuresConsecutives: Number.isFinite(v)
                          ? Math.trunc(v)
                          : 1,
                      });
                    }}
                    className="w-[min(28vw,5rem)] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
                  />
                </label>
              </div>
            ) : null}

            {entry.data.kind === "volume_jour_matiere" ? (
              <div className="flex flex-wrap gap-3 pt-1">
                <label className="flex min-w-[min(56vw,14rem)] flex-col gap-1">
                  <span className="text-xs font-medium text-slate-600">
                    Matière
                  </span>
                  <select
                    value={entry.data.matiereId}
                    onChange={(e) => {
                      const d = entry.data;
                      if (d.kind !== "volume_jour_matiere") {
                        return;
                      }
                      updateRow(entry.key, {
                        ...d,
                        matiereId: e.target.value,
                      });
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
                  >
                    {matiereChoices.length === 0 ? (
                      <option value="">Cochez des matières ci‑dessus</option>
                    ) : null}
                    {matiereChoices.map((m) => {
                      const dis = isMatiereOptionTakenByOtherRow(
                        rowsForUi,
                        entry.key,
                        "volume_jour_matiere",
                        m.id,
                        matiereIdPourSelect
                      );
                      return (
                        <option key={m.id} value={m.id} disabled={dis}>
                          {m.nom}
                          {dis ? " — déjà utilisé" : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-600">
                    Max. cours / jour
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_COURS_PAR_JOUR}
                    value={entry.data.maxCoursParJour}
                    onChange={(e) => {
                      const d = entry.data;
                      if (d.kind !== "volume_jour_matiere") {
                        return;
                      }
                      const v = Number(e.target.value);
                      updateRow(entry.key, {
                        ...d,
                        maxCoursParJour: Number.isFinite(v)
                          ? Math.trunc(v)
                          : 1,
                      });
                    }}
                    className="w-[min(28vw,5rem)] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
                  />
                </label>
              </div>
            ) : null}
          </div>
          );
        })}
      </div>
      <button
        type="button"
        disabled={
          freezeDuringSubmit ||
          rows.length >= CONTRAINTE_MAX_COUNT ||
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
