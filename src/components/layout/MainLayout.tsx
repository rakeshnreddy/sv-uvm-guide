import React from "react";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { MAIN_CONTENT_ID } from "@/components/search/focus-target";
import SkipLink from "@/components/search/SkipLink";

/**
 * Learning-page frame: skip link, navbar, the course outline (docked beside
 * lessons at lg and wider), one `main` landmark, and the footer. The outline
 * stays outside `main`, so `main nav` still means the lesson's own Prev/Next
 * navigation (several e2e specs select it that way).
 */
const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
      <Footer showShortcuts />
    </div>
  );
};

export default MainLayout;
