import type { Config } from "tailwindcss";

/** A colour role from globals.css that keeps Tailwind's opacity modifier (`bg-success/10`). */
const role = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

/*
 * Lesson prose reads every colour from the role tokens, in both modes, so
 * `dark:prose-invert` is not needed (the invert variables point at the same
 * tokens, which makes the class harmless where it is still used).
 */
const proseColours = {
  body: "hsl(var(--foreground))",
  headings: "hsl(var(--foreground))",
  lead: "hsl(var(--muted-foreground))",
  links: "hsl(var(--primary))",
  bold: "hsl(var(--foreground))",
  counters: "hsl(var(--muted-foreground))",
  bullets: "hsl(var(--subtle-foreground))",
  hr: "hsl(var(--border))",
  quotes: "hsl(var(--muted-foreground))",
  "quote-borders": "hsl(var(--border))",
  captions: "hsl(var(--subtle-foreground))",
  kbd: "hsl(var(--foreground))",
  // An RGB triplet: the plugin wraps it in rgb(... / 10%).
  "kbd-shadows": "16 24 40",
  code: "hsl(var(--foreground))",
  // Code blocks stay dark in both modes (DESIGN.md section 3).
  "pre-code": "hsl(var(--code-foreground))",
  "pre-bg": "hsl(var(--code-surface))",
  "th-borders": "hsl(var(--border))",
  "td-borders": "hsl(var(--border))",
};

/** text-tier-1 … text-tier-4 with their -subtle fills and -border tints (globals.css). */
function tierColours(): Record<string, string> {
  return Object.fromEntries(
    [1, 2, 3, 4].flatMap((tier) => [
      [String(tier), role(`tier-${tier}`)],
      [`${tier}-subtle`, `var(--tier-${tier}-subtle)`],
      [`${tier}-border`, `var(--tier-${tier}-border)`],
    ]),
  );
}

