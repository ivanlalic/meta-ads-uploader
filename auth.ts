import NextAuth from "next-auth";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users, accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Facebook({
      clientId: process.env.META_APP_ID!,
      clientSecret: process.env.META_APP_SECRET!,
      authorization: {
        params: {
          scope: "ads_management,ads_read,pages_read_engagement,pages_manage_ads,business_management",
        },
      },
    }),
    Credentials({
      name: "credentials",
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
    async signIn({ account, profile }) {
      if (account?.provider === "facebook" && profile) {
        const email = `fb_${profile.id}@facebook.com`;
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (existing.length === 0) {
          await db.insert(users).values({
            name: profile.name as string,
            email,
            image: profile.image as string | undefined,
            role: "user",
          });
        }
      }
      return true;
    },
    async jwt({ token, account, trigger, session }) {
      if (account) {
        token.accessToken = account.access_token;
        token.accessTokenExpiresAt = account.expires_at;
      }
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
      session.accessToken = token.accessToken as string;
      session.user = {
        ...session.user,
        id: token.userId as string,
        role: token.role as string,
      };
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth" {
  interface JWT {
    accessToken?: string;
    accessTokenExpiresAt?: number;
    userId?: string;
    role?: string;
  }
}
