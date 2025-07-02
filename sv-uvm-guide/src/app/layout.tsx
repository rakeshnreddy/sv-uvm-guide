import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import localFont from 'next/font/local';
import { AnimatePresence } from 'framer-motion'; // Import AnimatePresence
import "./globals.css";
// Navbar and Footer are now part of MainLayout
import MainLayout from "@/components/layout/MainLayout"; // Import MainLayout
import { AuthProvider } from "@/contexts/AuthContext";
// The AIAssistant (full chat) is removed from global layout for now.
// The PersistentAITutorButton will be the global widget.
// import AIAssistant from "@/components/ai/AIAssistant";
import PersistentAITutorButton from "@/components/ai/PersistentAITutorButton"; // Import the new button

const inter = Inter({
  subsets: ["latin"],
  variable: '--font-inter', // CSS variable
});

const jetbrains_mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono', // CSS variable
});

// Assuming Cal Sans will be a local font file
const calSans = localFont({
  src: '../../public/fonts/CalSans-SemiBold.otf', // Adjust path as needed
  variable: '--font-cal-sans', // CSS variable
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
      <body className={`${inter.variable} ${jetbrains_mono.variable} ${calSans.variable} font-body bg-background text-primary-text transition-colors duration-300`}>
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
