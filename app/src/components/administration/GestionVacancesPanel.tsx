"use client";

import { useState } from "react";
import { CreerPeriodeVacancesModal } from "@/components/administration/CreerPeriodeVacancesModal";
import { ModifierPeriodeVacancesModal } from "@/components/administration/ModifierPeriodeVacancesModal";
import { ImporterVacancesFranceModal } from "@/components/administration/ImporterVacancesFranceModal";
import { deletePeriodeVacancesAction } from "@/app/administration/_actions/vacances";

export type PeriodeVacancesRow = {
  id: string;
  nom: string;
  debut: string;
  fin: string;
  description: string;
};

type Props = {
  rows: PeriodeVacancesRow[];
};

export function GestionVacancesPanel({ rows }: Props) {
  const [modaleCreationOuverte, setModaleCreationOuverte] = useState(false);
  const [modaleEditionOuverte, setModaleEditionOuverte] = useState(false);
  const [modaleImportOuverte, setModaleImportOuverte] = useState(false);
  const [periodeEnEdition, setPeriodeEnEdition] = useState<PeriodeVacancesRow | null>(null);
  const [enCoursSuppr, setEnCoursSuppr] = useState(false);

  const ouvrirCreation = () => {
    setModaleCreationOuverte(true);
  };

  const fermerCreation = () => {
    setModaleCreationOuverte(false);
  };

  const ouvrirImport = () => {
    setModaleImportOuverte(true);
  };

  const fermerImport = () => {
    setModaleImportOuverte(false);
  };

  const ouvrirEdition = (periode: PeriodeVacancesRow) => {
    setPeriodeEnEdition(periode);
    setModaleEditionOuverte(true);
  };

  const fermerEdition = () => {
    setModaleEditionOuverte(false);
    setPeriodeEnEdition(null);
  };

  const handleSupprimer = async (id: string, nom: string) => {
    if (!confirm(`Supprimer la période "${nom}" ?\n\nCette action est irréversible.`)) {
      return;
    }
    setEnCoursSuppr(true);
    try {
      const res = await deletePeriodeVacancesAction(id);
      if (!res.ok) {
        alert(`Erreur : ${res.error}`);
      }
    } catch (e) {
      alert(`Erreur lors de la suppression : ${String(e)}`);
    } finally {
      setEnCoursSuppr(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {rows.length === 0
            ? "Aucune période de vacances définie."
            : `${rows.length} période(s) de vacances.`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={ouvrirImport}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Importer vacances françaises
          </button>
          <button
            type="button"
            onClick={ouvrirCreation}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Nouvelle période
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">
                  Nom
                </th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">
                  Date de début
                </th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">
                  Date de fin
                </th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">
                  Description
                </th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">
                    {row.nom}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(row.debut + "T12:00").toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(row.fin + "T12:00").toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {row.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <button
                      type="button"
                      onClick={() => ouvrirEdition(row)}
                      className="mr-2 font-medium text-indigo-600 hover:underline"
                      disabled={enCoursSuppr}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSupprimer(row.id, row.nom)}
                      className="font-medium text-red-600 hover:underline disabled:opacity-50"
                      disabled={enCoursSuppr}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modaleCreationOuverte && (
        <CreerPeriodeVacancesModal onClose={fermerCreation} />
      )}

      {modaleEditionOuverte && periodeEnEdition && (
        <ModifierPeriodeVacancesModal
          periode={periodeEnEdition}
          onClose={fermerEdition}
        />
      )}

      {modaleImportOuverte && (
        <ImporterVacancesFranceModal onClose={fermerImport} />
      )}
    </div>
  );
}
