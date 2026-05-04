"use client";

import { useMemo, useState } from "react";
import { CreerProfesseurModal } from "@/components/administration/CreerProfesseurModal";
import type { ProfesseurRow } from "@/components/administration/ModifierProfesseurModal";
import { ModifierProfesseurModal } from "@/components/administration/ModifierProfesseurModal";
import type { MatiereOption } from "@/components/administration/ProfesseurMatieresChecklist";
import { SupprimerProfesseurConfirmModal } from "@/components/administration/SupprimerProfesseurConfirmModal";

/** Libellé affiché : « Prénom Nom » avec repli sur le seul nom. */
function libelleProfesseur(row: Pick<ProfesseurRow, "prenom" | "nom">) {
  const p = row.prenom.trim();
  const n = row.nom.trim();
  if (p) {
    return `${p} ${n}`;
  }
  return n;
}

function libelleMatieresAffectees(
  ids: readonly string[],
  nomById: Map<string, string>
): string {
  if (ids.length === 0) {
    return "—";
  }
  const noms: string[] = [];
  let orphan = 0;
  for (const id of ids) {
    const n = nomById.get(id);
    if (n) {
      noms.push(n);
    } else {
      orphan += 1;
    }
  }
  if (noms.length === 0) {
    return orphan > 0 ? `${orphan} réf. invalide(s)` : "—";
  }
  if (orphan > 0) {
    return `${noms.join(", ")} (+${orphan} inval.)`;
  }
  return noms.join(", ");
}

function libelleContraintesActives(row: ProfesseurRow): string {
  const n = row.contraintes.filter((c) => c.actif).length;
  const total = row.contraintes.length;
  if (total === 0) {
    return "—";
  }
  return n === total ? `${n} active(s)` : `${n} active(s) / ${total}`;
}

type Props = {
  rows: ProfesseurRow[];
  matiereOptions: MatiereOption[];
};

export function GestionProfesseursPanel({ rows, matiereOptions }: Props) {
  const nomById = useMemo(
    () => new Map(matiereOptions.map((m) => [m.id, m.nom])),
    [matiereOptions]
  );
  const [createKey, setCreateKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<ProfesseurRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    identiteLabel: string;
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
          Nouveau professeur
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/80 shadow-[0_8px_30px_rgba(49,46,129,0.06)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-4 py-3 font-semibold text-slate-800">Prénom</th>
              <th className="px-4 py-3 font-semibold text-slate-800">Nom</th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Matières
              </th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Contraintes
              </th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Notes
              </th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={6}>
                  Aucun professeur enregistré. Utilisez « Nouveau professeur »
                  pour en ajouter.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-3 text-slate-700">
                    {row.prenom.trim() ? row.prenom : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {row.nom}
                  </td>
                  <td className="max-w-[min(52vw,22rem)] px-4 py-3 text-xs text-slate-600">
                    {libelleMatieresAffectees(row.matiereIds, nomById)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    {libelleContraintesActives(row)}
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
                          setDeleteTarget({
                            id: row.id,
                            identiteLabel: libelleProfesseur(row),
                          })
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

      <CreerProfesseurModal
        key={createKey}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        matiereOptions={matiereOptions}
      />

      <ModifierProfesseurModal
        key={editRow ? `modifier-${editRow.id}` : "modifier-closed"}
        open={editRow != null}
        onClose={() => setEditRow(null)}
        row={editRow}
        matiereOptions={matiereOptions}
      />

      <SupprimerProfesseurConfirmModal
        key={
          deleteTarget ? `supprimer-${deleteTarget.id}` : "supprimer-closed"
        }
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        professeurId={deleteTarget?.id ?? null}
        identiteLabel={deleteTarget?.identiteLabel ?? null}
      />
    </div>
  );
}
