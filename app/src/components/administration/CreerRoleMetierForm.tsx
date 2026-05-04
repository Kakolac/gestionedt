"use client";

import { useActionState } from "react";
import {
  createMetierRoleAction,
  type MetierRoleActionState,
} from "@/app/administration/_actions/metierRoles";

type BaseRoleOption = { slug: string; label: string };

type Props = {
  baseRoles: BaseRoleOption[];
};

const initialState: MetierRoleActionState | undefined = undefined;

export function CreerRoleMetierForm({ baseRoles }: Props) {
  const [state, formAction, pending] = useActionState(
    createMetierRoleAction,
    initialState
  );

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-white/60 bg-white/80 p-6 shadow-[0_8px_30px_rgba(49,46,129,0.06)]"
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-800">Nom du rôle métier</span>
          <input
            name="label"
            type="text"
            required
            autoComplete="off"
            disabled={pending}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-indigo-500/0 transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            placeholder="Ex. Coordinateur pédagogique"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-slate-800">
            Rôles de base inclus
          </legend>
          <p className="text-xs text-slate-500">
            Cochez au moins un rôle déjà défini dans la collection{" "}
            <code className="rounded bg-slate-100 px-1">roles</code>.
          </p>
          <ul className="mt-1 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:grid-cols-2">
            {baseRoles.map((r) => (
              <li key={r.slug}>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    name="baseRoleSlugs"
                    value={r.slug}
                    disabled={pending}
                    className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <span className="font-medium">{r.label}</span>
                    <span className="block font-mono text-xs text-slate-500">
                      {r.slug}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </div>

      {state && !state.ok ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      {state?.ok ? (
        <p
          role="status"
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:to-fuchsia-500 disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Créer le rôle métier"}
      </button>
    </form>
  );
}
