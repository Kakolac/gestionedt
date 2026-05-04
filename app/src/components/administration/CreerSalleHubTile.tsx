import { AdminShortcutTile } from "@/components/administration/AdminShortcutTile";

export function CreerSalleHubTile() {
  return (
    <AdminShortcutTile
      href="/administration/creation-salle"
      title="Création salle"
      subtitle="Créer, modifier ou supprimer des salles (classiques ou spécifiques)."
    />
  );
}
