import type { Metadata } from "next";
import localFont from 'next/font/local';

// Use local copies of fonts from @fontsource to avoid network issues
const inter = localFont({
  src: [
    {
      path: '../../public/fonts/inter/inter-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/inter/inter-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains_mono = localFont({
  src: [
    {
      path: '../../public/fonts/jetbrains-mono/jetbrains-mono-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/jetbrains-mono/jetbrains-mono-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});
// Import AnimatePresence from the client component provider
import { AnimatePresence } from '@/components/providers/FramerMotionProvider';
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";
// Navbar and Footer are now part of MainLayout
import MainLayout from "@/components/layout/MainLayout"; // Corrected Import MainLayout path
import { SessionProvider } from '@/components/providers/SessionProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import Sidebar from '@/components/layout/Sidebar';
// The AIAssistant (full chat) is removed from global layout for now.
// The PersistentAITutorButton will be the global widget.
// import AIAssistant from "@/components/ai/AIAssistant";
import AIAssistantWidget from "@/components/widgets/AIAssistantWidget";


// Assuming Cal Sans will be a local font file
const calSans = localFont({
  src: '../../public/fonts/CalSans-SemiBold.otf',
  variable: '--font-cal-sans',
  weight: '600',
  display: 'swap',
});

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
      <body className={`${inter.variable} ${jetbrains_mono.variable} ${calSans.variable} font-sans`}>
        <ThemeProvider attribute="data-theme" defaultTheme="default-dark" disableTransitionOnChange>
          <SessionProvider>
            <AuthProvider>
              <NavigationProvider>
                <Sidebar />
                <MainLayout>{children}</MainLayout>
                <AIAssistantWidget />
              </NavigationProvider>
            </AuthProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
