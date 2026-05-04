"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  updateContenuPedagogiqueAction,
  type ContenuPedagogiqueActionState,
} from "@/app/administration/_actions/contenuPedagogique";
import {
  AjouterLigneContenuPedagogiqueModal,
  type AjouterLigneContenuResult,
} from "@/components/administration/AjouterLigneContenuPedagogiqueModal";
import type { MatiereOptionCourte } from "@/components/administration/CreerContenuPedagogiqueModal";
import type { ProfesseurOption } from "@/components/administration/ContenuPedagogiqueProfesseursChecklist";

export type ContenuPedagogiqueLigneListe = {
  matiereId: string;
  matiereNom: string;
  professeurIds: string[];
  professeursLabel: string;
  nombreHeuresPrevues: number;
};

export type ContenuPedagogiqueRow = {
  id: string;
  nom: string;
  description: string;
  matiereIds: string[];
  matieresLabel: string;
  lignesListe: ContenuPedagogiqueLigneListe[];
  professeurIds: string[];
  professeursLabel: string;
  nombreHeures: number;
};

type DraftLigne =
  | {
      clientKey: string;
      kind: "existing";
      matiereId: string;
      matiereNom: string;
      professeurIds: string[];
      nombreHeuresPrevues: number;
    }
  | {
      clientKey: string;
      kind: "nouveau";
      nouveauNom: string;
      nouveauDescription: string;
      professeurIds: string[];
      nombreHeuresPrevues: number;
    };

function rowVersDrafts(row: ContenuPedagogiqueRow): DraftLigne[] {
  return row.lignesListe.map((ligne, idx) => ({
    clientKey: `init-${row.id}-${idx}-${ligne.matiereId}`,
    kind: "existing",
    matiereId: ligne.matiereId,
    matiereNom: ligne.matiereNom,
    professeurIds: [...ligne.professeurIds],
    nombreHeuresPrevues: ligne.nombreHeuresPrevues,
  }));
}

function draftVersPayloadJson(drafts: DraftLigne[]): string {
  const payload = drafts.map((d) => {
    if (d.kind === "existing") {
      return {
        existingMatiereId: d.matiereId,
        professeurIds: d.professeurIds,
        nombreHeuresPrevues: d.nombreHeuresPrevues,
      };
    }
    return {
      nouveauNom: d.nouveauNom,
      nouveauDescription: d.nouveauDescription,
      professeurIds: d.professeurIds,
      nombreHeuresPrevues: d.nombreHeuresPrevues,
    };
  });
  return JSON.stringify(payload);
}

