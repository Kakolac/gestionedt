import Link from "next/link";

type Props = {
  href: string;
  title: string;
  subtitle?: string;
  /** Libellé uppercase au-dessus du titre ; défaut « Administration » pour les sous-tuiles hub. */
  eyebrow?: string;
};

export function AdminShortcutTile({
  href,
  title,
  subtitle,
  eyebrow = "Administration",
}: Props) {
  return (
    <Link
      href={href}
      className="group flex h-full min-h-[140px] flex-col rounded-2xl border border-white/60 bg-white/80 p-5 shadow-[0_8px_30px_rgba(49,46,129,0.06)] transition hover:border-indigo-200/80 hover:shadow-[0_12px_40px_rgba(49,46,129,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
    >
      {eyebrow ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-600/80">
          {eyebrow}
        </span>
      ) : null}
      <span
        className={`${eyebrow ? "mt-2" : ""} text-lg font-semibold text-slate-900`}
      >
        {title}
      </span>
      {subtitle ? (
        <span className="mt-2 text-sm text-slate-600">{subtitle}</span>
      ) : null}
      <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-indigo-600">
        Ouvrir
        <span
          aria-hidden
          className="transition group-hover:translate-x-0.5 rtl:-scale-x-100"
        >
          →
        </span>
      </span>
    </Link>
  );
}
