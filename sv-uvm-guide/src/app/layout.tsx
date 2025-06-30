import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/contexts/AuthContext";
import AIAssistant from "@/components/ai/AIAssistant"; // Import AI Assistant

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} bg-background text-foreground transition-colors duration-300`}>
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-grow container mx-auto px-4 py-8">
              {children}
            </main>
            <Footer />
            <AIAssistant /> {/* Add AI Assistant globally */}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
