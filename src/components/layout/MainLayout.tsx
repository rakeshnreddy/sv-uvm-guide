"use client";
import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <header style={{ border: "2px solid red" }}>
        <Navbar />
      </header>
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer style={{ border: "2px solid blue" }}>
        <Footer />
      </footer>
    </div>
  );
};

export default MainLayout;
