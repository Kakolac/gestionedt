import { AdminShortcutTile } from "@/components/administration/AdminShortcutTile";

export function CreerFormationHubTile() {
  return (
    <AdminShortcutTile
      href="/administration/creation-formation"
      title="Formation"
      subtitle="Regroupements : nom, description, plusieurs matières, équipe et heures."
    />
  );
}
