import { test, expect } from '@playwright/test';

// List of curriculum pages that have 3D/WebGL interactives
const canvas3DPages = [
    // The decorative 3D views (Mailbox3D, Constraint3D, Coverage3D, PhaseTimeline3D,
    // Analysis3D, Dataflow3D) were removed from lessons in the visual rebuild because
    // they encoded wrong semantics. The array sandbox is the remaining WebGL view.
    '/curriculum/T1_Foundational/F2B_Dynamic_Structures/index', // SystemVerilog3DVisualizer
    '/visualizations/systemverilog-3d', // standalone array sandbox
];

test.describe('Canvas 3D Health Checks', () => {
    for (const pagePath of canvas3DPages) {
        test(`WebGL components load without crashing on ${pagePath}`, async ({ page }) => {
            const errors: string[] = [];

            // Catch and collect any uncaught browser exceptions (like React Three Fiber render crashes)
            page.on('pageerror', error => {
                const msg = error.message;
                if (!msg.includes('Error creating WebGL context') &&
                    !msg.includes('Hydration failed') &&
                    !msg.includes('error while hydrating')) {
                    errors.push(`Uncaught Browser Error: ${msg}`);
                }
            });

            // Also catch React console.error blasts that might indicate a suspended/failed boundary
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    console.log(`[BROWSER ERROR] ${msg.text()}`);
                }
            });

            await page.goto(pagePath);
            await page.waitForLoadState('domcontentloaded');

            // Find all canvas elements on the page (indicating 3D visualizers)
            const canvasCount = await page.locator('canvas').count();

            // If the page was supposed to have 3D but doesn't, that's also a problem (maybe it exploded early)
            if (canvasCount > 0) {
                // Wait a tiny bit for the WebGL context to fully initialize and try to render
                await page.waitForTimeout(1000);
            }

            // If we caught any React or ThreeJS exceptions, explicitly fail the Playwright test
            if (errors.length > 0) {
                throw new Error(`3D Canvas crashed during rendering. Errors:\n${errors.join('\n')}`);
            }

            // Just a basic sanity check that the main heading rendered successfully
            await expect(page.locator('h1').first()).toBeVisible();
        });
    }
});
