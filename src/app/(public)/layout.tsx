import PublicHeader from "@/components/layout/PublicHeader";
import { ReducedMotionProvider } from "@/components/providers/ReducedMotionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

/** The landing, privacy and terms pages: the slim public header (with the theme control) above each page. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ReducedMotionProvider>
        <PublicHeader />
        {children}
      </ReducedMotionProvider>
    </ThemeProvider>
  );
}
