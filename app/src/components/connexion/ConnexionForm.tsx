"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ConnexionFormCard } from "@/components/connexion/ConnexionFormCard";

export function ConnexionForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl: "/accueil",
      });

      if (res?.error) {
        setError(
          "Identifiants invalides. Vérifiez votre e-mail et votre mot de passe."
        );
        return;
      }

      router.push(
        res?.url && !res.url.includes("error") ? res.url : "/accueil"
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <ConnexionFormCard
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      errorMessage={error}
      isPending={pending}
      onSubmit={handleSubmit}
    />
  );
}
