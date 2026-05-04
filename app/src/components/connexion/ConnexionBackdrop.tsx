type Props = {
  className?: string;
};

/**
 * Halos radiaux statiques (fond « Aurora ») — sans animation lourde.
 */
export function ConnexionBackdrop({ className = "" }: Props) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-indigo-400/25 blur-3xl" />
      <div className="absolute left-1/3 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-fuchsia-400/20 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-sky-400/25 blur-3xl" />
    </div>
  );
}
