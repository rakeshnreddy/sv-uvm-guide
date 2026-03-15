import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const providers: NextAuthOptions['providers'] = [];

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  );
} else {
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      "Google OAuth credentials are not configured. The placeholder credentials provider will be used instead.",
    );
  }

  providers.push(
    CredentialsProvider({
      id: 'placeholder',
      name: 'Placeholder',
      credentials: {},
      // Always return null so sign-in attempts fail gracefully without crashing NextAuth.
      authorize: async () => null,
    }),
  );
}

const secret = process.env.NEXTAUTH_SECRET ?? process.env.SESSION_SECRET;

if (!secret && process.env.NODE_ENV === 'production') {
  throw new Error(
    "NEXTAUTH_SECRET or SESSION_SECRET must be set in production to ensure secure sessions.",
  );
}

const authOptions: NextAuthOptions = {
  secret: secret ?? 'development-nextauth-secret',
  providers,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
