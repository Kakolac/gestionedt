import { AdminShortcutTile } from "@/components/administration/AdminShortcutTile";

export function PlanningFormationHubTile() {
  return (
    <AdminShortcutTile
      href="/administration/planning-formation"
      title="Planning formation"
      subtitle="Choisir une formation : prévisualisation du planning à partir des données réelles (matières et professeurs liés)."
    />
  );
}
