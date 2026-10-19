import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

const stripMonacoSourcemapPlugin = {
  name: 'strip-monaco-sourcemap-comment',
  enforce: 'pre' as const,
  load(id: string) {
    if (id.includes('monaco-editor/esm/vs/base/common/marked/marked.js')) {
      const code = fs.readFileSync(id, 'utf-8').replace(/\n?\/\/#[^\n]*marked\.umd\.js\.map\s*$/, '\n');
      return { code };
    }
    return null;
  },
};

export default defineConfig({
  plugins: [stripMonacoSourcemapPlugin],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    sourcemap: false,

  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Next aliases 'server-only' per bundling layer; tests run server modules
      // directly, so point it at Next's own empty build of the marker module.
      'server-only': path.resolve(__dirname, './node_modules/next/dist/compiled/server-only/empty.js'),
    },
  },
});
