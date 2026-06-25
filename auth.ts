import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;

        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existing.length > 0) {
          if (!existing[0].password_hash) return null;
          const valid = await bcrypt.compare(password, existing[0].password_hash);
          if (!valid) return null;
          return {
            id: existing[0].id,
            name: existing[0].name!,
            email: existing[0].email!,
            role: existing[0].role!,
          };
        }

        return null;
      },
    }),
    Credentials({
      id: "admin-login",
      name: "admin",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string;
        const password = credentials?.password as string;
        if (
          username === process.env.ADMIN_USERNAME &&
          password === process.env.ADMIN_PASSWORD
        ) {
          let existing = await db
            .select()
            .from(users)
            .where(eq(users.email, "admin@adsuploader.app"))
            .limit(1);
          if (existing.length === 0) {
            const created = await db
              .insert(users)
              .values({ name: "Admin", email: "admin@adsuploader.app", role: "admin" })
              .returning();
            existing = created;
          }
          return { id: existing[0].id, name: existing[0].name!, email: existing[0].email!, role: existing[0].role! };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, trigger, session }) {
      if (token.email) {
        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, token.email))
          .limit(1);
        if (user.length > 0) {
          token.userId = user[0].id;
          token.role = user[0].role;
        }
      }
      if (trigger === "update" && session?.role) {
        token.role = session.role;
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.userId as string,
          role: token.role as string,
        },
      };
    },
  },
  pages: {
    signIn: "/login",
  },
});
