import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: "admin" | "user";
    /** Slugs de rôles de base effectifs (après expansion des rôles métier). */
    roleSlugs?: string[];
    /** Slugs de rôles métier attribués tels quels (avant expansion). */
    metierRoleSlugs?: string[];
    permissions?: string[];
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "admin" | "user";
      roleSlugs: string[];
      metierRoleSlugs: string[];
      permissions: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "admin" | "user";
    roleSlugs?: string[];
    metierRoleSlugs?: string[];
    permissions?: string[];
  }
}
