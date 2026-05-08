"use client";

import { useMemo, useState } from "react";
import { CreerMatiereModal } from "@/components/administration/CreerMatiereModal";
import type { MatiereRow } from "@/components/administration/ModifierMatiereModal";
import { ModifierMatiereModal } from "@/components/administration/ModifierMatiereModal";
import {
  stableSalleIdsKey,
  type SalleOption,
} from "@/components/administration/MatiereSallesChecklist";
import { SupprimerMatiereConfirmModal } from "@/components/administration/SupprimerMatiereConfirmModal";

function resumeColonnesSalles(
  row: MatiereRow,
  nomById: Map<string, string>
): string {
  if (row.salleMode !== "liste" || !row.salleIds?.length) {
    return "Classique";
  }
  const noms = row.salleIds
    .map((id) => nomById.get(id.trim()))
    .filter(Boolean) as string[];
  if (noms.length === 0) {
    return `${row.salleIds.length} salle(s)`;
  }
  const joined = noms.join(", ");
  return joined.length > 56 ? `${noms.length} salle(s)` : joined;
}

function libelleContraintesActives(row: MatiereRow): string {
  const n = row.contraintes.filter((c) => c.actif).length;
  const total = row.contraintes.length;
  if (total === 0) {
    return "—";
  }
  return n === total ? `${n} active(s)` : `${n} active(s) / ${total}`;
}

type Props = {
  rows: MatiereRow[];
  salleOptions: SalleOption[];
};

export function GestionMatieresPanel({ rows, salleOptions }: Props) {
  const nomSalleParId = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of salleOptions) {
      m.set(o.id.trim(), o.nom);
    }
    return m;
  }, [salleOptions]);

  const [createKey, setCreateKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<MatiereRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    nom: string;
  } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-fuchsia-500"
          onClick={() => {
            setCreateKey((k) => k + 1);
            setCreateOpen(true);
          }}
        >
          Nouvelle matière
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/80 shadow-[0_8px_30px_rgba(49,46,129,0.06)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-4 py-3 font-semibold text-slate-800">Nom</th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Description
              </th>
              <th className="px-4 py-3 font-semibold text-slate-800">Salles</th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Contraintes
              </th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  Aucune matière enregistrée. Utilisez « Nouvelle matière » pour
                  en ajouter.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {row.nom}
                  </td>
                  <td className="max-w-[min(48vw,20rem)] px-4 py-3 text-xs text-slate-600">
                    {row.description ? row.description : "—"}
                  </td>
                  <td className="max-w-[min(42vw,16rem)] px-4 py-3 text-xs text-slate-700">
                    {resumeColonnesSalles(row, nomSalleParId)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                    {libelleContraintesActives(row)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-slate-50"
                        onClick={() => setEditRow(row)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        onClick={() =>
                          setDeleteTarget({ id: row.id, nom: row.nom })
                        }
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreerMatiereModal
        key={createKey}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        salleOptions={salleOptions}
      />

      <ModifierMatiereModal
        key={
          editRow
            ? `modifier-${editRow.id}-${editRow.salleMode}-${stableSalleIdsKey(editRow.salleIds)}-${JSON.stringify(editRow.contraintes)}`
            : "modifier-closed"
        }
        open={editRow != null}
        onClose={() => setEditRow(null)}
        row={editRow}
        salleOptions={salleOptions}
      />

      <SupprimerMatiereConfirmModal
        key={
          deleteTarget ? `supprimer-${deleteTarget.id}` : "supprimer-closed"
        }
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        matiereId={deleteTarget?.id ?? null}
        nomLabel={deleteTarget?.nom ?? null}
      />
    </div>
  );
}
