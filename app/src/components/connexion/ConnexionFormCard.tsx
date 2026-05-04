import type { FormEventHandler } from "react";

export const connexionInputClassName =
  "w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-400/30";

type Props = {
  email: string;
  password: string;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  errorMessage: string | null;
  isPending: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function ConnexionFormCard({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  errorMessage,
  isPending,
  onSubmit,
}: Props) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/92 shadow-[0_8px_30px_rgba(49,46,129,0.08)] backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-5 px-6 py-8 sm:px-8"
        noValidate
      >
        {errorMessage ? (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="connexion-email" className="text-sm font-medium text-slate-700">
            E-mail
          </label>
          <input
            id="connexion-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className={connexionInputClassName}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="connexion-password"
            className="text-sm font-medium text-slate-700"
          >
            Mot de passe
          </label>
          <input
            id="connexion-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className={connexionInputClassName}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-1 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
