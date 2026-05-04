import { AdminShortcutTile } from "@/components/administration/AdminShortcutTile";

export function CreerMatiereHubTile() {
  return (
    <AdminShortcutTile
      href="/administration/creation-matiere"
      title="Création matière"
      subtitle="Créer, modifier ou supprimer des matières."
    />
  );
}