function resultVersDraft(r: AjouterLigneContenuResult, key: string): DraftLigne {
  if (r.mode === "existing") {
    return {
      clientKey: key,
      kind: "existing",
      matiereId: r.matiereId,
      matiereNom: r.matiereNom,
      professeurIds: r.professeurIds,
      nombreHeuresPrevues: r.nombreHeuresPrevues,
    };
  }
  return {
    clientKey: key,
    kind: "nouveau",
    nouveauNom: r.nouveauNom,
    nouveauDescription: r.nouveauDescription,
    professeurIds: r.professeurIds,
    nombreHeuresPrevues: r.nombreHeuresPrevues,
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  row: ContenuPedagogiqueRow | null;
  toutesLesMatieres: MatiereOptionCourte[];
  matiereIdsReserveesAilleurs: string[];
  professeurOptions: ProfesseurOption[];
};

const initial: ContenuPedagogiqueActionState | undefined = undefined;

export function ModifierContenuPedagogiqueModal({
  open,
  onClose,
  row,
  toutesLesMatieres,
  matiereIdsReserveesAilleurs,
  professeurOptions,
}: Props) {
  const router = useRouter();
  const [lignesDraft, setLignesDraft] = useState<DraftLigne[]>(() =>
    row ? rowVersDrafts(row) : []
  );
  const [addOpen, setAddOpen] = useState(false);
  const [addModalKey, setAddModalKey] = useState(0);

  const [state, formAction, pending] = useActionState(
    updateContenuPedagogiqueAction,
    initial
  );

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onClose();
    }
  }, [state, onClose, router]);

  const externes = useMemo(
    () => new Set(matiereIdsReserveesAilleurs.map((x) => x.trim()).filter(Boolean)),
    [matiereIdsReserveesAilleurs]
  );

  const idsDansBrouillonExisting = useMemo(
    () =>
      lignesDraft
        .filter((l): l is Extract<DraftLigne, { kind: "existing" }> => l.kind === "existing")
        .map((l) => l.matiereId.trim()),
    [lignesDraft]
  );

  /** Matières proposées pour une nouvelle ligne : pas déjà utilisée dans ce brouillon, et pas réservée ailleurs. */
  const matieresPourModaleAjout = useMemo(() => {
    const prisIci = new Set(idsDansBrouillonExisting);
    return toutesLesMatieres.filter((m) => {
      if (prisIci.has(m.id)) return false;
      if (!externes.has(m.id)) return true;
      return false;
    });
  }, [toutesLesMatieres, externes, idsDansBrouillonExisting]);

  const lignesJson = useMemo(
    () => draftVersPayloadJson(lignesDraft),
    [lignesDraft]
  );

  const totalHeuresBrouillon = useMemo(
    () => lignesDraft.reduce((s, l) => s + l.nombreHeuresPrevues, 0),
    [lignesDraft]
  );

  if (!open || !row) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-[2vw]"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modifier-contenu-pedagogique-titre"
          className="max-h-[92vh] w-full max-w-[min(94vw,36rem)] overflow-y-auto rounded-2xl border border-white/60 bg-white p-[min(5vw,1.25rem)] shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2
            id="modifier-contenu-pedagogique-titre"
            className="text-lg font-semibold text-slate-900"
          >
            Modifier le contenu pédagogique
          </h2>
          <p className="mt-1 text-xs text-slate-600">{row.matieresLabel}</p>

          <form action={formAction} className="mt-[2vh] flex flex-col gap-[2vh]">
            <input type="hidden" name="contenuPedagogiqueId" value={row.id} />
            <input type="hidden" name="lignesJson" value={lignesJson} />

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-800">Nom du contenu</span>
              <input
                name="nomContenu"
                type="text"
                required
                maxLength={200}
                disabled={pending}
                defaultValue={row.nom}
                className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-800">Description</span>
              <textarea
                name="descriptionContenu"
                rows={3}
                maxLength={2000}
                disabled={pending}
                defaultValue={row.description}
                className="resize-y rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
              />
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-[min(4vw,0.875rem)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">Matières</p>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                  onClick={() => {
                    setAddModalKey((k) => k + 1);
                    setAddOpen(true);
                  }}
                >
                  + Ajouter une matière
                </button>
              </div>
              <ul className="mt-3 max-h-[min(32vh,18rem)] space-y-2 overflow-y-auto text-sm">
                {lignesDraft.map((l) => (
                  <li
                    key={l.clientKey}
                    className="flex flex-col gap-1 rounded-xl border border-white/80 bg-white px-3 py-2 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">
                          {l.kind === "existing"
                            ? l.matiereNom
                            : `Nouvelle : ${l.nouveauNom}`}
                        </p>
                        <p className="text-xs text-slate-600">
                          Professeur(s) :{" "}
                          {l.professeurIds.length === 0
                            ? "—"
                            : l.professeurIds
                                .map(
                                  (id) =>
                                    professeurOptions.find((p) => p.id === id)?.label ??
                                    id
                                )
                                .join(", ")}
                        </p>
                        <label className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-700">
                          <span className="shrink-0 font-medium">Heures prévues</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={l.nombreHeuresPrevues}
                            disabled={pending}
                            onChange={(e) => {
                              const v = e.target.value === "" ? 0 : Math.round(Number(e.target.value));
                              if (!Number.isFinite(v) || v < 0) return;
                              setLignesDraft((prev) =>
                                prev.map((x) =>
                                  x.clientKey === l.clientKey
                                    ? { ...x, nombreHeuresPrevues: v }
                                    : x
                                )
                              );
                            }}
                            className="max-w-[6rem] rounded-lg border border-slate-200 px-2 py-1 tabular-nums outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-60"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        disabled={pending || lignesDraft.length <= 1}
                        className="shrink-0 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-45"
                        onClick={() =>
                          setLignesDraft((prev) =>
                            prev.filter((x) => x.clientKey !== l.clientKey)
                          )
                        }
                      >
                        Retirer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {lignesDraft.length < 1 ? (
                <p className="mt-2 text-xs text-amber-700">
                  Conservez au moins une matière dans le regroupement.
                </p>
              ) : null}
            </div>

            <p className="text-xs text-slate-600">
              Total du bloc (somme des lignes) :{" "}
              <strong className="tabular-nums text-slate-800">{totalHeuresBrouillon} h</strong>
            </p>

            {state && !state.ok ? (
              <p role="alert" className="text-sm text-red-700">
                {state.error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={pending || lignesDraft.length < 1}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-fuchsia-500 disabled:opacity-60"
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                onClick={onClose}
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>

      <AjouterLigneContenuPedagogiqueModal
        key={addModalKey}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        matieresSansFiche={matieresPourModaleAjout}
        professeurOptions={professeurOptions}
        matiereIdsDejaDansDraft={idsDansBrouillonExisting}
        onAjouter={(r) => {
          const key =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `l-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          setLignesDraft((prev) => [...prev, resultVersDraft(r, key)]);
        }}
      />
    </>
  );
}
