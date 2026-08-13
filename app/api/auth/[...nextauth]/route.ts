import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const hasGoogleAuth = !!(
  googleClientId && 
  googleClientSecret && 
  !googleClientId.includes("your_google_client_id")
);

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "cryptoskope_secret_key_default_32_characters_long",
  providers: [
    ...(hasGoogleAuth
      ? [
          GoogleProvider({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
          }),
        ]
      : []),
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize() {
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session?.user && token?.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

async function authHandler(req: any, context: any) {
  try {
    const url = new URL(req.url);
    if (!req.nextUrl) {
      req.nextUrl = url;
    }
    const rawParams = context?.params ? await context.params : null;
    const nextauth = (rawParams?.nextauth && rawParams.nextauth.length > 0)
      ? rawParams.nextauth
      : url.pathname.replace(/^\/api\/auth\/?/, '').split('/').filter(Boolean);

    return await handler(req, { ...context, params: { nextauth } });
  } catch (error) {
    console.error("Error in NextAuth route handler:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export { authHandler as GET, authHandler as POST };


 