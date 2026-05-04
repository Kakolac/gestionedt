"use client";

import Link from "next/link";
import { useState } from "react";
import { SupprimerRoleMetierModal } from "@/components/administration/SupprimerRoleMetierModal";

export type RoleMetierListeRow = {
  slug: string;
  label: string;
  baseRoleSlugs: string[];
  deletable: boolean;
};

type Props = {
  roles: RoleMetierListeRow[];
};

export function RolesMetierListe({ roles }: Props) {
  const [pendingDelete, setPendingDelete] = useState<{
    slug: string;
    label: string;
  } | null>(null);
  const [deleteModalKey, setDeleteModalKey] = useState(0);

  return (
    <>
      <ul className="flex flex-col gap-3">
        {roles.map((r) => (
          <li
            key={r.slug}
            className="flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/80 p-4 shadow-[0_8px_30px_rgba(49,46,129,0.06)] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{r.label}</p>
              <p className="font-mono text-xs text-slate-500">{r.slug}</p>
              <p className="mt-1 text-xs text-slate-600">
                Rôles de base :{" "}
                {r.baseRoleSlugs.length > 0 ? r.baseRoleSlugs.join(", ") : "—"}
              </p>
              {!r.deletable ? (
                <p className="mt-2 text-xs font-medium text-amber-800">
                  Rôle système (bootstrap) : suppression désactivée.
                </p>
              ) : null}
            </div>
            <div className="flex flex-shrink-0 flex-wrap gap-2">
              <Link
                href={`/administration/roles-metier/${encodeURIComponent(r.slug)}/modifier`}
                className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-100"
              >
                Modifier
              </Link>
              {r.deletable ? (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
                  onClick={() => {
                    setPendingDelete({ slug: r.slug, label: r.label });
                    setDeleteModalKey((k) => k + 1);
                  }}
                >
                  Supprimer
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <SupprimerRoleMetierModal
        key={deleteModalKey}
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        slug={pendingDelete?.slug ?? null}
        label={pendingDelete?.label ?? null}
      />
    </>
  );
}
