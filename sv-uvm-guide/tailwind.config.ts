import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

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
        background: '#0A192F',
        'brand-text-primary': '#E6F1FF', // Renamed from 'primary-text'
        accent: '#64FFDA',
        'secondary-accent': '#FFCA86',
        // Keeping other existing colors for now, can be cleaned up later if not used
        border: "hsl(var(--border-hsl))",
        input: "hsl(var(--input-hsl))",
        ring: "hsl(var(--ring-hsl))",
        foreground: "hsl(var(--foreground-hsl))",
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
        // 'accent' is now defined above, so this can be removed or aliased if needed
        // accent: {
        //   DEFAULT: "hsl(var(--accent-hsl, 240 4.8% 95.9%))",
        //   foreground: "hsl(var(--accent-foreground-hsl, 240 5.9% 10%))",
        // },
        popover: {
          DEFAULT: "hsl(var(--popover-hsl, 0 0% 100%))",
          foreground: "hsl(var(--popover-foreground-hsl, 240 10% 3.9%))",
        },
        card: {
          DEFAULT: "hsl(var(--card-hsl, 0 0% 100%))",
          foreground: "hsl(var(--card-foreground-hsl, 240 10% 3.9%))",
        },
      },
      fontFamily: {
        sans: ['"Cal Sans"', ...fontFamily.sans],
        body: ['Inter', ...fontFamily.sans],
        mono: ['"JetBrains Mono"', ...fontFamily.mono],
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
