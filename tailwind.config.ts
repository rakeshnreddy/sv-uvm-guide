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
        background: '#0D1117',
        primary: '#161B22',
        secondary: '#21262D',
        accent: '#58A6FF',
        success: '#3FB950',
        danger: '#F85149',
        'text-primary': '#C9D1D9',
        'text-secondary': '#8B949E',
      },
      fontFamily: {
        sans: ['var(--font-inter)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-roboto-mono)', ...defaultTheme.fontFamily.mono],
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
