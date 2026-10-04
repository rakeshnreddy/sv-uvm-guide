import { ReducedMotionProvider } from "@/components/providers/ReducedMotionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="default-dark" disableTransitionOnChange>
      <ReducedMotionProvider>{children}</ReducedMotionProvider>
    </ThemeProvider>
  );
}
