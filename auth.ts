import NextAuth from "next-auth";
import Facebook from "next-auth/providers/facebook";

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
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.accessTokenExpiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
  pages: {
    signIn: "/connect",
  },
});

declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}