const proseVariables =Object.fromEntries(
  Object.entries(proseColours).flatMap(([key, value]) => [
    [`--tw-prose-${key}`, value],
    [`--tw-prose-invert-${key}`, value],
  ]),
);

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    // Lessons use Tailwind classes in JSX blocks; without this they are never generated.
    "./content/**/*.mdx",
  ],
  // next-themes sets data-theme before first paint, so dark: styles apply before hydration.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        border: role("border"),
        input: role("input"),
        ring: role("ring"),
        background: role("background"),
        foreground: role("foreground"),
        primary: {
          DEFAULT: role("primary"),
          foreground: role("primary-foreground"),
        },
        secondary: {
          DEFAULT: role("secondary"),
          foreground: role("secondary-foreground"),
        },
        destructive: {
          DEFAULT: role("destructive"),
          foreground: role("destructive-foreground"),
        },
        // Red for error text on non-red surfaces; use destructive for fills.
        danger: {
          DEFAULT: role("danger-text"),
          subtle: "hsl(var(--danger-text) / 0.12)",
        },
        success: {
          DEFAULT: role("success"),
          subtle: "hsl(var(--success) / 0.12)",
        },
        warning: {
          DEFAULT: role("warning"),
          subtle: "hsl(var(--warning) / 0.12)",
        },
        info: {
          DEFAULT: role("info"),
          subtle: "hsl(var(--info) / 0.12)",
        },
        // Meta and captions only.
        subtle: role("subtle-foreground"),
        // Code blocks, editors and traces: the deepest surface, dark in both modes.
        "code-surface": role("code-surface"),
        // Chrome on the code surface (file names, copy buttons, hairlines), the same in both modes.
        "code-foreground": role("code-foreground"),
        "code-muted": role("code-muted"),
        "code-border": role("code-border"),
        muted: {
          DEFAULT: role("muted"),
          foreground: role("muted-foreground"),
        },
        accent: {
          DEFAULT: role("accent"),
          foreground: role("accent-foreground"),
        },
        card: {
          DEFAULT: role("card"),
          foreground: role("card-foreground"),
        },
        popover: {
          DEFAULT: role("popover"),
          foreground: role("popover-foreground"),
        },
        // Tier colours (DESIGN.md section 11): text-tier-2, bg-tier-2-subtle, border-tier-2-border,
        // and the current tier from the nearest data-tier ancestor: text-tier-current,
        // bg-tier-current-subtle, border-tier-current-border (neutral outside any data-tier).
        tier: {
          ...tierColours(),
          current: role("tier-current"),
          "current-subtle": "var(--tier-current-subtle)",
          "current-border": "var(--tier-current-border)",
        },
        // Glass tokens as colours, for the rare part that needs one on its own (a divider inside a glass menu).
        glass: {
          DEFAULT: "hsl(var(--glass-bg))",
          border: "hsl(var(--glass-border))",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-plex-sans)",
          // Greek only (unicode-range), for Δ and the other letters in delta-cycle notation.
          "var(--font-plex-sans-greek)",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-jetbrains-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
        serif: ["Georgia", "serif"],
      },
      // The sans face is loaded at 400, 500 and 600: heavier classes map to 600
      // so nothing is synthesised (DESIGN.md section 4).
      fontWeight: {
        bold: "600",
        extrabold: "600",
        black: "600",
      },
      // Named sizes from the type scale; Tailwind's own sizes stay available.
      fontSize: {
        display: ["clamp(2.5rem, 1.6rem + 3.2vw, 3.75rem)", { lineHeight: "1.05", letterSpacing: "-0.025em", fontWeight: "500" }],
        // 32/40 from sm up; globals.css drops .text-h1 to 28/36 under 640 px.
        // Type of 28 px and larger is set at 500 (DESIGN.md section 4).
        h1: ["2rem", { lineHeight: "2.5rem", letterSpacing: "-0.015em", fontWeight: "500" }],
        h2: ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        h3: ["1.1875rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        h4: ["1rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        lead: ["1.125rem", { lineHeight: "1.75rem" }],
        body: ["1.0625rem", { lineHeight: "1.8125rem" }],
        ui: ["0.875rem", { lineHeight: "1.25rem" }],
        label: ["0.75rem", { lineHeight: "1rem", fontWeight: "500" }],
        code: ["0.84375rem", { lineHeight: "1.375rem" }],
      },
      borderRadius: {
        lg: "var(--radius, 0.5rem)",
        md: "calc(var(--radius, 0.5rem) - 2px)",
        sm: "calc(var(--radius, 0.5rem) - 4px)",
      },
      // Light mode only; in dark mode --shadow-card is a transparent zero shadow, so it still composes with rings.
      boxShadow: {
        card: "var(--shadow-card)",
        glass: "inset 0 1px 0 hsl(var(--glass-highlight)), var(--glass-shadow)",
      },
      transitionTimingFunction: {
        // The one easing curve (DESIGN.md section 6).
        bench: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      backdropBlur: {
        xs: "2px",
        xxl: "24px",
      },
      typography: {
        DEFAULT: {
          css: {
            ...proseVariables,
            fontSize: "1.0625rem",
            lineHeight: "1.7059",
            // h1 is left out: a shared rule comes after the plugin's own h1 rule and would win.
            "h2, h3, h4": { fontWeight: "600" },
            // 28 px and larger is set at 500, like the text-h1 token.
            h1: { fontSize: "2rem", lineHeight: "2.5rem", letterSpacing: "-0.015em", fontWeight: "500" },
            h2: { fontSize: "1.5rem", lineHeight: "2rem", letterSpacing: "-0.01em" },
            h3: { fontSize: "1.1875rem", lineHeight: "1.75rem" },
            h4: { fontSize: "1rem", lineHeight: "1.5rem" },
            strong: { fontWeight: "600" },
            // The plugin sets strong inside headings at 700 to 900; the face stops at 600.
            "h1 strong": { fontWeight: "600" },
            "h2 strong": { fontWeight: "600" },
            "h3 strong": { fontWeight: "600" },
            "h4 strong": { fontWeight: "600" },
            "thead th": { fontWeight: "600" },
            a: {
              fontWeight: "500",
              textDecorationLine: "underline",
              textUnderlineOffset: "0.2em",
              textDecorationThickness: "1px",
            },
            "a:hover": { textDecorationThickness: "2px" },
            pre: { fontSize: "0.84375rem", lineHeight: "1.375rem" },
            // Phone sizes (16/27 body, 28/36 h1) live in globals.css: the plugin
            // cannot nest @media keys and turns them into invalid selectors.
          },
        },
        // The lesson article uses prose-base; it must not bring back the plugin's 16/28 body.
        base: {
          css: {
            fontSize: "1.0625rem",
            lineHeight: "1.7059",
            h1: { fontSize: "2rem", lineHeight: "2.5rem" },
            h2: { fontSize: "1.5rem", lineHeight: "2rem" },
            h3: { fontSize: "1.1875rem", lineHeight: "1.75rem" },
            h4: { fontSize: "1rem", lineHeight: "1.5rem" },
            pre: { fontSize: "0.84375rem", lineHeight: "1.375rem" },
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
