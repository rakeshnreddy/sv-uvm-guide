import { ThemeProvider } from "@/components/providers/ThemeProvider";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="default-dark" disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
