import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth/next";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const providers: NextAuthOptions['providers'] = [];
const testAuthEnabled = process.env.NODE_ENV !== "production" && process.env.AUTH_TEST_MODE === "true";

function matchesTestToken(candidate: unknown): boolean {
  const expected = process.env.AUTH_TEST_TOKEN;
  if (typeof candidate !== "string" || !expected) return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length
    && timingSafeEqual(candidateBuffer, expectedBuffer);
}

if (testAuthEnabled) {
  providers.push(
    CredentialsProvider({
      id: "test-credentials",
      name: "Automated test identity",
      credentials: {
        token: { label: "Test token", type: "password" },
        identity: { label: "Test identity", type: "text" },
      },
      authorize: async (credentials) => {
        if (!matchesTestToken(credentials?.token)) return null;
        const identity = typeof credentials?.identity === "string"
          && /^[a-f0-9-]{36}$/.test(credentials.identity)
          ? credentials.identity
          : "default";
        return {
          id: `e2e-learner-${identity}`,
          email: `e2e-learner-${identity}@example.test`,
          name: "E2E Learner",
        };
      },
    }),
  );
} else if (googleClientId && googleClientSecret) {
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
