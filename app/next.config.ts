import type { NextConfig } from "next";
import { config as loadEnvFile } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Répertoire du projet Next (`…/gestionedt/app`) : ancre Turbopack même si un lockfile existe au-dessus. */
const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "..");

/**
 * Next ne charge par défaut que les `.env*` dans `app/`, pas ceux à la racine du dépôt.
 * Alignement avec la convention AdAgile : `.env.local` à la racine puis `app/.env.local` (ce dernier gagne).
 */
const repoEnv = path.join(repoRoot, ".env.local");
const appEnv = path.join(appDir, ".env.local");
if (fs.existsSync(repoEnv)) {
  loadEnvFile({ path: repoEnv, override: false });
}
if (fs.existsSync(appEnv)) {
  loadEnvFile({ path: appEnv, override: true });
}

const nextConfig: NextConfig = {
  turbopack: {
    root: appDir,
  },
  async redirects() {
    return [
      {
        source: "/administration/creation-contenu-pedagogique",
        destination: "/administration/creation-formation",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
