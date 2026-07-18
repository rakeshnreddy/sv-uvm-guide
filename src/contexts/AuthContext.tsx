"use client";

import type { ReactNode } from "react";
import { signOut as signOutSession, useSession } from "next-auth/react";

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

export function useAuth(): AuthContextValue {
  const { data, status } = useSession();
  const sessionUser = data?.user;
  const user = sessionUser?.id
    ? {
        uid: sessionUser.id,
        isAnonymous: false as const,
        displayName: sessionUser.name,
      }
    : null;

  return {
    user,
    loading: status === "loading",
    signOut: async () => {
      await signOutSession({ redirect: false });
    },
  };
}
