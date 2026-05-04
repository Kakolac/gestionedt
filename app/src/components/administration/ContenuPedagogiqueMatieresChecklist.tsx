"use client";

export type MatiereOptionCheck = { id: string; nom: string };

type Props = {
  options: MatiereOptionCheck[];
  /** Identifiants des matières cochées (contrôlé par le parent). */
  selectedIds: readonly string[];
  onSelectedIdsChange: (next: string[]) => void;
  disabled?: boolean;
  emptyOptionsHint?: string;
};

export function ContenuPedagogiqueMatieresChecklist({
  options,
  selectedIds,
  onSelectedIdsChange,
  disabled,
  emptyOptionsHint,
}: Props) {
  const set = new Set(selectedIds.map((x) => x.trim()).filter(Boolean));

  function toggle(id: string, checked: boolean) {
    const idTrim = id.trim();
    if (!idTrim) return;
    const next = new Set(set);
    if (checked) next.add(idTrim);
    else next.delete(idTrim);
    onSelectedIdsChange([...next]);
  }

  if (options.length === 0) {
    return (
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="font-medium text-slate-800">Matières du regroupement</legend>
        <p className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900">
          {emptyOptionsHint ??
            "Aucune matière disponible (toutes sont déjà dans un autre contenu)."}
        </p>
      </fieldset>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="font-medium text-slate-800">Matières du regroupement</legend>
      <p className="text-xs text-slate-500">
        Cochez au moins une matière. Une même matière ne peut appartenir qu&apos;à un
        seul contenu pédagogique.
      </p>
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="matiereIds" value={id.trim()} />
      ))}
      <ul className="max-h-[min(28vh,16rem)] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        {options.map((m) => (
          <li key={m.id}>
            <label className="flex cursor-pointer items-start gap-2 text-slate-800">
              <input
                type="checkbox"
                checked={set.has(m.id)}
                disabled={disabled}
                onChange={(e) => toggle(m.id, e.target.checked)}
                className="mt-1 accent-indigo-600 disabled:opacity-50"
              />
              <span>{m.nom}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
