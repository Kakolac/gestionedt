"use server";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { liveSessionHasAnyPermission } from "@/lib/authz";
import { connectDB } from "@/lib/mongodb";
import { MetierRole } from "@/lib/models/MetierRole";
import { Role } from "@/lib/models/Role";
import { User } from "@/lib/models/User";
import {
  MONGO_ADMIN_ROLE_SLUG,
  PERMISSION_ADMIN_UTILISATEURS,
} from "@/lib/permissions/keys";
import {
  effectiveBaseRoleSlugsForUser,
} from "@/lib/permissions/resolveForUser";
import { revalidatePath } from "next/cache";

export type UserActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const MIN_PASSWORD_LENGTH = 8;

async function ensureUsersPermission(): Promise<UserActionState | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Non connecté." };
  }
  const allowed = await liveSessionHasAnyPermission(session, [
    PERMISSION_ADMIN_UTILISATEURS,
  ]);
  if (!allowed) {
    return { ok: false, error: "Permission refusée." };
  }
  return null;
}

function normalizeSlug(s: string): string {
  return s.trim().toLowerCase();
}

function parseSlugArray(formData: FormData, key: string): string[] {
  const raw = formData.getAll(key);
  return [
    ...new Set(
      raw
        .filter((v): v is string => typeof v === "string")
        .map(normalizeSlug)
        .filter(Boolean)
    ),
  ];
}

function legacyRoleFromBaseSlugs(slugs: string[]): "admin" | "user" {
  return slugs.includes(MONGO_ADMIN_ROLE_SLUG) ? "admin" : "user";
}

async function countAdministratorUsers(): Promise<number> {
  await connectDB();
  const users = await User.find({}).lean();
  let n = 0;
  for (const u of users) {
    const slugs = await effectiveBaseRoleSlugsForUser(u);
    if (slugs.includes(MONGO_ADMIN_ROLE_SLUG)) {
      n += 1;
    }
  }
  return n;
}

async function validateRoleAssignments(
  roleSlugs: string[],
  metierRoleSlugs: string[]
): Promise<UserActionState | null> {
  await connectDB();
  const roleSet = new Set(
    (await Role.find({}).select("slug").lean()).map((r) =>
      normalizeSlug(String(r.slug))
    )
  );
  const unknownBase = roleSlugs.filter((s) => !roleSet.has(s));
  if (unknownBase.length > 0) {
    return {
      ok: false,
      error: `Rôles de base inconnus : ${unknownBase.join(", ")}`,
    };
  }

  const metierSet = new Set(
    (await MetierRole.find({}).select("slug").lean()).map((m) =>
      normalizeSlug(String(m.slug))
    )
  );
  const unknownMetier = metierRoleSlugs.filter((s) => !metierSet.has(s));
  if (unknownMetier.length > 0) {
    return {
      ok: false,
      error: `Rôles métier inconnus : ${unknownMetier.join(", ")}`,
    };
  }

  return null;
}

export async function createUserAction(
  _prev: UserActionState | undefined,
  formData: FormData
): Promise<UserActionState> {
  const denied = await ensureUsersPermission();
  if (denied) {
    return denied;
  }

  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");
  const nameRaw = formData.get("name");

  if (typeof emailRaw !== "string" || !emailRaw.trim()) {
    return { ok: false, error: "L’e-mail est obligatoire." };
  }
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "E-mail invalide." };
  }

  if (typeof passwordRaw !== "string" || passwordRaw.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Mot de passe : au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    };
  }

  const name =
    typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : "";

  const roleSlugs = parseSlugArray(formData, "roleSlugs");
  const metierRoleSlugs = parseSlugArray(formData, "metierRoleSlugs");

  const assignErr = await validateRoleAssignments(roleSlugs, metierRoleSlugs);
  if (assignErr) {
    return assignErr;
  }

  await connectDB();

  const passwordHash = await bcrypt.hash(passwordRaw, 12);

  const previewDoc = {
    role: "user" as const,
    roleSlugs,
    metierRoleSlugs,
  };
  const effectivePreview = await effectiveBaseRoleSlugsForUser(previewDoc);

  try {
    await User.create({
      email,
      passwordHash,
      name,
      role: legacyRoleFromBaseSlugs(effectivePreview),
      roleSlugs,
      metierRoleSlugs,
    });
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: number }).code === 11000
    ) {
      return { ok: false, error: "Un compte existe déjà avec cet e-mail." };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  revalidatePath("/administration/utilisateurs");
  revalidatePath("/administration");
  return { ok: true, message: `Utilisateur ${email} créé.` };
}

