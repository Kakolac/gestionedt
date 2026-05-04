"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMenuVisibilityByTileAction } from "@/app/administration/matricemenu/actions";
import type { MenuVisibilityByTile } from "@/lib/menuVisibility/loadRules";
import {
  NAV_TILE_DEFINITIONS,
  NAV_TILE_IDS,
  type NavTileScope,
} from "@/lib/menuVisibility/tiles";

type MetierColumn = { slug: string; label: string };

type Props = {
  initialByTile: MenuVisibilityByTile;
  metierRoles: MetierColumn[];
};

const SCOPE_LABEL: Record<NavTileScope, string> = {
  accueil: "Accueil",
  hub: "Hub Administration",
};

function cloneSetsFromByTile(byTile: MenuVisibilityByTile): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const id of NAV_TILE_IDS) {
    const list = byTile[id];
    out[id] = new Set(
      (list ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean)
    );
  }
  return out;
}

function setsToByTile(sets: Record<string, Set<string>>): MenuVisibilityByTile {
  const out: MenuVisibilityByTile = {};
  for (const id of NAV_TILE_IDS) {
    const arr = [...(sets[id] ?? [])].sort();
    if (arr.length > 0) {
      out[id] = arr;
    }
  }
  return out;
}

export function MenuVisibilityMatrix({
  initialByTile,
  metierRoles,
}: Props) {
  const router = useRouter();
  const [rules, setRules] = useState(() => cloneSetsFromByTile(initialByTile));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const serializedInitial = useMemo(
    () => JSON.stringify(setsToByTile(cloneSetsFromByTile(initialByTile))),
    [initialByTile]
  );
  const dirty = useMemo(
    () => JSON.stringify(setsToByTile(rules)) !== serializedInitial,
    [rules, serializedInitial]
  );

  function toggle(tileId: string, metierSlug: string) {
    const m = metierSlug.trim().toLowerCase();
    if (!m) {
      return;
    }
    setRules((prev) => {
      const next: Record<string, Set<string>> = { ...prev };
      const set = new Set(next[tileId] ?? []);
      if (set.has(m)) {
        set.delete(m);
      } else {
        set.add(m);
      }
      next[tileId] = set;
      return next;
    });
  }

  function onSave() {
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify(setsToByTile(rules)));
      const res = await saveMenuVisibilityByTileAction(undefined, fd);
      if (res.ok) {
        setMessage("Enregistrement effectué.");
        router.refresh();
      } else {
        setMessage(res.error ?? "Erreur.");
      }
    });
  }

  const grouped = useMemo(() => {
    const scopes: NavTileScope[] = ["accueil", "hub"];
    return scopes.map((scope) => ({
      scope,
      tiles: NAV_TILE_DEFINITIONS.filter((t) => t.scope === scope),
    }));
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Cochez les cases pour indiquer quels <strong>rôles métier</strong> voient
        chaque tuile ou lien d&apos;accueil / hub. Une ligne sans aucune case
        cochée signifie : <strong>aucun filtre métier</strong> (affichage régi
        uniquement par les permissions <code className="text-xs">feature.*</code>
        , comme avant). Les utilisateurs <strong>sans</strong> rôle métier ne sont
        pas filtrés par cette matrice.{" "}
        <strong>
          Masquer une tuile ici ne désactive pas les gardes des routes ni des
          actions serveur.
        </strong>
      </p>

      {metierRoles.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Aucun rôle métier en base : créez-en au préalable (
          <span className="font-mono text-xs">metierroles</span>), puis
          revenez sur cette page.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/90 shadow-[0_8px_30px_rgba(49,46,129,0.06)]">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90">
              <th className="px-3 py-2 text-left font-medium text-slate-800">
                Tuile / entrée
              </th>
              {metierRoles.map((c) => (
                <th
                  key={c.slug}
                  className="min-w-[100px] px-2 py-2 text-center text-xs font-medium text-slate-700"
                >
                  <span className="block">{c.label}</span>
                  <span className="mt-0.5 block font-mono text-[10px] font-normal text-slate-500">
                    {c.slug}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ scope, tiles }) => (
              <Fragment key={scope}>
                <tr className="bg-indigo-50/50">
                  <td
                    colSpan={1 + metierRoles.length}
                    className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-700"
                  >
                    {SCOPE_LABEL[scope]}
                  </td>
                </tr>
                {tiles.map((tile) => (
                  <tr key={tile.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{tile.label}</td>
                    {metierRoles.map((c) => {
                      const checked = rules[tile.id]?.has(
                        c.slug.trim().toLowerCase()
                      );
                      return (
                        <td key={c.slug} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                            checked={!!checked}
                            onChange={() => toggle(tile.id, c.slug)}
                            disabled={pending}
                            aria-label={`${tile.label} — ${c.label}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={onSave}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {message ? (
          <p className="text-sm text-slate-600" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
