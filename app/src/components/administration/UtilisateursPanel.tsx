"use client";

import { useState } from "react";
import type { RoleOption } from "@/components/administration/CreerUtilisateurModal";
import { CreerUtilisateurModal } from "@/components/administration/CreerUtilisateurModal";
import type { UserRow } from "@/components/administration/ModifierUtilisateurModal";
import { ModifierUtilisateurModal } from "@/components/administration/ModifierUtilisateurModal";
import { SupprimerUtilisateurConfirmModal } from "@/components/administration/SupprimerUtilisateurConfirmModal";

type Props = {
  rows: UserRow[];
  baseRoles: RoleOption[];
  metierRoles: RoleOption[];
  currentUserId: string;
};

export function UtilisateursPanel({
  rows,
  baseRoles,
  metierRoles,
  currentUserId,
}: Props) {
  const [createKey, setCreateKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    email: string;
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
          Nouvel utilisateur
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/80 shadow-[0_8px_30px_rgba(49,46,129,0.06)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-4 py-3 font-semibold text-slate-800">E-mail</th>
              <th className="px-4 py-3 font-semibold text-slate-800">Nom</th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Rôles de base
              </th>
              <th className="px-4 py-3 font-semibold text-slate-800">
                Rôles métier
              </th>
              <th className="px-4 py-3 font-semibold text-slate-800">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-slate-800">
                  {row.email}
                </td>
                <td className="px-4 py-3 text-slate-700">{row.name || "—"}</td>
                <td className="max-w-[200px] px-4 py-3 text-xs text-slate-600">
                  {row.roleSlugs.length ? row.roleSlugs.join(", ") : "—"}
                </td>
                <td className="max-w-[200px] px-4 py-3 text-xs text-slate-600">
                  {row.metierRoleSlugs.length
                    ? row.metierRoleSlugs.join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-slate-50"
                      onClick={() => setEditUser(row)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      disabled={row.id === currentUserId}
                      title={
                        row.id === currentUserId
                          ? "Vous ne pouvez pas supprimer votre compte"
                          : undefined
                      }
                      className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() =>
                        setDeleteTarget({ id: row.id, email: row.email })
                      }
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreerUtilisateurModal
        key={createKey}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        baseRoles={baseRoles}
        metierRoles={metierRoles}
      />

      <ModifierUtilisateurModal
        key={editUser ? `modifier-${editUser.id}` : "modifier-closed"}
        open={editUser != null}
        onClose={() => setEditUser(null)}
        user={editUser}
        baseRoles={baseRoles}
        metierRoles={metierRoles}
      />

      <SupprimerUtilisateurConfirmModal
        key={
          deleteTarget ? `supprimer-${deleteTarget.id}` : "supprimer-closed"
        }
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        userId={deleteTarget?.id ?? null}
        emailLabel={deleteTarget?.email ?? null}
      />
    </div>
  );
}
