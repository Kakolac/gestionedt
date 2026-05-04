"use client";

import { useActionState, useEffect } from "react";
import {
  updateUserAction,
  type UserActionState,
} from "@/app/administration/_actions/users";
import type { RoleOption } from "@/components/administration/CreerUtilisateurModal";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  roleSlugs: string[];
  metierRoleSlugs: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  user: UserRow | null;
  baseRoles: RoleOption[];
  metierRoles: RoleOption[];
};

const initial: UserActionState | undefined = undefined;

export function ModifierUtilisateurModal({
  open,
  onClose,
  user,
  baseRoles,
  metierRoles,
}: Props) {
  const [state, formAction, pending] = useActionState(
    updateUserAction,
    initial
  );

  useEffect(() => {
    if (state?.ok) {
      onClose();
    }
  }, [state, onClose]);

  if (!open || !user) {
    return null;
  }

  const baseSet = new Set(user.roleSlugs.map((s) => s.toLowerCase()));
  const metierSet = new Set(user.metierRoleSlugs.map((s) => s.toLowerCase()));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
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
        aria-labelledby="modifier-utilisateur-titre"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/60 bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="modifier-utilisateur-titre"
          className="text-lg font-semibold text-slate-900"
        >
          Modifier l&apos;utilisateur
        </h2>
        <p className="mt-1 text-xs text-slate-500">{user.email}</p>

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="userId" value={user.id} />

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">E-mail</span>
            <input
              name="email"
              type="email"
              required
              disabled={pending}
              defaultValue={user.email}
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">
              Nouveau mot de passe (laisser vide pour ne pas changer)
            </span>
            <input
              name="password"
              type="password"
              minLength={8}
              disabled={pending}
              autoComplete="new-password"
              placeholder="••••••••"
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Nom affiché</span>
            <input
              name="name"
              type="text"
              disabled={pending}
              defaultValue={user.name}
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            />
          </label>

          <fieldset className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <legend className="text-sm font-medium text-slate-800">
              Rôles de base
            </legend>
            <ul className="mt-2 grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
              {baseRoles.map((r) => (
                <li key={r.slug}>
                  <label className="flex gap-2 text-xs text-slate-800">
                    <input
                      type="checkbox"
                      name="roleSlugs"
                      value={r.slug}
                      disabled={pending}
                      defaultChecked={baseSet.has(r.slug.toLowerCase())}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600"
                    />
                    <span>
                      <span className="font-medium">{r.label}</span>
                      <span className="block font-mono text-[10px] text-slate-500">
                        {r.slug}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <legend className="text-sm font-medium text-slate-800">
              Rôles métier
            </legend>
            <ul className="mt-2 grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
              {metierRoles.length === 0 ? (
                <li className="text-xs text-slate-500">Aucun rôle métier.</li>
              ) : (
                metierRoles.map((m) => (
                  <li key={m.slug}>
                    <label className="flex gap-2 text-xs text-slate-800">
                      <input
                        type="checkbox"
                        name="metierRoleSlugs"
                        value={m.slug}
                        disabled={pending}
                        defaultChecked={metierSet.has(m.slug.toLowerCase())}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600"
                      />
                      <span>
                        <span className="font-medium">{m.label}</span>
                        <span className="block font-mono text-[10px] text-slate-500">
                          {m.slug}
                        </span>
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </fieldset>

          {state && !state.ok ? (
            <p role="alert" className="text-sm text-red-700">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
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
  );
}
