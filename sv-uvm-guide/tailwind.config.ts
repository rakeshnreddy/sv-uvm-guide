import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}", // Primary location for App Router
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}", // If you have a global src/components
    "./app/**/*.{js,ts,jsx,tsx,mdx}", // If components are in a root /app folder (less common with src)
    "./components/**/*.{js,ts,jsx,tsx,mdx}", // If components are in a root /components folder
    // Add any other top-level directories that might contain JSX/TSX using Tailwind classes
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: '#0A192F',
        'brand-text-primary': '#E6F1FF',
        accent: '#64FFDA',
        'secondary-accent': '#FFCA86',
        // Restore HSL-based colors
        border: "hsl(var(--border-hsl))",
        input: "hsl(var(--input-hsl))",
        ring: "hsl(var(--ring-hsl))",
        foreground: "hsl(var(--foreground-hsl))", // This was the original default text color
        primary: {
          DEFAULT: "hsl(var(--primary-hsl))",
          foreground: "hsl(var(--primary-foreground-hsl))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary-hsl, 240 4.8% 95.9%))",
          foreground: "hsl(var(--secondary-foreground-hsl, 240 5.9% 10%))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive-hsl, 0 84.2% 60.2%))",
          foreground: "hsl(var(--destructive-foreground-hsl, 0 0% 98%))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted-hsl, 240 4.8% 95.9%))",
          foreground: "hsl(var(--muted-foreground-hsl, 240 3.8% 46.1%))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover-hsl, 0 0% 100%))",
          foreground: "hsl(var(--popover-foreground-hsl, 240 10% 3.9%))",
        },
        card: { // This 'card' color definition might be used by the Card component later
          DEFAULT: "hsl(var(--card-hsl, 0 0% 100%))",
          foreground: "hsl(var(--card-foreground-hsl, 240 10% 3.9%))",
        },
      },
      fontFamily: {
        sans: ['"Cal Sans"', ...defaultTheme.fontFamily.sans],
        body: ['Inter', ...defaultTheme.fontFamily.sans],
        mono: ['"JetBrains Mono"', ...defaultTheme.fontFamily.mono],
      },
      borderRadius: {
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
