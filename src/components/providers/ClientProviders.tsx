"use client";

import { AuthProvider } from "@/contexts/AuthContext";

import { ReducedMotionProvider } from "./ReducedMotionProvider";
import { SessionProvider } from "./SessionProvider";
import { ThemeProvider } from "./ThemeProvider";

// The shell's open/closed state (outline, search, menu) lives in
// src/components/search/shell-store.ts, an external store that needs no provider.
export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="default-dark" disableTransitionOnChange>
      <SessionProvider>
        <AuthProvider>
          <ReducedMotionProvider>{children}</ReducedMotionProvider>
        </AuthProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
