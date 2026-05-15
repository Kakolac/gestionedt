"use client";

import { useState } from "react";
import { importVacancesFranceAction } from "@/app/administration/_actions/importVacancesFrance";
import type { ImportVacancesFranceState } from "@/app/administration/_actions/importVacancesFrance";
import { getAnneesDisponibles } from "@/lib/vacancesFrance";

type Props = {
  onClose: () => void;
};

export function ImporterVacancesFranceModal({ onClose }: Props) {
  const anneesDisponibles = getAnneesDisponibles();
  const anneeParDefaut = anneesDisponibles[1]; // Année courante

  const [anneeSelectionnee, setAnneeSelectionnee] = useState(anneeParDefaut);
  const [enCoursImport, setEnCoursImport] = useState(false);
  const [resultat, setResultat] = useState<ImportVacancesFranceState | null>(null);

  const handleImporter = async () => {
    setEnCoursImport(true);
    setResultat(null);

    try {
      const result = await importVacancesFranceAction(anneeSelectionnee);
      setResultat(result);
      
      if (result.ok) {
        // Fermer la modale après un court délai pour laisser voir le message
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      setResultat({
        ok: false,
        error: `Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      });
    } finally {
      setEnCoursImport(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[90vw] max-w-[600px] rounded-2xl bg-white p-[min(5vw,1.5rem)] shadow-xl">
        <h2 className="mb-[2vh] text-xl font-semibold text-slate-800">
          Importer les vacances scolaires françaises
        </h2>

        <p className="mb-[2vh] text-sm text-slate-600">
          Cette fonctionnalité importe automatiquement toutes les périodes de vacances
          scolaires françaises pour une année donnée, incluant les différentes zones
          académiques (A, B, C, Corse).
        </p>

        <div className="space-y-[2vh]">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Année scolaire
            </label>
            <select
              value={anneeSelectionnee}
              onChange={(e) => setAnneeSelectionnee(e.target.value)}
              disabled={enCoursImport}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-50"
            >
              {anneesDisponibles.map((annee) => (
                <option key={annee} value={annee}>
                  {annee}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Sélectionnez l'année scolaire pour laquelle importer les vacances
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p className="text-sm font-medium text-blue-900 mb-1">
              Source des données
            </p>
            <p className="text-xs text-blue-700">
              API officielle du ministère de l'Éducation nationale (data.education.gouv.fr)
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Les périodes seront créées pour toutes les zones académiques :
              Zone A, Zone B, Zone C et Corse. Les périodes communes (Toussaint, Noël, été)
              seront créées une seule fois.
            </p>
          </div>

          {resultat && (
            <div
              className={`rounded-lg border p-3 ${
                resultat.ok
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  resultat.ok ? "text-green-900" : "text-red-900"
                }`}
              >
                {resultat.ok ? "✓ Import réussi" : "✗ Erreur"}
              </p>
              <p
                className={`text-sm mt-1 ${
                  resultat.ok ? "text-green-700" : "text-red-700"
                }`}
              >
                {resultat.ok ? resultat.message : resultat.error}
              </p>
            </div>
          )}
        </div>

        <div className="mt-[3vh] flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={enCoursImport}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {resultat?.ok ? "Fermer" : "Annuler"}
          </button>
          <button
            type="button"
            onClick={handleImporter}
            disabled={enCoursImport || resultat?.ok}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {enCoursImport ? "Import en cours..." : "Importer"}
          </button>
        </div>

        {enCoursImport && (
          <div className="mt-2 text-center">
            <p className="text-xs text-slate-500">
              Récupération des données depuis l'API... Cela peut prendre quelques secondes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
