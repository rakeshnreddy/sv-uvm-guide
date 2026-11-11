import { PageField } from "@/components/layout/PageField";
import PublicHeader from "@/components/layout/PublicHeader";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

/**
 * The landing, privacy and terms pages: the slim public header (with the theme
 * control) above each page, and the four-tier colour field behind the top. The
 * wrapper is `relative isolate` so the field sits behind everything in it.
 * Nothing here animates with a library, so there is no motion provider: the
 * pages' few CSS transitions honour prefers-reduced-motion themselves.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="relative isolate">
        <PageField variant="all" />
        <PublicHeader />
        {children}
      </div>
    </ThemeProvider>
  );
}
