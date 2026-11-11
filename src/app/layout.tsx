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
    // The image is the static opengraph-image.png beside this file (with its .alt.txt), which Next.js adds itself.
  },
  // The large card shows twitter-image.png (also a static file here); favicon.ico, icon.svg, icon1.png,
  // icon2.png and apple-icon.png are the app icons. scripts/generate-brand-images.mjs makes all of them.
  // No twitter title or description: X then takes each page's own og:title and og:description, so a
  // lesson shares as that lesson rather than as the site.
  twitter: {
    card: "summary_large_image",
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
