/**
 * Produit un slug Mongo stable à partir d’un libellé (accents retirés, underscores).
 */
export function slugifyMetierLabel(label: string): string {
  const normalized = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "role_metier";
}
