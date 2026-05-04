import { AdminShortcutTile } from "@/components/administration/AdminShortcutTile";

export function CreerRoleMetierHubTile() {
  return (
    <AdminShortcutTile
      href="/administration/roles-metier"
      title="Rôles métier"
      subtitle="Liste, création et modification."
    />
  );
}
