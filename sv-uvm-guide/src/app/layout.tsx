import type { Metadata } from "next";
import localFont from 'next/font/local';

// Use local copies of fonts from @fontsource to avoid network issues
const inter = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2',
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
      path: '../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});
// Import AnimatePresence from the client component provider
import { AnimatePresence } from '@/app/components/providers/FramerMotionProvider';
import "./globals.css";
// Navbar and Footer are now part of MainLayout
import MainLayout from "@/app/components/layout/MainLayout"; // Corrected Import MainLayout path
import { AuthProvider } from "@/contexts/AuthContext";
// The AIAssistant (full chat) is removed from global layout for now.
// The PersistentAITutorButton will be the global widget.
// import AIAssistant from "@/components/ai/AIAssistant";
import PersistentAITutorButton from "@/app/components/ai/PersistentAITutorButton"; // Corrected Import path


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
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrains_mono.variable} ${calSans.variable} font-body bg-background text-brand-text-primary transition-colors duration-300`}>
        <AuthProvider>
          <AnimatePresence mode="wait">
            {/* MainLayout now wraps the children and includes Header/Footer */}
            {/* We might need to pass a key here if children can change in a way AnimatePresence needs to track */}
            <MainLayout>{children}</MainLayout>
          </AnimatePresence>
          <PersistentAITutorButton /> {/* Add Persistent AI Tutor Button globally */}
        </AuthProvider>
      </body>
    </html>
  );
}
