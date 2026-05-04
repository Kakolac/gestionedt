type Props = {
  title: string;
  eyebrow: string;
  subtitle: string;
  children: React.ReactNode;
};

export function ConnexionShell({
  eyebrow,
  title,
  subtitle,
  children,
}: Props) {
  return (
    <div className="relative flex min-h-dvh flex-col justify-center px-4 py-12">
      <div className="connexion-fade-in-up mx-auto w-full max-w-lg">
        <header className="mb-8 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600/80">
            {eyebrow}
          </p>
          <h1 className="mt-3 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-sky-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-base text-slate-600">{subtitle}</p>
        </header>
        {children}
      </div>
    </div>
  );
}
