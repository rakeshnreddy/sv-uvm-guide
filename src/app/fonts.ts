import localFont from "next/font/local";

/**
 * Centralized font loading for the application shell.
 *
 * Self-hosted files (from @fontsource, see public/fonts/<family>/) loaded with
 * `next/font/local`, so class names and fallbacks stay optimized at build time.
 *
 * - IBM Plex Sans sets all interface text and lesson prose (400, 400 italic,
 *   500 and 600; nothing in the sans face renders above 600).
 * - The Greek subset is a separate family that sits second in the sans stack
 *   (tailwind.config.ts), so Δ, δ, Σ, λ and Π in delta-cycle notation render
 *   in Plex too. Its unicode-range keeps the browser from downloading it on
 *   pages without Greek. Arrows, math and box-drawing symbols are in neither
 *   subset and render in the system face.
 * - JetBrains Mono sets code, signal tags, counts and keycaps.
 */
export const plexSans = localFont({
  src: [
    {
      path: "../../public/fonts/ibm-plex-sans/ibm-plex-sans-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/ibm-plex-sans/ibm-plex-sans-latin-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/ibm-plex-sans/ibm-plex-sans-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/ibm-plex-sans/ibm-plex-sans-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-plex-sans",
  display: "swap",
  preload: true,
  // No generated metric fallback: it is a local Arial face, and Arial has Greek
  // glyphs, so it would catch Δ before the Greek Plex face later in the stack.
  adjustFontFallback: false,
});

export const plexSansGreek = localFont({
  src: [
    {
      path: "../../public/fonts/ibm-plex-sans/ibm-plex-sans-greek-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/ibm-plex-sans/ibm-plex-sans-greek-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/ibm-plex-sans/ibm-plex-sans-greek-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-plex-sans-greek",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF" },
  ],
});

export const jetBrainsMono = localFont({
  src: [
    {
      path: "../../public/fonts/jetbrains-mono/jetbrains-mono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/jetbrains-mono/jetbrains-mono-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: true,
});
