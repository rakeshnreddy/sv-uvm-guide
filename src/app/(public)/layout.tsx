import { PageField } from "@/components/layout/PageField";
import PublicHeader from "@/components/layout/PublicHeader";
import { ReducedMotionProvider } from "@/components/providers/ReducedMotionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

/**
 * The landing, privacy and terms pages: the slim public header (with the theme
 * control) above each page, and the four-tier colour field behind the top. The
 * wrapper is `relative isolate` so the field sits behind everything in it.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ReducedMotionProvider>
        <div className="relative isolate">
          <PageField variant="all" />
          <PublicHeader />
          {children}
        </div>
      </ReducedMotionProvider>
    </ThemeProvider>
  );
}
