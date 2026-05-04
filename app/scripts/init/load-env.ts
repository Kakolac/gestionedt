import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Racine du projet Next : `gestionedt/app` */
const appRoot = path.resolve(__dirname, "../..");
/** Racine du dépôt : `gestionedt` */
const repoRoot = path.resolve(appRoot, "..");

/**
 * Charge les fichiers d’environnement sans écraser les variables déjà définies.
 * Ordre : `.env.local` à la racine du dépôt, puis `app/.env.local`.
 */
export function loadEnv(): void {
  const paths = [
    path.join(repoRoot, ".env.local"),
    path.join(appRoot, ".env.local"),
  ];
  for (const envPath of paths) {
    if (fs.existsSync(envPath)) {
      config({ path: envPath, override: false });
    }
  }
}

export { appRoot, repoRoot };
