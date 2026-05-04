import { AdminShortcutTile } from "@/components/administration/AdminShortcutTile";

export function ExportFormationJsonHubTile() {
  return (
    <AdminShortcutTile
      href="/administration/export-formation-json"
      title="Export JSON formations"
      subtitle="Choisir une ou plusieurs formations : export brut (formation + matières et professeurs liés)."
    />
  );
}
