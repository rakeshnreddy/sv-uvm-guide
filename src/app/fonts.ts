import localFont from "next/font/local";

/**
 * Centralized font loading for the application shell.
 *
 * We prefer local assets for determinism while still
 * relying on `next/font` so class names and fallbacks
 * stay optimized at build-time.
 */
export const inter = localFont({
  src: [
    {
      path: "../../public/fonts/inter/inter-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/inter/inter-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: true,
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

export const calSans = localFont({
  src: "../../public/fonts/CalSans-SemiBold.otf",
  variable: "--font-cal-sans",
  weight: "600",
  display: "swap",
  preload: true,
});
