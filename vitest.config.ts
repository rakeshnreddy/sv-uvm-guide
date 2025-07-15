import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react'; // Using Next.js SWC plugin for React
import path from 'path';

// https://vitest.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Use SWC for faster compilation if preferred, ensure @vitejs/plugin-react is configured for it
      // For Next.js projects, you might leverage its SWC capabilities.
      // If using Next.js's SWC, ensure your tsconfig.json is compatible.
    }),
  ],
  test: {
    globals: true, // Allows using describe, it, expect, etc. without importing
    environment: 'jsdom', // Use jsdom to simulate browser environment
    setupFiles: ['./vitest.setup.ts'], // Global setup file for tests
    css: true, // Enable CSS processing if your components import CSS files directly
    alias: {
      '@': path.resolve(__dirname, './src'), // Match Next.js path alias
    },
  },
});
