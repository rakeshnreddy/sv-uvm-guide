import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { calSans, inter, jetBrainsMono } from "./fonts";
import "./globals.css";
// Navbar and Footer are now part of MainLayout
import MainLayout from "@/components/layout/MainLayout"; // Corrected Import MainLayout path
import { SessionProvider } from "@/components/providers/SessionProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { NavigationProvider } from "@/contexts/NavigationContext";
import Sidebar from "@/components/layout/Sidebar";
import KeyboardShortcuts from "@/components/layout/KeyboardShortcuts";
// The AIAssistant (full chat) is removed from global layout for now.
// The PersistentAITutorButton will be the global widget.
// import AIAssistant from "@/components/ai/AIAssistant";
import AIAssistantWidget from "@/components/widgets/AIAssistantWidget";


export const metadata: Metadata = {
  title: "SystemVerilog & UVM Mastery",
  description: "The definitive online platform for mastering SystemVerilog and UVM.",
  openGraph: {
    title: "SystemVerilog & UVM Mastery",
    description: "The definitive online platform for mastering SystemVerilog and UVM.",
    url: "https://example.com",
    siteName: "SV/UVM Hub",
    locale: "en_US",
    type: "website",
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetBrainsMono.variable} ${calSans.variable} font-sans`}>
        <ThemeProvider attribute="data-theme" defaultTheme="default-dark" disableTransitionOnChange>
          <SessionProvider>
            <AuthProvider>
              <NavigationProvider>
                <Sidebar />
                <MainLayout>{children}</MainLayout>
                <AIAssistantWidget />
                <KeyboardShortcuts />
              </NavigationProvider>
            </AuthProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
