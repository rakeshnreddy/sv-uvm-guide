/**
 * The site's social card, for pages that set their own `openGraph` object.
 * Next.js adds src/app/opengraph-image.png (a static file made by
 * scripts/generate-brand-images.mjs) to the root metadata, but a page that
 * defines `openGraph` replaces the root object and with it the image, so the
 * lesson and lab pages name it again here. The alt text matches
 * src/app/opengraph-image.alt.txt (a test keeps them in step).
 */
export const SOCIAL_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "SV/UVM Hub: SystemVerilog and UVM, one clock edge at a time. The mark, a single clock pulse, on the course's colour field.",
} as const;
