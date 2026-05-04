import { AdminShortcutTile } from "@/components/administration/AdminShortcutTile";

export function AdministrationAccueilTile() {
  return (
    <AdminShortcutTile
      href="/administration"
      title="Administration"
      subtitle="Rôles métier et comptes utilisateurs."
      eyebrow=""
    />
  );
}
