type Props = {
  isAuthed: boolean;
  children: React.ReactNode;
};

/**
 * Enveloppe légère : thème Aurora pour les sessions authentifiées.
 */
export function AppShell({ isAuthed, children }: Props) {
  return (
    <div
      className={
        isAuthed
          ? "min-h-dvh flex flex-col bg-gradient-to-br from-indigo-50 via-white to-sky-50 text-slate-900"
          : "min-h-dvh flex flex-col"
      }
    >
      {children}
    </div>
  );
}
