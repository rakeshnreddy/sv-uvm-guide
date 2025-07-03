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
        // Digital Blueprint Colors
        background: '#0A192F',
        'brand-text-primary': '#E6F1FF',
        accent: '#64FFDA',
        'secondary-accent': '#FFCA86',
        // Simplified: Remove HSL-based colors for now to test
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
