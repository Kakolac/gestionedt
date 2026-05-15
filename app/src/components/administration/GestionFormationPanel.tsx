"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CreerFormationModal,
  type MatiereOptionCourte,
  type DraftLigne,
} from "@/components/administration/CreerFormationModal";
import type { FormationRow } from "@/components/administration/ModifierFormationModal";
import { ModifierFormationModal } from "@/components/administration/ModifierFormationModal";
import type { ProfesseurOption } from "@/components/administration/FormationProfesseursChecklist";
import { SupprimerFormationConfirmModal } from "@/components/administration/SupprimerFormationConfirmModal";
import { formatFormationContraintesListeCourte } from "@/lib/formationContraintes";
import { libellePaysLocalisationAdmin } from "@/lib/planning/planning-public-holidays";
import type { PeriodeVacancesOption } from "@/app/administration/creation-formation/page";

type Props = {
  rows: FormationRow[];
  matiereDisponiblesPourCreation: MatiereOptionCourte[];
  toutesLesMatieres: MatiereOptionCourte[];
  professeurOptions: ProfesseurOption[];
  periodeVacancesOptions: PeriodeVacancesOption[];
};

function rowVersDraftsForDuplicate(row: FormationRow): DraftLigne[] {
  return row.lignesListe.map((ligne, idx) => ({
    clientKey: `duplicate-${row.id}-${idx}-${ligne.matiereId}`,
    kind: "existing" as const,
    matiereId: ligne.matiereId,
    matiereNom: ligne.matiereNom,
    professeurIds: [...ligne.professeurIds],
    nombreHeuresPrevues: ligne.nombreHeuresPrevues,
  }));
}

export function GestionFormationPanel({
  rows,
  matiereDisponiblesPourCreation,
  toutesLesMatieres,
  professeurOptions,
  periodeVacancesOptions,
}: Props) {
  const router = useRouter();
  const [createKey, setCreateKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateRow, setDuplicateRow] = useState<FormationRow | null>(null);
  const [duplicateKey, setDuplicateKey] = useState(0);
  const [editRow, setEditRow] = useState<FormationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    formationLabel: string;
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
          Nouvelle formation
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/80 shadow-[0_8px_30px_rgba(49,46,129,0.06)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-4 py-3 font-semibold text-slate-800">Nom</th>
              <th className="min-w-[7rem] px-4 py-3 font-semibold text-slate-800">
                Début
              </th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Description
              </th>
              <th className="min-w-[8rem] px-4 py-3 font-semibold text-slate-800">
                Matières
              </th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Professeurs
              </th>
              <th className="px-4 py-3 font-semibold text-slate-800">Heures</th>
              <th className="min-w-[6rem] px-4 py-3 font-semibold text-slate-800">
                Loc. fériés
              </th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Planning formation
              </th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={9}>
                  Aucune formation. Utilisez « Nouvelle formation » pour définir un
                  regroupement (nom, description, matières avec heures prévues par matière,
                  intervenants).
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
                  <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-slate-700">
                    {row.dateDemarrageIso?.trim() ? row.dateDemarrageIso.trim() : "—"}
                  </td>
                  <td className="max-w-[min(40vw,14rem)] px-4 py-3 text-xs leading-snug text-slate-600">
                    <span className="line-clamp-3">{row.description || "—"}</span>
                  </td>
                  <td className="max-w-[min(52vw,20rem)] px-4 py-3 text-xs text-slate-600">
                    <span className="line-clamp-2">{row.matieresLabel}</span>
                    {row.lignesListe.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 border-t border-slate-100 pt-1 text-[0.65rem] leading-snug text-slate-500">
                        {row.lignesListe.map((l) => (
                          <li key={l.matiereId}>
                            {l.matiereNom}
                            <span className="tabular-nums text-slate-600">
                              {" "}
                              — {l.nombreHeuresPrevues} h
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td className="max-w-[min(40vw,16rem)] px-4 py-3 text-xs text-slate-600">
                    <span className="line-clamp-2">{row.professeursLabel}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-800">
                    {row.nombreHeures}
                    <span className="mt-0.5 block text-[0.65rem] font-normal text-slate-500">
                      total
                    </span>
                  </td>
                  <td className="max-w-[min(28vw,10rem)] px-4 py-3 text-[0.65rem] leading-snug text-slate-600">
                    <span className="line-clamp-2">
                      {!row.localisationPays?.trim()
                        ? "—"
                        : `${libellePaysLocalisationAdmin(row.localisationPays)}${
                            row.localisationRegion?.trim()
                              ? ` · ${row.localisationRegion.trim()}`
                              : ""
                          }`}
                    </span>
                  </td>
                  <td className="max-w-[min(56vw,22rem)] px-4 py-3 text-[0.65rem] leading-snug text-slate-600">
                    <span className="line-clamp-3">
                      {formatFormationContraintesListeCourte(row.contraintes)}
                    </span>
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
                        className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                        onClick={() => {
                          setDuplicateKey((k) => k + 1);
                          setDuplicateRow(row);
                        }}
                      >
                        Dupliquer
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        onClick={() =>
                          setDeleteTarget({
                            id: row.id,
                            formationLabel: row.nom,
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

      <CreerFormationModal
        key={createKey}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateKey((k) => k + 1);
          setCreateOpen(false);
          router.refresh();
        }}
        matiereDisponibles={matiereDisponiblesPourCreation}
        professeurOptions={professeurOptions}
        periodeVacancesOptions={periodeVacancesOptions}
      />

      <CreerFormationModal
        key={`duplicate-${duplicateKey}`}
        open={duplicateRow !== null}
        onClose={() => setDuplicateRow(null)}
        onSuccess={() => {
          setDuplicateKey((k) => k + 1);
          setDuplicateRow(null);
          router.refresh();
        }}
        matiereDisponibles={toutesLesMatieres}
        professeurOptions={professeurOptions}
        periodeVacancesOptions={periodeVacancesOptions}
        initialNom={duplicateRow ? `Copie de ${duplicateRow.nom}` : undefined}
        initialDescription={duplicateRow?.description}
        initialLignes={duplicateRow ? rowVersDraftsForDuplicate(duplicateRow) : undefined}
        initialContraintes={duplicateRow?.contraintes}
        initialLocalisationPays={duplicateRow?.localisationPays}
        initialLocalisationRegion={duplicateRow?.localisationRegion}
        initialDateDemarrage={duplicateRow?.dateDemarrageIso}
        initialDatesVacances={duplicateRow?.datesVacances}
        initialPeriodeVacancesIds={duplicateRow?.periodeVacancesIds}
      />

      <ModifierFormationModal
        key={editRow ? `modifier-${editRow.id}` : "modifier-closed"}
        open={editRow != null}
        onClose={() => setEditRow(null)}
        row={editRow}
        toutesLesMatieres={toutesLesMatieres}
        professeurOptions={professeurOptions}
        periodeVacancesOptions={periodeVacancesOptions}
      />

      <SupprimerFormationConfirmModal
        key={
          deleteTarget
            ? `supprimer-${deleteTarget.id}`
            : "supprimer-closed"
        }
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        formationId={deleteTarget?.id ?? null}
        formationLabel={deleteTarget?.formationLabel ?? null}
      />
    </div>
  );
}
