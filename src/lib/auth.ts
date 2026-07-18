import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";

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

if (!secret) {
  throw new Error(
    "NEXTAUTH_SECRET or SESSION_SECRET must be set to ensure secure sessions.",
  );
}

export const authOptions: NextAuthOptions = {
  secret: secret,
  providers,
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

export interface AuthenticatedPrincipal {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
}

export class AuthenticationError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthenticationError";
  }
}

export async function requireSession(): Promise<AuthenticatedPrincipal> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const userId = user?.id;

  if (!userId) {
    throw new AuthenticationError();
  }

  await prisma.user.upsert({
    where: { id: userId },
    update: {
      email: user.email ?? undefined,
      name: user.name ?? undefined,
    },
    create: {
      id: userId,
      email: user.email ?? undefined,
      name: user.name ?? undefined,
    },
  });

  return {
    user: {
      id: userId,
      email: user.email,
      name: user.name,
    },
  };
}
