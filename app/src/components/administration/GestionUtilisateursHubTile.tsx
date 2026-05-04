import { AdminShortcutTile } from "@/components/administration/AdminShortcutTile";

export function GestionUtilisateursHubTile() {
  return (
    <AdminShortcutTile
      href="/administration/utilisateurs"
      title="Gestion des utilisateurs"
      subtitle="Créer, modifier ou supprimer des comptes et leurs rôles."
    />
  );
}
