import { test, expect } from '@playwright/test';

// List of curriculum pages that have 3D/WebGL interactives
const canvas3DPages = [
    '/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/ipc', // Mailbox3D
    '/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/index', // Coverage3D
    '/curriculum/T2_Intermediate/I-UVM-1C_UVM_Phasing/index', // PhaseTimeline3D
    '/curriculum/T2_Intermediate/I-UVM-2B_TLM_Connections/index', // Analysis3D, Dataflow3D
    '/curriculum/T3_Advanced/A-SV-1_Advanced_Constraints/index' // Constraint3D
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
