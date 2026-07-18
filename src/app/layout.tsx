import type { Metadata } from "next";

import { env } from "@/lib/env";

import { calSans, inter, jetBrainsMono } from "./fonts";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetBrainsMono.variable} ${calSans.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
