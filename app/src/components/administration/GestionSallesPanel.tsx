"use client";

import { useState } from "react";
import { CreerSalleModal } from "@/components/administration/CreerSalleModal";
import type { SalleRow } from "@/components/administration/ModifierSalleModal";
import { ModifierSalleModal } from "@/components/administration/ModifierSalleModal";
import { SupprimerSalleConfirmModal } from "@/components/administration/SupprimerSalleConfirmModal";

function kindLabel(kind: SalleRow["kind"]): string {
  return kind === "specifique" ? "Salle spécifique" : "Classique";
}

type Props = {
  rows: SalleRow[];
};

export function GestionSallesPanel({ rows }: Props) {
  const [createKey, setCreateKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<SalleRow | null>(null);
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
          Nouvelle salle
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/80 shadow-[0_8px_30px_rgba(49,46,129,0.06)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-4 py-3 font-semibold text-slate-800">Nom</th>
              <th className="px-4 py-3 font-semibold text-slate-800">Type</th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Description
              </th>
              <th className="px-4 py-3 font-semibold text-slate-800">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  Aucune salle enregistrée. Utilisez « Nouvelle salle » pour en
                  ajouter.
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
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                    {kindLabel(row.kind)}
                  </td>
                  <td className="max-w-[min(48vw,20rem)] px-4 py-3 text-xs text-slate-600">
                    {row.description ? row.description : "—"}
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

      <CreerSalleModal
        key={createKey}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ModifierSalleModal
        key={editRow ? `modifier-${editRow.id}` : "modifier-closed"}
        open={editRow != null}
        onClose={() => setEditRow(null)}
        row={editRow}
      />

      <SupprimerSalleConfirmModal
        key={
          deleteTarget ? `supprimer-${deleteTarget.id}` : "supprimer-closed"
        }
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        salleId={deleteTarget?.id ?? null}
        nomLabel={deleteTarget?.nom ?? null}
      />
    </div>
  );
}
