"use client";

import { useEffect, useState } from "react";

export type MatiereOption = { id: string; nom: string };

/** Compare les ObjectId sérialisés en ignorant casse / espaces. */
function canonId(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Clé stable pour `key` React quand la liste d’ids affichée côté édition change. */
export function stableMatiereIdsKey(ids: readonly string[] | undefined): string {
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

/** Valeur `ObjectId` à poster (casse d’origine), pour les champs hidden. */
function submitValueForCanon(
  options: MatiereOption[],
  canon: string
): string {
  const opt = options.find((o) => canonId(o.id) === canon);
  return opt ? opt.id.trim() : canon;
}

type Props = {
  options: MatiereOption[];
  /** Identifiants cochés par défaut (ex. à l’édition). */
  defaultSelectedIds?: readonly string[];
  disabled?: boolean;
  /**
   * Pendant l’envoi du formulaire : bloque les clics sans `disabled` HTML.
   * Les cases désactivées ne sont pas envoyées dans le FormData — ce mode évite
   * de perdre les matières cochées quand `pending` passe à true au submit.
   */
  freezeDuringSubmit?: boolean;
  /**
   * Appelé à chaque changement de sélection (ids MongoDB tels que dans `options`).
   * Préférer une fonction stable (`useCallback`) pour éviter des boucles d’effets.
   */
  onPickedChange?: (matiereIds: string[]) => void;
};

export function ProfesseurMatieresChecklist({
  options,
  defaultSelectedIds,
  disabled,
  freezeDuringSubmit,
  onPickedChange,
}: Props) {
  const [picked, setPicked] = useState(() =>
    initialPicked(defaultSelectedIds)
  );

  useEffect(() => {
    if (!onPickedChange) {
      return;
    }
    const ids = Array.from(picked).map((c) => submitValueForCanon(options, c));
    onPickedChange(ids);
  }, [picked, options, onPickedChange]);

  return (
    <fieldset
      className="flex flex-col gap-2 text-sm"
      aria-busy={freezeDuringSubmit ? true : undefined}
    >
      <legend className="font-medium text-slate-800">Matières</legend>
      {/*
        React 19 + <form action={serverAction}> réinitialise ou altere souvent les
        champs contrôlés au submit : les cases avec name="matiereIds" peuvent ne
        pas figurer dans le FormData. Les hidden reflètent fidèlement l’état React.
      */}
      {options.length > 0
        ? Array.from(picked).map((c) => (
            <input
              key={c}
              type="hidden"
              name="matiereIds"
              value={submitValueForCanon(options, c)}
            />
          ))
        : null}
      {options.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900">
          Aucune matière dans le référentiel. Créez-en dans « Création matière »
          avant d’affecter un professeur.
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
            {options.map((m) => {
              const idCanon = canonId(m.id);
              const checked = picked.has(idCanon);
              return (
                <li key={m.id}>
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
                    <span>{m.nom}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Sélection facultative ; un même professeur peut enseigner plusieurs
        matières.
      </p>
    </fieldset>
  );
}
