"use client";

import { useCallback, useMemo, useState } from "react";
import {
  FORMATION_CONTRAINTE_KINDS,
  type FormationContrainteWire,
} from "@/lib/formationContraintes.shared";
import { mergeFormationDefaultsWire } from "@/lib/formationContraintes";

const JOURS_CHECK: { value: number; label: string }[] = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

function replaceKind(
  bundle: FormationContrainteWire[],
  next: FormationContrainteWire
): FormationContrainteWire[] {
  return bundle.map((c) => (c.kind === next.kind ? next : c));
}

type VacancePeriode = {
  debut: string;
  fin: string;
  nom: string;
};

type Props = {
  defaultContraintes: FormationContrainteWire[];
  defaultPeriodes?: VacancePeriode[];
  freezeDuringSubmit: boolean;
};

export function FormationContraintesEditor({
  defaultContraintes,
  defaultPeriodes = [],
  freezeDuringSubmit,
}: Props) {
  const [bundle, setBundle] = useState<FormationContrainteWire[]>(() =>
    mergeFormationDefaultsWire(defaultContraintes)
  );

  const [periodes, setPeriodes] = useState<VacancePeriode[]>(defaultPeriodes);
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [periodeEnCours, setPeriodeEnCours] = useState<Partial<VacancePeriode>>({});
  const [indexEdition, setIndexEdition] = useState<number | null>(null);

  const jsonPayload = useMemo(
    () =>
      JSON.stringify(
        FORMATION_CONTRAINTE_KINDS.map((k) => bundle.find((c) => c.kind === k)!)
      ),
    [bundle]
  );

  const periodesJsonPayload = useMemo(() => JSON.stringify(periodes), [periodes]);

  const pause = bundle.find((c): c is Extract<FormationContrainteWire, { kind: "pause_midi" }> => c.kind === "pause_midi");
  const dem = bundle.find(
    (c): c is Extract<FormationContrainteWire, { kind: "heure_demarrage" }> =>
      c.kind === "heure_demarrage"
  );
  const fin = bundle.find(
    (c): c is Extract<FormationContrainteWire, { kind: "heure_fin" }> =>
      c.kind === "heure_fin"
  );
  const jours = bundle.find(
    (c): c is Extract<FormationContrainteWire, { kind: "jours_formation" }> =>
      c.kind === "jours_formation"
  );

  const toggleJour = useCallback((jour: number) => {
    setBundle((prev) => {
      const j = prev.find((c) => c.kind === "jours_formation");
      if (!j || j.kind !== "jours_formation") return prev;
      const set = new Set(j.joursSemaine);
      if (set.has(jour)) {
        if (set.size <= 1) return prev;
        set.delete(jour);
      } else {
        set.add(jour);
      }
      const sorted = [...set].sort((a, b) => a - b);
      return replaceKind(prev, {
        kind: "jours_formation",
        joursSemaine: sorted,
      });
    });
  }, []);

  const ouvrirModaleAjout = useCallback(() => {
    setPeriodeEnCours({});
    setIndexEdition(null);
    setModaleOuverte(true);
  }, []);

  const ouvrirModaleEdition = useCallback((index: number) => {
    setPeriodeEnCours(periodes[index]);
    setIndexEdition(index);
    setModaleOuverte(true);
  }, [periodes]);

  const fermerModale = useCallback(() => {
    setModaleOuverte(false);
    setPeriodeEnCours({});
    setIndexEdition(null);
  }, []);

  const enregistrerPeriode = useCallback(() => {
    const { debut, fin, nom } = periodeEnCours;
    if (!debut || !fin || !nom?.trim()) return;
    if (debut > fin) {
      alert("La date de fin doit être postérieure ou égale à la date de début");
      return;
    }

    const nouvellePeriode: VacancePeriode = {
      debut,
      fin,
      nom: nom.trim(),
    };

    if (indexEdition !== null) {
      setPeriodes((prev) => prev.map((p, i) => (i === indexEdition ? nouvellePeriode : p)));
    } else {
      setPeriodes((prev) => [...prev, nouvellePeriode]);
    }
    fermerModale();
  }, [periodeEnCours, indexEdition, fermerModale]);

  const supprimerPeriode = useCallback((index: number) => {
    if (confirm("Supprimer cette période de vacances ?")) {
      setPeriodes((prev) => prev.filter((_, i) => i !== index));
    }
  }, []);

  const wrapCls = freezeDuringSubmit
    ? "pointer-events-none space-y-[2vh] opacity-60"
    : "space-y-[2vh]";

  return (
    <div
      role="group"
      aria-labelledby="formation-contraintes-editeur-titre"
      className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-[min(4vw,0.875rem)] text-sm"
    >
      <input type="hidden" name="formationContraintesJson" value={jsonPayload} readOnly />
      <input type="hidden" name="datesVacancesJson" value={periodesJsonPayload} readOnly />
      <p
        id="formation-contraintes-editeur-titre"
        className="font-medium text-slate-800"
      >
        Contraintes de planification (formation)
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Quatre réglages <strong className="font-semibold text-slate-700">obligatoires</strong> pour le moteur :
        pause méridienne sans cours, première heure de cours possible, dernière heure de fin possible
        (inclusive), et jours où la formation peut être placée. Pas de mode « souple » : hors contrainte,
        le créneau est refusé.
      </p>

      <div className={wrapCls}>
        {/* 1 — Pause midi */}
        <div className="space-y-2 rounded-xl border border-white/80 bg-white px-3 py-2 shadow-sm">
          <p className="text-xs font-semibold text-slate-700">
            1. Pause du midi (aucun cours pendant cet intervalle — fin exclusive, comme la grille)
          </p>
          {pause ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[0.65rem] font-medium text-slate-600">Début (h)</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  step={1}
                  value={pause.heureDebut}
                  onChange={(e) => {
                    const v = Math.trunc(Number(e.target.value));
                    if (!Number.isFinite(v)) return;
                    setBundle((prev) =>
                      replaceKind(prev, {
                        kind: "pause_midi",
                        heureDebut: v,
                        heureFin: pause.heureFin,
                      })
                    );
                  }}
                  className="max-w-[min(18vw,5rem)] rounded-lg border border-slate-200 px-2 py-1 tabular-nums outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[0.65rem] font-medium text-slate-600">Fin (h)</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  step={1}
                  value={pause.heureFin}
                  onChange={(e) => {
                    const v = Math.trunc(Number(e.target.value));
                    if (!Number.isFinite(v)) return;
                    setBundle((prev) =>
                      replaceKind(prev, {
                        kind: "pause_midi",
                        heureDebut: pause.heureDebut,
                        heureFin: v,
                      })
                    );
                  }}
                  className="max-w-[min(18vw,5rem)] rounded-lg border border-slate-200 px-2 py-1 tabular-nums outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
                />
              </label>
            </div>
          ) : null}
        </div>

        {/* 2 — Heure démarrage */}
        <div className="space-y-2 rounded-xl border border-white/80 bg-white px-3 py-2 shadow-sm">
          <p className="text-xs font-semibold text-slate-700">
            2. Heure de démarrage (première heure possible pour le <em>début</em> d’un cours)
          </p>
          {dem ? (
            <label className="flex flex-col gap-1">
              <span className="text-[0.65rem] font-medium text-slate-600">À partir de (h)</span>
              <input
                type="number"
                min={0}
                max={23}
                step={1}
                value={dem.heureMin}
                onChange={(e) => {
                  const v = Math.trunc(Number(e.target.value));
                  if (!Number.isFinite(v)) return;
                  setBundle((prev) =>
                    replaceKind(prev, { kind: "heure_demarrage", heureMin: v })
                  );
                }}
                className="max-w-[min(18vw,5rem)] rounded-lg border border-slate-200 px-2 py-1 tabular-nums outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>
          ) : null}
        </div>

        {/* 3 — Heure fin */}
        <div className="space-y-2 rounded-xl border border-white/80 bg-white px-3 py-2 shadow-sm">
          <p className="text-xs font-semibold text-slate-700">
            3. Heure de fin (dernière heure de <em>fin</em> de cours autorisée, inclusive)
          </p>
          {fin ? (
            <label className="flex flex-col gap-1">
              <span className="text-[0.65rem] font-medium text-slate-600">Au plus tard (h)</span>
              <input
                type="number"
                min={1}
                max={24}
                step={1}
                value={fin.heureFinMax}
                onChange={(e) => {
                  const v = Math.trunc(Number(e.target.value));
                  if (!Number.isFinite(v)) return;
                  setBundle((prev) =>
                    replaceKind(prev, { kind: "heure_fin", heureFinMax: v })
                  );
                }}
                className="max-w-[min(18vw,5rem)] rounded-lg border border-slate-200 px-2 py-1 tabular-nums outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>
          ) : null}
        </div>

        {/* 4 — Jours */}
        <div className="space-y-2 rounded-xl border border-white/80 bg-white px-3 py-2 shadow-sm">
          <p className="text-xs font-semibold text-slate-700">
            4. Jours de la formation (1 = lundi … 7 = dimanche)
          </p>
          {jours ? (
            <div className="flex flex-wrap gap-x-[min(3vw,0.75rem)] gap-y-2">
              {JOURS_CHECK.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700"
                >
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/40"
                    checked={jours.joursSemaine.includes(value)}
                    onChange={() => toggleJour(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          ) : null}
          <p className="text-[0.65rem] text-slate-500">
            Au moins un jour doit rester coché — la sauvegarde refuse une liste vide.
          </p>
        </div>

        {/* 5 — Périodes de vacances */}
        <div className="space-y-2 rounded-xl border border-white/80 bg-white px-3 py-2 shadow-sm">
          <p className="text-xs font-semibold text-slate-700">
            5. Périodes de vacances (aucun cours ne sera planifié pendant ces périodes)
          </p>
          {periodes.length === 0 ? (
            <p className="text-[0.65rem] text-slate-500">
              Aucune période de vacances définie (optionnel)
            </p>
          ) : (
            <div className="space-y-2">
              {periodes.map((periode, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-1.5"
                >
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-700">{periode.nom}</p>
                    <p className="text-[0.65rem] text-slate-500">
                      du {new Date(periode.debut + "T12:00").toLocaleDateString("fr-FR")} au{" "}
                      {new Date(periode.fin + "T12:00").toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => supprimerPeriode(index)}
                    disabled={freezeDuringSubmit}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Supprimer cette période"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={ouvrirModaleAjout}
            disabled={freezeDuringSubmit}
            className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            + Ajouter une période de vacances
          </button>
        </div>
      </div>

      {/* Modale ajout/édition période */}
      {modaleOuverte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[90vw] max-w-[500px] rounded-2xl bg-white p-[min(5vw,1.5rem)] shadow-xl">
            <h3 className="mb-[2vh] text-base font-semibold text-slate-800">
              {indexEdition !== null ? "Modifier la période" : "Ajouter une période de vacances"}
            </h3>
            <div className="space-y-[2vh]">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Nom de la période</span>
                <input
                  type="text"
                  maxLength={100}
                  value={periodeEnCours.nom ?? ""}
                  onChange={(e) => setPeriodeEnCours((p) => ({ ...p, nom: e.target.value }))}
                  placeholder="Ex: Vacances de Noël 2025"
                  className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Date de début</span>
                <input
                  type="date"
                  value={periodeEnCours.debut ?? ""}
                  onChange={(e) => setPeriodeEnCours((p) => ({ ...p, debut: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Date de fin</span>
                <input
                  type="date"
                  value={periodeEnCours.fin ?? ""}
                  onChange={(e) => setPeriodeEnCours((p) => ({ ...p, fin: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
                />
              </label>
            </div>
            <div className="mt-[3vh] flex gap-2 justify-end">
              <button
                type="button"
                onClick={fermerModale}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={enregistrerPeriode}
                disabled={!periodeEnCours.debut || !periodeEnCours.fin || !periodeEnCours.nom?.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {indexEdition !== null ? "Modifier" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
