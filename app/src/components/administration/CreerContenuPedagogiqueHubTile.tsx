import { AdminShortcutTile } from "@/components/administration/AdminShortcutTile";

export function CreerContenuPedagogiqueHubTile() {
  return (
    <AdminShortcutTile
      href="/administration/creation-contenu-pedagogique"
      title="Contenu pédagogique"
      subtitle="Regroupements : nom, description, plusieurs matières, équipe et heures."
    />
  );
}
