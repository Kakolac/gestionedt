import type { Session } from "next-auth";
import { MONGO_ADMIN_ROLE_SLUG } from "@/lib/permissions/keys";
import {
  effectiveBaseRoleSlugsForUser,
  metierRoleSlugsForUser,
  resolvePermissionsForUserById,
} from "@/lib/permissions/resolveForUser";

function normalizeRoleSlug(s: string): string {
  return s.trim().toLowerCase();
}

function sessionRoleSlugSet(session: Session | null): Set<string> {
  const raw = session?.user?.roleSlugs ?? [];
  const set = new Set<string>();
  for (const s of raw) {
    const n = normalizeRoleSlug(s);
    if (n) {
      set.add(n);
    }
  }
  return set;
}

/** Slugs de rôles **de base** effectifs exposés dans la session (JWT ; après expansion métier au login). */
export function sessionRoleSlugs(session: Session | null): string[] {
  return [...sessionRoleSlugSet(session)].sort();
}

/** Au moins un des slugs demandés figure dans la session (données du JWT au login). */
export function sessionHasAnyRoleSlug(
  session: Session | null,
  requiredSlugs: readonly string[]
): boolean {
  if (requiredSlugs.length === 0) {
    return true;
  }
  const have = sessionRoleSlugSet(session);
  return requiredSlugs.some((s) => have.has(normalizeRoleSlug(s)));
}

export async function liveSessionRoleSlugs(
  session: Session | null
): Promise<string[]> {
  const id = session?.user?.id;
  if (!id) {
    return [];
  }
  const { connectDB } = await import("@/lib/mongodb");
  const { User } = await import("@/lib/models/User");
  await connectDB();
  const doc = await User.findById(id).lean();
  if (!doc) {
    return [];
  }
  return effectiveBaseRoleSlugsForUser(doc);
}

/** Slugs `MetierRole` attribués à l’utilisateur (relus en base, hors expansion). */
export async function liveMetierRoleSlugs(
  session: Session | null
): Promise<string[]> {
  const id = session?.user?.id;
  if (!id) {
    return [];
  }
  const { connectDB } = await import("@/lib/mongodb");
  const { User } = await import("@/lib/models/User");
  await connectDB();
  const doc = await User.findById(id).select("metierRoleSlugs role").lean();
  if (!doc) {
    return [];
  }
  return metierRoleSlugsForUser(doc);
}

/** Slugs relus en base (plusieurs rôles pris en compte). */
export async function liveSessionHasAnyRoleSlug(
  session: Session | null,
  requiredSlugs: readonly string[]
): Promise<boolean> {
  if (requiredSlugs.length === 0) {
    return true;
  }
  const live = await liveSessionRoleSlugs(session);
  const have = new Set(live.map((s) => normalizeRoleSlug(s)));
  return requiredSlugs.some((s) => have.has(normalizeRoleSlug(s)));
}

function sessionPermissionSet(session: Session | null): Set<string> {
  const list = session?.user?.permissions;
  if (!Array.isArray(list)) {
    return new Set();
  }
  return new Set(list);
}

export function sessionPermissions(session: Session | null): string[] {
  return [...sessionPermissionSet(session)].sort();
}

export function sessionHasAnyPermission(
  session: Session | null,
  required: readonly string[]
): boolean {
  if (required.length === 0) {
    return true;
  }
  const have = sessionPermissionSet(session);
  return required.some((k) => have.has(k));
}

export function sessionHasAllPermissions(
  session: Session | null,
  required: readonly string[]
): boolean {
  if (required.length === 0) {
    return true;
  }
  const have = sessionPermissionSet(session);
  return required.every((k) => have.has(k));
}

export function sessionIsAdministrator(session: Session | null): boolean {
  const u = session?.user;
  if (!u) {
    return false;
  }
  if (u.role === "admin") {
    return true;
  }
  return sessionHasAnyRoleSlug(session, [MONGO_ADMIN_ROLE_SLUG]);
}

export async function liveSessionHasAnyPermission(
  session: Session | null,
  required: readonly string[]
): Promise<boolean> {
  if (required.length === 0) {
    return true;
  }
  const id = session?.user?.id;
  if (!id) {
    return false;
  }
  const live = await resolvePermissionsForUserById(id);
  const have = new Set(live);
  return required.some((k) => have.has(k));
}

export async function liveSessionIsAdministrator(
  session: Session | null
): Promise<boolean> {
  const id = session?.user?.id;
  if (!id) {
    return false;
  }
  const { connectDB } = await import("@/lib/mongodb");
  const { User } = await import("@/lib/models/User");
  await connectDB();
  const doc = await User.findById(id).lean();
  if (!doc) {
    return false;
  }
  if (doc.role === "admin") {
    return true;
  }
  const slugs = await effectiveBaseRoleSlugsForUser(doc);
  return slugs.includes(MONGO_ADMIN_ROLE_SLUG);
}
