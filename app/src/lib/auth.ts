import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/models/User";
import {
  effectiveBaseRoleSlugsForUser,
  metierRoleSlugsForUser,
  resolvePermissionsForUserDoc,
} from "@/lib/permissions/resolveForUser";

function getAuthSecret(): string {
  const secret =
    process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  if (secret) {
    return secret;
  }

  /** Pendant `next build`, Next exécute du code serveur avec NODE_ENV=production sans secret. */
  const phase = process.env["NEXT_PHASE"];
  if (phase === "phase-production-build") {
    return "build-placeholder-not-used-at-runtime";
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET (ou NEXTAUTH_SECRET) est obligatoire en production."
    );
  }
  console.warn(
    "[auth] AUTH_SECRET absent : utilisation d’un secret de développement (à définir en .env.local)."
  );
  return "dev-only-secret-change-me";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: getAuthSecret(),
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/connexion",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (
          typeof email !== "string" ||
          typeof password !== "string" ||
          !email.trim() ||
          !password
        ) {
          return null;
        }

        await connectDB();
        const user = await User.findOne({ email: email.trim().toLowerCase() })
          .select("+passwordHash")
          .lean();

        if (!user?.passwordHash) {
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          return null;
        }

        const permissions = await resolvePermissionsForUserDoc(user);
        const roleSlugs = await effectiveBaseRoleSlugsForUser(user);
        const metierRoleSlugs = metierRoleSlugsForUser(user);

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name ?? "",
          role: user.role,
          roleSlugs,
          metierRoleSlugs,
          permissions,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user && "role" in user && user.role) {
        token.sub = user.id ?? token.sub;
        token.id = user.id;
        token.role = user.role;
        token.roleSlugs = user.roleSlugs ?? [];
        token.metierRoleSlugs = user.metierRoleSlugs ?? [];
        token.permissions = user.permissions ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.role = (token.role as "admin" | "user") ?? "user";
        session.user.roleSlugs = (token.roleSlugs as string[]) ?? [];
        session.user.metierRoleSlugs =
          (token.metierRoleSlugs as string[]) ?? [];
        session.user.permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
});
