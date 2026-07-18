"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { NavigationProvider } from "@/contexts/NavigationContext";

import { SessionProvider } from "./SessionProvider";
import { ThemeProvider } from "./ThemeProvider";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="default-dark" disableTransitionOnChange>
      <SessionProvider>
        <AuthProvider>
          <NavigationProvider>{children}</NavigationProvider>
        </AuthProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
