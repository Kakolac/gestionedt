"use client";

import { useState } from "react";
import type { SalleKind } from "@/lib/models/Salle";

export type SalleOption = { id: string; nom: string; kind: SalleKind };

function canonId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function stableSalleIdsKey(ids: readonly string[] | undefined): string {
  if (!ids?.length) {
    return "";
  }
  return [...ids]
    .map((id) => canonId(String(id)))
    .filter(Boolean)
    .sort()
    .join(",");
}

function initialPicked(ids: readonly string[] | undefined): Set<string> {
  const s = new Set<string>();
  for (const id of ids ?? []) {
    const c = canonId(String(id));
    if (c) {
      s.add(c);
    }
  }
  return s;
}

function submitValueForCanon(options: SalleOption[], canon: string): string {
  const opt = options.find((o) => canonId(o.id) === canon);
  return opt ? opt.id.trim() : canon;
}

function kindLibelle(kind: SalleKind): string {
  return kind === "specifique" ? "Salle spécifique" : "Classique";
}

type Props = {
  options: SalleOption[];
  defaultSelectedIds?: readonly string[];
  disabled?: boolean;
  freezeDuringSubmit?: boolean;
};

export function MatiereSallesChecklist({
  options,
  defaultSelectedIds,
  disabled,
  freezeDuringSubmit,
}: Props) {
  const [picked, setPicked] = useState(() =>
    initialPicked(defaultSelectedIds)
  );

  return (
    <fieldset
      className="flex flex-col gap-2 text-sm"
      aria-busy={freezeDuringSubmit ? true : undefined}
    >
      <legend className="font-medium text-slate-800">Salles</legend>
      {options.length > 0
        ? Array.from(picked).map((c) => (
            <input
              key={c}
              type="hidden"
              name="salleIds"
              value={submitValueForCanon(options, c)}
            />
          ))
        : null}
      {options.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900">
          Aucune salle dans le référentiel. Créez-en dans « Création salle » avant
          de lier des salles à cette matière.
        </p>
      ) : (
        <div
          className={
            freezeDuringSubmit
              ? "pointer-events-none rounded-xl opacity-60"
              : undefined
          }
        >
          <ul className="max-h-[35vh] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            {options.map((s) => {
              const idCanon = canonId(s.id);
              const checked = picked.has(idCanon);
              return (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-slate-800">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      aria-checked={checked}
                      onChange={(e) => {
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) {
                            next.add(idCanon);
                          } else {
                            next.delete(idCanon);
                          }
                          return next;
                        });
                      }}
                      className="mt-1 accent-indigo-600 disabled:opacity-50"
                    />
                    <span>
                      {s.nom}{" "}
                      <span className="text-xs font-normal text-slate-500">
                        ({kindLibelle(s.kind)})
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Cochez une ou plusieurs salles. Les deux types (classique et spécifique)
        peuvent être combinés si besoin.
      </p>
    </fieldset>
  );
}
