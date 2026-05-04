import { AdminShortcutTile } from "@/components/administration/AdminShortcutTile";

export function CreerProfesseurHubTile() {
  return (
    <AdminShortcutTile
      href="/administration/creation-professeur"
      title="Création professeur"
      subtitle="Créer, modifier ou supprimer des professeurs."
    />
  );
}