export async function updateUserAction(
  _prev: UserActionState | undefined,
  formData: FormData
): Promise<UserActionState> {
  const denied = await ensureUsersPermission();
  if (denied) {
    return denied;
  }

  const idRaw = formData.get("userId");
  if (typeof idRaw !== "string" || !mongoose.Types.ObjectId.isValid(idRaw)) {
    return { ok: false, error: "Identifiant utilisateur invalide." };
  }

  await connectDB();
  const existing = await User.findById(idRaw).lean();
  if (!existing) {
    return { ok: false, error: "Utilisateur introuvable." };
  }

  const emailRaw = formData.get("email");
  const nameRaw = formData.get("name");
  const passwordRaw = formData.get("password");

  if (typeof emailRaw !== "string" || !emailRaw.trim()) {
    return { ok: false, error: "L’e-mail est obligatoire." };
  }
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "E-mail invalide." };
  }

  const name =
    typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : "";

  const roleSlugs = parseSlugArray(formData, "roleSlugs");
  const metierRoleSlugs = parseSlugArray(formData, "metierRoleSlugs");

  const assignErr = await validateRoleAssignments(roleSlugs, metierRoleSlugs);
  if (assignErr) {
    return assignErr;
  }

  const currentEffective = await effectiveBaseRoleSlugsForUser(existing);
  const nextEffective = await effectiveBaseRoleSlugsForUser({
    role: existing.role,
    roleSlugs,
    metierRoleSlugs,
  });

  const hadAdmin = currentEffective.includes(MONGO_ADMIN_ROLE_SLUG);
  const hasAdmin = nextEffective.includes(MONGO_ADMIN_ROLE_SLUG);
  if (hadAdmin && !hasAdmin) {
    const admins = await countAdministratorUsers();
    if (admins <= 1) {
      return {
        ok: false,
        error:
          "Impossible de retirer le rôle administrateur au dernier compte admin.",
      };
    }
  }

  const dup = await User.findOne({
    email,
    _id: { $ne: existing._id },
  }).lean();
  if (dup) {
    return { ok: false, error: "Un autre compte utilise déjà cet e-mail." };
  }

  let passwordHash: string | undefined;
  if (typeof passwordRaw === "string" && passwordRaw.length > 0) {
    if (passwordRaw.length < MIN_PASSWORD_LENGTH) {
      return {
        ok: false,
        error: `Mot de passe : au moins ${MIN_PASSWORD_LENGTH} caractères.`,
      };
    }
    passwordHash = await bcrypt.hash(passwordRaw, 12);
  }

  try {
    const update: Record<string, unknown> = {
      email,
      name,
      roleSlugs,
      metierRoleSlugs,
      role: legacyRoleFromBaseSlugs(nextEffective),
    };
    if (passwordHash) {
      update.passwordHash = passwordHash;
    }
    await User.updateOne({ _id: existing._id }, { $set: update });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  revalidatePath("/administration/utilisateurs");
  revalidatePath("/administration");
  return { ok: true, message: "Utilisateur mis à jour." };
}

export async function deleteUserAction(userId: string): Promise<UserActionState> {
  const denied = await ensureUsersPermission();
  if (denied) {
    return denied;
  }

  const session = await auth();
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  if (session?.user?.id === userId) {
    return { ok: false, error: "Vous ne pouvez pas supprimer votre propre compte." };
  }

  await connectDB();
  const existing = await User.findById(userId).lean();
  if (!existing) {
    return { ok: false, error: "Utilisateur introuvable." };
  }

  const effective = await effectiveBaseRoleSlugsForUser(existing);
  if (effective.includes(MONGO_ADMIN_ROLE_SLUG)) {
    const admins = await countAdministratorUsers();
    if (admins <= 1) {
      return {
        ok: false,
        error: "Impossible de supprimer le dernier compte administrateur.",
      };
    }
  }

  await User.deleteOne({ _id: existing._id });
  revalidatePath("/administration/utilisateurs");
  revalidatePath("/administration");
  return { ok: true, message: "Utilisateur supprimé." };
}

export async function deleteUserFormAction(
  _prev: UserActionState | undefined,
  formData: FormData
): Promise<UserActionState> {
  const raw = formData.get("userId");
  if (typeof raw !== "string") {
    return { ok: false, error: "Identifiant manquant." };
  }
  return deleteUserAction(raw);
}
