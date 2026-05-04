"use server";

import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import {
  MenuVisibilityConfig,
  MENU_VISIBILITY_GLOBAL_KEY,
} from "@/lib/models/MenuVisibilityConfig";
import { MetierRole } from "@/lib/models/MetierRole";
import { Role } from "@/lib/models/Role";
import { User } from "@/lib/models/User";
import {
  METIER_ROLE_INIT_ADMIN_SLUG,
  PERMISSION_ADMIN_ROLES_METIER,
} from "@/lib/permissions/keys";
import { slugifyMetierLabel } from "@/lib/slugifyMetier";
import { revalidatePath } from "next/cache";

export type MetierRoleActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function normalizeSlug(s: string): string {
  return s.trim().toLowerCase();
}

async function ensureRolesMetierPermission(): Promise<
  MetierRoleActionState | null
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Non connecté." };
  }
  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_ADMIN_ROLES_METIER,
  ]);
  if (!allowed) {
    return { ok: false, error: "Permission refusée." };
  }
  return null;
}

export async function createMetierRoleAction(
  _prev: MetierRoleActionState | undefined,
  formData: FormData
): Promise<MetierRoleActionState> {
  const denied = await ensureRolesMetierPermission();
  if (denied) {
    return denied;
  }

  const labelRaw = formData.get("label");
  if (typeof labelRaw !== "string" || !labelRaw.trim()) {
    return { ok: false, error: "Le nom du rôle métier est obligatoire." };
  }
  const label = labelRaw.trim();

  const selected = formData.getAll("baseRoleSlugs");
  const baseRoleSlugs = selected
    .filter((v): v is string => typeof v === "string")
    .map(normalizeSlug)
    .filter(Boolean);

  if (baseRoleSlugs.length === 0) {
    return {
      ok: false,
      error: "Sélectionnez au moins un rôle de base.",
    };
  }

  await connectDB();

  const allowedSlugs = new Set(
    (await Role.find({}).select("slug").lean()).map((r) =>
      normalizeSlug(String(r.slug))
    )
  );

  const unknown = baseRoleSlugs.filter((s) => !allowedSlugs.has(s));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Rôles de base inconnus : ${unknown.join(", ")}`,
    };
  }

  const root = slugifyMetierLabel(label);
  let slug = "";
  for (let counter = 0; counter < 500; counter += 1) {
    const candidate = counter === 0 ? root : `${root}_${counter}`;
    const roleTaken = await Role.exists({ slug: candidate });
    const metierTaken = await MetierRole.exists({ slug: candidate });
    if (!roleTaken && !metierTaken) {
      slug = candidate;
      break;
    }
  }
  if (!slug) {
    return { ok: false, error: "Impossible de générer un slug unique." };
  }

  try {
    await MetierRole.create({
      slug,
      label,
      baseRoleSlugs,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  revalidateMetierRolesPaths();
  return {
    ok: true,
    message: `Rôle métier « ${label} » créé (slug : ${slug}).`,
  };
}

function revalidateMetierRolesPaths() {
  revalidatePath("/administration");
  revalidatePath("/administration/roles-metier", "layout");
  revalidatePath("/administration/roles-metier/nouveau");
  revalidatePath("/administration/utilisateurs");
  revalidatePath("/administration/matricemenu");
  revalidatePath("/accueil");
}

export async function updateMetierRoleAction(
  _prev: MetierRoleActionState | undefined,
  formData: FormData
): Promise<MetierRoleActionState> {
  const denied = await ensureRolesMetierPermission();
  if (denied) {
    return denied;
  }

  const slugRaw = formData.get("slug");
  if (typeof slugRaw !== "string" || !slugRaw.trim()) {
    return { ok: false, error: "Slug manquant." };
  }
  const slug = normalizeSlug(slugRaw);

  const labelRaw = formData.get("label");
  if (typeof labelRaw !== "string" || !labelRaw.trim()) {
    return { ok: false, error: "Le nom du rôle métier est obligatoire." };
  }
  const label = labelRaw.trim();

  const selected = formData.getAll("baseRoleSlugs");
  const baseRoleSlugs = selected
    .filter((v): v is string => typeof v === "string")
    .map(normalizeSlug)
    .filter(Boolean);

  if (baseRoleSlugs.length === 0) {
    return {
      ok: false,
      error: "Sélectionnez au moins un rôle de base.",
    };
  }

  await connectDB();

  const existing = await MetierRole.findOne({ slug }).lean();
  if (!existing) {
    return { ok: false, error: "Rôle métier introuvable." };
  }

  const allowedSlugs = new Set(
    (await Role.find({}).select("slug").lean()).map((r) =>
      normalizeSlug(String(r.slug))
    )
  );

  const unknown = baseRoleSlugs.filter((s) => !allowedSlugs.has(s));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Rôles de base inconnus : ${unknown.join(", ")}`,
    };
  }

  try {
    await MetierRole.updateOne(
      { slug },
      { $set: { label, baseRoleSlugs } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  revalidateMetierRolesPaths();
  return {
    ok: true,
    message: `Rôle métier « ${label} » mis à jour.`,
  };
}

export async function deleteMetierRoleAction(
  _prev: MetierRoleActionState | undefined,
  formData: FormData
): Promise<MetierRoleActionState> {
  const denied = await ensureRolesMetierPermission();
  if (denied) {
    return denied;
  }

  const slugRaw = formData.get("slug");
  if (typeof slugRaw !== "string" || !slugRaw.trim()) {
    return { ok: false, error: "Slug manquant." };
  }
  const slug = normalizeSlug(slugRaw);

  if (slug === METIER_ROLE_INIT_ADMIN_SLUG) {
    return {
      ok: false,
      error:
        "Le rôle « plateforme_admin » est réservé au bootstrap : il ne peut pas être supprimé.",
    };
  }

  await connectDB();

  const deleted = await MetierRole.findOneAndDelete({ slug });
  if (!deleted) {
    return { ok: false, error: "Rôle métier introuvable." };
  }

  await User.updateMany(
    { metierRoleSlugs: slug },
    { $pull: { metierRoleSlugs: slug } }
  );

  const cfg = await MenuVisibilityConfig.findOne({
    singletonKey: MENU_VISIBILITY_GLOBAL_KEY,
  }).lean();

  if (cfg?.byTile && typeof cfg.byTile === "object") {
    const prev = cfg.byTile as Record<string, unknown>;
    const byTile: Record<string, string[]> = {};
    for (const key of Object.keys(prev)) {
      const v = prev[key];
      if (!Array.isArray(v)) {
        continue;
      }
      const next = v
        .map((x) => normalizeSlug(String(x)))
        .filter((s) => s && s !== slug);
      if (next.length > 0) {
        byTile[key] = next;
      }
    }
    await MenuVisibilityConfig.updateOne(
      { singletonKey: MENU_VISIBILITY_GLOBAL_KEY },
      { $set: { byTile } }
    );
  }

  revalidateMetierRolesPaths();
  return {
    ok: true,
    message: `Rôle métier « ${slug} » supprimé.`,
  };
}
