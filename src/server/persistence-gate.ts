import "server-only";

/**
 * The server-side gate for accounts: whether this deploy can sign learners in
 * and keep their records on the server.
 *
 * Server only. The `server-only` import above makes any client module that
 * imports this file fail the build (Next aliases it per layer; vitest aliases
 * it to an empty module). It deliberately imports nothing from '@/lib/auth' or
 * '@/lib/prisma': callers check the gate first and load auth lazily only when
 * it is open, so an unconfigured deploy never evaluates the auth module.
 */
import { ACCOUNTS_ENABLED } from "@/lib/persistence/accounts";

/** The environment variables the gate reads. process.env satisfies it. */
export type PersistenceGateEnv = Readonly<Record<string, string | undefined>>;

function isSet(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * True when a real sign-in provider is configured: Google OAuth keys, or the
 * token-gated test identity, which src/lib/auth.ts registers only outside
 * production when AUTH_TEST_MODE is 'true'.
 */
export function hasSignInProvider(env: PersistenceGateEnv = process.env): boolean {
  const google = isSet(env.GOOGLE_CLIENT_ID) && isSet(env.GOOGLE_CLIENT_SECRET);
  const testIdentity = env.NODE_ENV !== "production" && env.AUTH_TEST_MODE === "true";
  return google || testIdentity;
}

/**
 * True only when every piece accounts need is present:
 * - accountsEnabled, the build-time ACCOUNTS_ENABLED switch
 *   (NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI) by default;
 * - DATABASE_URL;
 * - a real sign-in provider (see hasSignInProvider);
 * - NEXTAUTH_SECRET or SESSION_SECRET.
 *
 * Both parameters are explicit so tests, and callers that already hold the
 * Worker env, can pass their own values. The environment is read on every
 * call, at request time.
 */
export function isServerPersistenceConfigured(
  env: PersistenceGateEnv = process.env,
  accountsEnabled: boolean = ACCOUNTS_ENABLED,
): boolean {
  return (
    accountsEnabled
    && isSet(env.DATABASE_URL)
    && hasSignInProvider(env)
    && (isSet(env.NEXTAUTH_SECRET) || isSet(env.SESSION_SECRET))
  );
}
