import React from "react";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { RoutePageField } from "@/components/layout/PageField";
import Sidebar from "@/components/layout/Sidebar";
import { PAGE_FRAME_CLASS } from "@/components/layout/nav-styles";
import { MAIN_CONTENT_ID } from "@/components/search/focus-target";
import SkipLink from "@/components/search/SkipLink";
import { cn } from "@/lib/utils";

/**
 * Learning-page frame: skip link, navbar, the course outline (docked beside
 * lessons at lg and wider), one `main` landmark, and the footer. The outline
 * stays outside `main`, so `main nav` still means the lesson's own Prev/Next
 * navigation (several e2e specs select it that way).
 *
 * The page sits in PAGE_FRAME_CLASS, the frame the navbar also uses, so the
 * header's edges line up with the page's at every width.
 *
 * The root is `relative isolate` so the colour field (RoutePageField: the
 * lesson's tier at header size on lesson pages, all four tiers elsewhere) sits
 * behind every child and above the body colour.
 */
const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <RoutePageField />
      <SkipLink />
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          <div className={cn(PAGE_FRAME_CLASS, "py-8")} data-page-frame>
            {children}
          </div>
        </main>
      </div>
      <Footer showShortcuts frame="learning" />
    </div>
  );
};

export default MainLayout;
