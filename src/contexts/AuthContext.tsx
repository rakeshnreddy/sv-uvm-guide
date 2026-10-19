"use client";

/**
 * The one identity entry point for components: call useAuth(), never
 * next-auth's useSession.
 *
 * The implementation is chosen once, at module level, from the build-time
 * ACCOUNTS_ENABLED switch (NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI):
 * - Accounts off (this deploy): useAuth returns a frozen module-level constant,
 *   {user: null, loading: false, signOut: no-op}. It never calls useSession,
 *   so ClientProviders mounts no SessionProvider and nothing requests
 *   /api/auth/*.
 * - Accounts on: useAuth maps next-auth's session (SessionProvider is mounted
 *   by ClientProviders) and memoises the result, so the user object keeps its
 *   identity while the session does not change.
 *
 * Only this module, src/lib/persistence/target.ts and
 * src/components/providers/SessionProvider.tsx may import 'next-auth/react'.
 * The no-restricted-imports rule in .eslintrc.json enforces that.
 */
import { useMemo, type ReactNode } from "react";
import { signOut as signOutSession, useSession } from "next-auth/react";

import { ACCOUNTS_ENABLED } from "@/lib/persistence/accounts";

interface AuthUser {
  uid: string;
  isAnonymous: false;
  displayName?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

// Kept as a compatibility boundary for existing call sites. SessionProvider is
// the only identity provider; this component deliberately owns no auth state.
export function AuthProvider({ children }: { children: ReactNode }) {
  return children;
}

// --- Accounts off ----------------------------------------------------------

const ANONYMOUS_AUTH: AuthContextValue = Object.freeze({
  user: null,
  loading: false,
  signOut: async () => {},
});

function useAnonymousAuth(): AuthContextValue {
  return ANONYMOUS_AUTH;
}

// --- Accounts on -----------------------------------------------------------

async function signOutOfSession(): Promise<void> {
  await signOutSession({ redirect: false });
}

function useSessionAuth(): AuthContextValue {
  const { data, status } = useSession();
  const userId = data?.user?.id;
  const displayName = data?.user?.name;
  const loading = status === "loading";

  const user = useMemo<AuthUser | null>(
    () => (userId ? { uid: userId, isAnonymous: false, displayName } : null),
    [userId, displayName],
  );

  return useMemo(() => ({ user, loading, signOut: signOutOfSession }), [user, loading]);
}

// --- The hook --------------------------------------------------------------

/** {user, loading, signOut}: a signed-out constant with accounts off; otherwise the mapped next-auth session. */
export const useAuth: () => AuthContextValue = ACCOUNTS_ENABLED ? useSessionAuth : useAnonymousAuth;
