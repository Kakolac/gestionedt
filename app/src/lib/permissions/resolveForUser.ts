import { connectDB } from "@/lib/mongodb";
import { MetierRole } from "@/lib/models/MetierRole";
import { Role } from "@/lib/models/Role";
import { User, type UserDoc } from "@/lib/models/User";

function normalizeSlug(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Slugs de rôles **de base** attribués directement (`users.roleSlugs` + repli sur `role`).
 * Ne inclut **pas** l’expansion des rôles métier.
 */
export function roleSlugsForUser(user: {
  role: string;
  roleSlugs?: string[] | null;
}): string[] {
  const raw = user.roleSlugs?.filter(Boolean) ?? [];
  const normalized = raw.map((s) => normalizeSlug(s)).filter(Boolean);
  if (normalized.length > 0) {
    return [...new Set(normalized)];
  }
  if (user.role === "admin" || user.role === "user") {
    return [user.role];
  }
  return [];
}

/** Slugs de rôles métier normalisés (`users.metierRoleSlugs`), sans expansion. */
export function metierRoleSlugsForUser(user: {
  metierRoleSlugs?: string[] | null;
}): string[] {
  const raw = user.metierRoleSlugs?.filter(Boolean) ?? [];
  const normalized = raw.map((s) => normalizeSlug(s)).filter(Boolean);
  return [...new Set(normalized)];
}

/**
 * Slugs de rôles **de base** effectifs : rôles de base directs **∪** rôles de base
 * issus de l’expansion des rôles métier (mix autorisé).
 */
export async function effectiveBaseRoleSlugsForUser(
  user: Pick<UserDoc, "role" | "roleSlugs" | "metierRoleSlugs">
): Promise<string[]> {
  await connectDB();
  const direct = roleSlugsForUser(user);
  const mSlugs = metierRoleSlugsForUser(user);
  if (mSlugs.length === 0) {
    return [...direct].sort();
  }
  const metiers = await MetierRole.find({ slug: { $in: mSlugs } }).lean();
  const fromMetier = new Set<string>();
  for (const m of metiers) {
    for (const b of m.baseRoleSlugs ?? []) {
      if (typeof b === "string") {
        const n = normalizeSlug(b);
        if (n) {
          fromMetier.add(n);
        }
      }
    }
  }
  const set = new Set<string>([...direct, ...fromMetier]);
  return [...set].sort();
}

/**
 * Union triée des permissions Mongo pour les slugs de base effectifs
 * (`effectiveBaseRoleSlugsForUser`).
 */
export async function resolvePermissionsForUserDoc(
  user: Pick<UserDoc, "role" | "roleSlugs" | "metierRoleSlugs">
): Promise<string[]> {
  await connectDB();
  const slugs = await effectiveBaseRoleSlugsForUser(user);
  if (slugs.length === 0) {
    return [];
  }
  const roles = await Role.find({ slug: { $in: slugs } }).lean();
  const set = new Set<string>();
  for (const r of roles) {
    for (const p of r.permissions ?? []) {
      set.add(p);
    }
  }
  return [...set].sort();
}

export async function resolvePermissionsForUserById(
  userId: string
): Promise<string[]> {
  await connectDB();
  const doc = await User.findById(userId).lean();
  if (!doc) {
    return [];
  }
  return resolvePermissionsForUserDoc(doc);
}
