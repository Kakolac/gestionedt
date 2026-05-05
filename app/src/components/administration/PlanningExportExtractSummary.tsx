"use client";

import { useMemo } from "react";
import { summarizePlanningExportRaw } from "@/lib/planning/planning-export-summary";
import type { PlanningExportRaw } from "@/lib/planning/planning.types";

function idTail(id: string): string {
  const t = id.trim();
  if (t.length <= 14) return t;
  return `${t.slice(0, 6)}…${t.slice(-6)}`;
}

type Props = {
  raw: PlanningExportRaw;
};

/**
 * Affiche le récapitulatif des données brutes issues du snapshot MongoDB (avant normalisation / grille).
 */
export function PlanningExportExtractSummary({ raw }: Props) {
  const s = useMemo(() => summarizePlanningExportRaw(raw), [raw]);

  return (
    <section
      aria-labelledby="planning-extrait-base-titre"
      className="w-full max-w-[min(96vw,72rem)] rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/40 px-[3vw] py-[2vh] text-slate-900 shadow-[0_8px_28px_rgba(6,95,70,0.08)]"
    >
      <h2
        id="planning-extrait-base-titre"
        className="text-[clamp(1rem,1.6vw,1.15rem)] font-semibold text-emerald-950"
      >
        Données extraites de la base
      </h2>
      <p className="mt-[1vh] text-[clamp(0.8rem,1.15vw,0.95rem)] leading-relaxed text-emerald-900/85">
        Voici le contenu du snapshot chargé (formations sélectionnées + matières et professeurs
        référencés dans les lignes). La grille ci‑dessous en déduit les séances puis les place ;
        si vous attendez plus de lignes, vérifiez les documents formation dans MongoDB.
      </p>

      <dl className="mt-[1.5vh] flex flex-wrap gap-x-[4vw] gap-y-[1vh] text-[clamp(0.78rem,1.1vw,0.9rem)]">
        <div>
          <dt className="font-medium text-emerald-800">Exporté le</dt>
          <dd className="text-slate-700">{s.exportedAt ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-emerald-800">Formations (documents)</dt>
          <dd className="text-slate-700">{s.counts.formations}</dd>
        </div>
        <div>
          <dt className="font-medium text-emerald-800">Matières (réf.)</dt>
          <dd className="text-slate-700">{s.counts.matieres}</dd>
        </div>
        <div>
          <dt className="font-medium text-emerald-800">Professeurs (réf.)</dt>
          <dd className="text-slate-700">{s.counts.professeurs}</dd>
        </div>
        <div>
          <dt className="font-medium text-emerald-800">Lignes (total)</dt>
          <dd className="text-slate-700">{s.counts.lignesTotal}</dd>
        </div>
        <div>
          <dt className="font-medium text-emerald-800">Heures prévues (somme lignes)</dt>
          <dd className="text-slate-700">{s.counts.sommeHeuresPrevues} h</dd>
        </div>
      </dl>

      {s.formationIdsRequested.length > 0 ? (
        <p className="mt-[1.25vh] text-[clamp(0.72rem,1vw,0.82rem)] text-slate-600">
          <span className="font-medium text-slate-700">IDs demandés : </span>
          {s.formationIdsRequested.map(idTail).join(", ")}
        </p>
      ) : null}

      <div className="mt-[2vh] max-h-[min(45vh,28rem)] space-y-[1.5vh] overflow-y-auto pr-1">
        {s.formations.map((f) => (
          <article
            key={f.id}
            className="rounded-xl border border-emerald-100/90 bg-white/90 px-[2.5vw] py-[1.5vh] shadow-sm"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-emerald-100/80 pb-[1vh]">
              <h3 className="text-[clamp(0.88rem,1.25vw,1rem)] font-semibold text-emerald-950">
                {f.nom}
              </h3>
              <span className="font-mono text-[clamp(0.68rem,1vw,0.78rem)] text-slate-500">
                {idTail(f.id)}
              </span>
            </header>
            <p className="mt-[1vh] text-[clamp(0.72rem,1vw,0.82rem)] text-slate-600">
              Somme des lignes :{" "}
              <strong className="text-slate-800">{f.sommeHeuresLignes} h</strong>
              {f.nombreHeuresFormation != null ? (
                <>
                  {" "}
                  · Champ <code className="rounded bg-slate-100 px-1">nombreHeures</code>{" "}
                  : {f.nombreHeuresFormation} h
                </>
              ) : null}
            </p>
            <ul className="mt-[1vh] list-none space-y-[0.75vh]">
              {f.lignes.map((ligne, i) => (
                <li
                  key={`${f.id}-${ligne.matiereId}-${i}`}
                  className="rounded-lg bg-emerald-50/50 px-[2vw] py-[1vh] text-[clamp(0.78rem,1.05vw,0.88rem)] leading-snug text-slate-800"
                >
                  <span className="font-medium text-emerald-900">{ligne.matiereNom}</span>
                  {" · "}
                  <span>{ligne.nombreHeuresPrevues} h prévues</span>
                  {" · "}
                  <span className="text-slate-600">
                    {ligne.professeurLabels.length > 0
                      ? ligne.professeurLabels.join(", ")
                      : "Aucun professeur sur la ligne — ignoré par le planning"}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {s.notes.length > 0 ? (
        <ul
          role="status"
          className="mt-[1.5vh] list-disc space-y-1 rounded-xl border border-amber-200 bg-amber-50/90 px-[3vw] py-[1.25vh] text-[clamp(0.75rem,1.05vw,0.88rem)] text-amber-950"
        >
          {s.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      ) : null}

      <details className="mt-[1.5vh] rounded-xl border border-slate-200 bg-slate-50/80 px-[2vw] py-[1vh]">
        <summary className="cursor-pointer text-[clamp(0.78rem,1.05vw,0.88rem)] font-medium text-slate-700">
          JSON brut (extrait) — afficher
        </summary>
        <pre className="mt-[1vh] max-h-[min(35vh,20rem)] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-[1.5vw] text-[clamp(0.65rem,0.95vw,0.78rem)] leading-relaxed text-sky-100/95">
          {JSON.stringify(raw, null, 2)}
        </pre>
      </details>
    </section>
  );
}
