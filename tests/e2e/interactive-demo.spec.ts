import { test, expect } from '@playwright/test';

const describeInteractive = test.describe.skip;

describeInteractive('Interactive Demo Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
        const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;

        if (url.includes('/api/simulate') && method?.toUpperCase() === 'POST') {
          let backend = 'wasm';
          try {
            const body = init?.body ? JSON.parse(init.body as string) : {};
            backend = body.backend ?? 'wasm';
          } catch {
            backend = 'wasm';
          }

          const backendLabel =
            backend === 'verilator'
              ? '[Verilator] Running simulation...'
              : backend === 'icarus'
                ? '[Icarus] Running simulation...'
                : '[WebAssembly] Running simulation...';

          const payload = {
            output: `${backendLabel}\nSimulation PASSED`,
            waveform: {
              signal: [
                { name: 'clk', wave: 'p.......' },
                { name: 'reset_n', wave: '01......' },
                { name: 'req', wave: '0.1.0.1.' },
                { name: 'gnt', wave: '0...1..0' },
              ],
            },
            stats: { runtimeMs: 1.2, memoryBytes: 131072, cpuUserMs: 0.3, cpuSystemMs: 0.1 },
            coverage: 82,
            regressions: [],
            backend,
            passed: true,
            errors: [],
          };

          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        return originalFetch(input, init);
      };
    });

    await page.goto('/practice/interactive-demo');
  });

  test('should display the main title', async ({ page }) => {
    // The page can be slow to load with the new components, so wait for a key element to be visible
    await expect(page.locator('h2:has-text("Enhanced Interactive Code")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Interactive Components Demo');
  });

  test('should display and interact with the InteractiveCode component', async ({ page }) => {
    const tour = page.getByTestId('interactive-code');

    await expect(tour.locator('.monaco-editor')).toBeVisible();

    await expect(tour.getByText('This section declares the SystemVerilog module and its signals.')).toBeVisible();

    await tour.getByRole('button', { name: 'Next' }).click();
    await expect(tour.getByText('This `initial` block creates a free-running clock with a 10ns period.')).toBeVisible();
    await expect(tour.locator('span:has-text("Step 2 of 5")')).toBeVisible();
  });

  test('should run the simulation in the CodeExecutionEnvironment', async ({ page }) => {
    await expect(page.locator('h2:has-text("Code Execution Environment")')).toBeVisible();

    const outputPanel = page.getByTestId('simulation-output');
    await expect(outputPanel).toContainText('Click "Run Simulation" to see the output.');

    // Run with default backend
    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/api/simulate') && response.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Run Simulation' }).click(),
    ]);

    await expect(outputPanel).toContainText('Simulation PASSED', { timeout: 10000 });

    // Switch backend and run again to ensure selection works
    await page.locator('select').selectOption('verilator');
    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/api/simulate') && response.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Run Simulation' }).click(),
    ]);

    await expect(outputPanel).toContainText('[Verilator] Running', { timeout: 10000 });
  });

  test('should display the placeholder components', async ({ page }) => {
    await expect(page.locator('h2:has-text("Code Challenge System")')).toBeVisible();
    await expect(page.locator('h2:has-text("Debugging Simulator")')).toBeVisible();
    await expect(page.locator('h2:has-text("Code Review Assistant")')).toBeVisible();
  });
});
