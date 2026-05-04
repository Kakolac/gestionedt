"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { MatiereOptionCourte } from "@/components/administration/CreerContenuPedagogiqueModal";
import type { ProfesseurOption } from "@/components/administration/ContenuPedagogiqueProfesseursChecklist";
import { ContenuPedagogiqueProfesseursChecklist } from "@/components/administration/ContenuPedagogiqueProfesseursChecklist";

export type AjouterLigneContenuResult =
  | {
      mode: "existing";
      matiereId: string;
      matiereNom: string;
      professeurIds: string[];
      nombreHeuresPrevues: number;
    }
  | {
      mode: "new";
      nouveauNom: string;
      nouveauDescription: string;
      professeurIds: string[];
      nombreHeuresPrevues: number;
    };

type Props = {
  open: boolean;
  onClose: () => void;
  matieresSansFiche: MatiereOptionCourte[];
  professeurOptions: ProfesseurOption[];
  onAjouter: (r: AjouterLigneContenuResult) => void;
  matiereIdsDejaDansDraft: readonly string[];
};

const CHECKBOX_PROF = "professeurIdsDraftLigne";

export function AjouterLigneContenuPedagogiqueModal({
  open,
  onClose,
  matieresSansFiche,
  professeurOptions,
  onAjouter,
  matiereIdsDejaDansDraft,
}: Props) {
  const profRootRef = useRef<HTMLDivElement>(null);
  const [creationMode, setCreationMode] = useState<"existing" | "new">("existing");
  const [selectedMatiereId, setSelectedMatiereId] = useState("");
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveauDesc, setNouveauDesc] = useState("");
  const [heuresPrevues, setHeuresPrevues] = useState<string>("0");
  const [checklistBump, setChecklistBump] = useState(0);

  const matieresListe = useMemo(() => {
    const pris = new Set(matiereIdsDejaDansDraft.map((x) => x.trim()));
    return matieresSansFiche.filter((m) => !pris.has(m.id));
  }, [matieresSansFiche, matiereIdsDejaDansDraft]);

  const filteredProfesseurOptions = useMemo(() => {
    if (creationMode === "new") {
      if (!nouveauNom.trim()) return [];
      return professeurOptions;
    }
    if (!selectedMatiereId.trim()) return [];
    return professeurOptions.filter((p) =>
      (p.matiereIds ?? []).includes(selectedMatiereId.trim())
    );
  }, [creationMode, selectedMatiereId, nouveauNom, professeurOptions]);

  const peutAfficherListeProf =
    creationMode === "existing"
      ? !!selectedMatiereId.trim()
      : nouveauNom.trim().length > 0;

  function collectProfsDraft(): string[] {
    const root = profRootRef.current;
    if (!root) return [];
    const els = root.querySelectorAll(
      `input[type="checkbox"][name="${CHECKBOX_PROF}"]:checked`
    );
    const out: string[] = [];
    const seen = new Set<string>();
    for (const el of els) {
      const input = el as HTMLInputElement;
      const id = input.value.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  function resetChampsSansFermer(): void {
    setCreationMode("existing");
    setSelectedMatiereId("");
    setNouveauNom("");
    setNouveauDesc("");
    setHeuresPrevues("0");
    setChecklistBump((x) => x + 1);
  }

  function fermerSansResetParent(): void {
    resetChampsSansFermer();
    onClose();
  }

  if (!open) {
    return null;
  }

  const sansMatiereExistante = matieresListe.length === 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-[2vw]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) fermerSansResetParent();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ajouter-ligne-contenu-titre"
        className="max-h-[90vh] w-full max-w-[min(94vw,32rem)] overflow-y-auto rounded-2xl border border-white/70 bg-white p-[min(5vw,1.25rem)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3
          id="ajouter-ligne-contenu-titre"
          className="text-base font-semibold text-slate-900"
        >
          Ajouter une matière au contenu
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Comme précédemment : matière déjà créée ou nouvelle matière pour cette ligne,
          puis le ou les professeurs qui interviennent sur{" "}
          <strong>cette</strong> matière dans ce regroupement.
        </p>

        <div className="mt-[2vh] grid grid-cols-1 gap-[1.25vh] min-[480px]:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setCreationMode("existing");
              setSelectedMatiereId("");
              setChecklistBump((x) => x + 1);
            }}
            className={`min-h-[11vh] rounded-2xl border-2 px-[3vw] py-[1.5vh] text-left text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500/35 ${
              creationMode === "existing"
                ? "border-indigo-500 bg-indigo-50/90 text-indigo-950"
                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span className="block font-semibold">Matière existante</span>
            <span className="mt-1 block text-xs leading-snug text-slate-600">
              Liste des matières encore libres. Professeurs filtrés selon cette
              matière.
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCreationMode("new");
              setSelectedMatiereId("");
              setChecklistBump((x) => x + 1);
            }}
            className={`min-h-[11vh] rounded-2xl border-2 px-[3vw] py-[1.5vh] text-left text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500/35 ${
              creationMode === "new"
                ? "border-fuchsia-500 bg-fuchsia-50/90 text-fuchsia-950"
                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span className="block font-semibold">Nouvelle matière</span>
            <span className="mt-1 block text-xs leading-snug text-slate-600">
              Elle sera créée à l&apos;enregistrement du contenu avec les autres lignes.
            </span>
          </button>
        </div>

        {creationMode === "existing" ? (
          <label className="mt-[2vh] flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Matière</span>
            <select
              value={selectedMatiereId}
              onChange={(e) => {
                setSelectedMatiereId(e.target.value);
                setChecklistBump((x) => x + 1);
              }}
              disabled={sansMatiereExistante}
              className="min-h-[2.75rem] rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            >
              <option value="">— Choisissez —</option>
              {matieresListe.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom}
                </option>
              ))}
            </select>
            {sansMatiereExistante ? (
              <span className="text-xs text-amber-700">
                Aucune matière disponible ici ou toutes sont déjà dans votre brouillon.
              </span>
            ) : null}
          </label>
        ) : (
          <div className="mt-[2vh] flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-[min(4vw,0.875rem)]">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-800">Nom</span>
              <input
                type="text"
                value={nouveauNom}
                maxLength={200}
                onChange={(e) => {
                  setNouveauNom(e.target.value);
                  setChecklistBump((x) => x + 1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-800">Description (optionnel)</span>
              <textarea
                value={nouveauDesc}
                maxLength={2000}
                rows={2}
                onChange={(e) => setNouveauDesc(e.target.value)}
                className="resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
              />
            </label>
          </div>
        )}

        <label className="mt-[2vh] flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-800">Heures prévues pour cette matière</span>
          <input
            type="number"
            min={0}
            step={1}
            value={heuresPrevues}
            onChange={(e) => setHeuresPrevues(e.target.value)}
            className="max-w-[12rem] rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"
          />
        </label>

        {!peutAfficherListeProf ? (
          <p className="mt-[2vh] rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs text-slate-600">
            {creationMode === "existing"
              ? "Choisissez une matière pour afficher les professeurs correspondants."
              : "Indiquez le nom de la nouvelle matière pour afficher les professeurs."}
          </p>
        ) : (
          <div ref={profRootRef} className="mt-[2vh]">
            <ContenuPedagogiqueProfesseursChecklist
              key={`${creationMode}-${selectedMatiereId}-${nouveauNom.slice(0, 12)}-${checklistBump}`}
              checkboxName={CHECKBOX_PROF}
              options={filteredProfesseurOptions}
              emptyState={
                creationMode === "existing" &&
                selectedMatiereId.trim() !== "" &&
                filteredProfesseurOptions.length === 0 ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900">
                    Aucun professeur avec cette matière.{" "}
                    <Link
                      href="/administration/creation-professeur"
                      className="font-medium text-indigo-700 underline-offset-4 hover:underline"
                    >
                      Complétez les fiches
                    </Link>{" "}
                    ou ajoutez la ligne sans professeurs.
                  </p>
                ) : undefined
              }
            />
          </div>
        )}

        <div className="mt-[2vh] flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-fuchsia-500"
            onClick={() => {
              const picks = peutAfficherListeProf ? collectProfsDraft() : [];
              const nhRaw = heuresPrevues.trim();
              const nh = nhRaw === "" ? 0 : Math.round(Number(nhRaw));
              if (!Number.isFinite(nh) || nh < 0) return;
              if (creationMode === "existing") {
                if (!selectedMatiereId.trim() || sansMatiereExistante) return;
                const nom =
                  matieresListe.find((m) => m.id === selectedMatiereId.trim())?.nom ?? "";
                if (!nom) return;
                onAjouter({
                  mode: "existing",
                  matiereId: selectedMatiereId.trim(),
                  matiereNom: nom,
                  professeurIds: picks,
                  nombreHeuresPrevues: nh,
                });
              } else {
                const n = nouveauNom.trim();
                if (!n) return;
                onAjouter({
                  mode: "new",
                  nouveauNom: n.slice(0, 200),
                  nouveauDescription: nouveauDesc.trim().slice(0, 2000),
                  professeurIds: picks,
                  nombreHeuresPrevues: nh,
                });
              }
              resetChampsSansFermer();
              onClose();
            }}
          >
            Ajouter
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={fermerSansResetParent}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
