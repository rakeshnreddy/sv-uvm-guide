"use client";
import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  useKeyboardShortcuts();

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;
