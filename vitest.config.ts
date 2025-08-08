import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/session-options.test.ts', 'tests/curriculum-generator.test.ts'],

  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
