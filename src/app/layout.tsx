import type { Metadata, Viewport } from "next";

import { env } from "@/lib/env";

import { jetBrainsMono, plexSans, plexSansGreek } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: {
    default: "SystemVerilog & UVM Mastery",
    template: "%s | SV/UVM Mastery",
  },
  description: "The definitive online platform for mastering SystemVerilog and UVM.",
  openGraph: {
    title: "SystemVerilog & UVM Mastery",
    description: "The definitive online platform for mastering SystemVerilog and UVM.",
    url: "/",
    siteName: "SV/UVM Mastery",
    locale: "en_US",
    type: "website",
  },
};

// Browser chrome on phones matches the page: the --background value of each mode (globals.css).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1016" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plexSans.variable} ${plexSansGreek.variable} ${jetBrainsMono.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
