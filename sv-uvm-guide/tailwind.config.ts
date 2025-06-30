import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border-hsl))", // Assuming you'll add --border-hsl in globals.css
        input: "hsl(var(--input-hsl))",   // Assuming you'll add --input-hsl in globals.css
        ring: "hsl(var(--ring-hsl))",     // Assuming you'll add --ring-hsl in globals.css
        background: "hsl(var(--background-hsl))",
        foreground: "hsl(var(--foreground-hsl))",
        primary: {
          DEFAULT: "hsl(var(--primary-hsl))",
          foreground: "hsl(var(--primary-foreground-hsl))",
        },
        secondary: { // Example, add more as needed
          DEFAULT: "hsl(var(--secondary-hsl, 240 4.8% 95.9%))",
          foreground: "hsl(var(--secondary-foreground-hsl, 240 5.9% 10%))",
        },
        destructive: { // Example
          DEFAULT: "hsl(var(--destructive-hsl, 0 84.2% 60.2%))",
          foreground: "hsl(var(--destructive-foreground-hsl, 0 0% 98%))",
        },
        muted: { // Example
          DEFAULT: "hsl(var(--muted-hsl, 240 4.8% 95.9%))",
          foreground: "hsl(var(--muted-foreground-hsl, 240 3.8% 46.1%))",
        },
        accent: { // Example
          DEFAULT: "hsl(var(--accent-hsl, 240 4.8% 95.9%))",
          foreground: "hsl(var(--accent-foreground-hsl, 240 5.9% 10%))",
        },
        popover: { // Example
          DEFAULT: "hsl(var(--popover-hsl, 0 0% 100%))",
          foreground: "hsl(var(--popover-foreground-hsl, 240 10% 3.9%))",
        },
        card: { // Example
          DEFAULT: "hsl(var(--card-hsl, 0 0% 100%))",
          foreground: "hsl(var(--card-foreground-hsl, 240 10% 3.9%))",
        },
      },
      borderRadius: { // Example, if you want to use vars for this too
        lg: "var(--radius, 0.5rem)",
        md: "calc(var(--radius, 0.5rem) - 2px)",
        sm: "calc(var(--radius, 0.5rem) - 4px)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
export default config;
