import { AdminShortcutTile } from "@/components/administration/AdminShortcutTile";

export function MatriceMenuHubTile() {
  return (
    <AdminShortcutTile
      href="/administration/matricemenu"
      title="Matrice visibilité menus"
      subtitle="Quels rôles métier voient chaque tuile (affichage)."
    />
  );
}
