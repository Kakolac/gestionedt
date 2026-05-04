import { ConnexionBackdrop } from "@/components/connexion/ConnexionBackdrop";
import { ConnexionForm } from "@/components/connexion/ConnexionForm";
import { ConnexionShell } from "@/components/connexion/ConnexionShell";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ConnexionPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/accueil");
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-sky-50 text-slate-900">
      <ConnexionBackdrop />
      <ConnexionShell
        eyebrow="Gestion EDT"
        title="Connexion"
        subtitle="Accédez à votre espace sécurisé avec votre e-mail et votre mot de passe."
      >
        <ConnexionForm />
      </ConnexionShell>
    </div>
  );
}
