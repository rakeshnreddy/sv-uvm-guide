import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer"; // Will be created

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
      <body className={`${inter.className} bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300`}>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          {/* <header className="h-16 bg-gray-200 dark:bg-gray-800"> {/* Placeholder for Navbar */}
          {/*  <p className="p-4">Navbar Placeholder</p> */}
          {/* </header> */}
          <main className="flex-grow container mx-auto px-4 py-8">
            {children}
          </main>
          <Footer />
          {/* <footer className="h-12 bg-gray-200 dark:bg-gray-800"> {/* Placeholder for Footer */}
          {/*  <p className="p-4 text-center">Footer Placeholder</p> */}
          {/* </footer> */}
        </div>
      </body>
    </html>
  );
}
