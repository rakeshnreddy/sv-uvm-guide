import type { Metadata, Viewport } from "next";

import { getHomeStats } from "@/components/home/home-stats";
import { curriculumData } from "@/lib/curriculum-data";
import { env } from "@/lib/env";
import { getAllLabs } from "@/lib/lab-registry";
import { SITE_NAME, SITE_TITLE_DEFAULT, SITE_TITLE_TEMPLATE } from "@/lib/site-links";

import { jetBrainsMono, plexSans, plexSansGreek } from "./fonts";
import "./globals.css";

// What the site is, with the counts the landing page states, taken from the curriculum and the lab registry.
const { lessonCount, tierCount, labCount } = getHomeStats(curriculumData, getAllLabs());
const SITE_DESCRIPTION = `A free SystemVerilog, UVM and AMBA verification course: ${lessonCount} lessons in ${tierCount} tiers, ${labCount} guided labs, interactive models and interview prep, with your progress kept in your browser.`;

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: {
    default: SITE_TITLE_DEFAULT,
    template: SITE_TITLE_TEMPLATE,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
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
