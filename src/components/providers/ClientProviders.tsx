"use client";

import React from "react";

import { AuthProvider } from "@/contexts/AuthContext";
import { ACCOUNTS_ENABLED } from "@/lib/persistence/accounts";

import { ReducedMotionProvider } from "./ReducedMotionProvider";
import { SessionProvider } from "./SessionProvider";
import { ThemeProvider } from "./ThemeProvider";

// The shell's open/closed state (outline, search, menu) lives in
// src/components/search/shell-store.ts, an external store that needs no provider.
//
// SessionProvider is mounted only when accounts are on (the build-time
// ACCOUNTS_ENABLED switch). It requests /api/auth/session on mount and on every
// tab focus, so the anonymous deploy leaves it out entirely; useAuth() and the
// hooks in src/lib/persistence/target.ts then never call useSession.
export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const content = (
    <AuthProvider>
      <ReducedMotionProvider>{children}</ReducedMotionProvider>
    </AuthProvider>
  );

  return (
    <ThemeProvider attribute="data-theme" defaultTheme="default-dark" disableTransitionOnChange>
      {ACCOUNTS_ENABLED ? <SessionProvider>{content}</SessionProvider> : content}
    </ThemeProvider>
  );
}
