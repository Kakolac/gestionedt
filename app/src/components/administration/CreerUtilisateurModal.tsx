"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createUserAction,
  type UserActionState,
} from "@/app/administration/_actions/users";

export type RoleOption = { slug: string; label: string };

type Props = {
  open: boolean;
  onClose: () => void;
  baseRoles: RoleOption[];
  metierRoles: RoleOption[];
};

const initial: UserActionState | undefined = undefined;

export function CreerUtilisateurModal({
  open,
  onClose,
  baseRoles,
  metierRoles,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    createUserAction,
    initial
  );

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onClose();
    }
  }, [state, onClose]);

  if (!open) {
    return null;
  }

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
        aria-labelledby="creer-utilisateur-titre"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/60 bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="creer-utilisateur-titre"
          className="text-lg font-semibold text-slate-900"
        >
          Nouvel utilisateur
        </h2>

        <form ref={formRef} action={formAction} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">E-mail</span>
            <input
              name="email"
              type="email"
              required
              disabled={pending}
              autoComplete="off"
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Mot de passe</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              disabled={pending}
              autoComplete="new-password"
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Nom affiché</span>
            <input
              name="name"
              type="text"
              disabled={pending}
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
                <li className="text-xs text-slate-500">
                  Aucun rôle métier en base (créez-en depuis le hub).
                </li>
              ) : (
                metierRoles.map((m) => (
                  <li key={m.slug}>
                    <label className="flex gap-2 text-xs text-slate-800">
                      <input
                        type="checkbox"
                        name="metierRoleSlugs"
                        value={m.slug}
                        disabled={pending}
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
              {pending ? "Création…" : "Créer"}
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
