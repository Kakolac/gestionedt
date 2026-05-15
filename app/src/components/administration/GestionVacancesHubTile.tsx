import { AdminShortcutTile } from "@/components/administration/AdminShortcutTile";

export function GestionVacancesHubTile() {
  return (
    <AdminShortcutTile
      href="/administration/gestion-vacances"
      title="Gestion des vacances"
      subtitle="Créer, modifier ou supprimer des périodes de vacances réutilisables."
    />
  );
}
