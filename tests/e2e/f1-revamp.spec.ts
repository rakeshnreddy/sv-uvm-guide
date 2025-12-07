import { test, expect } from '@playwright/test';

test.describe('F1 Revamp', () => {

    test('F1A: The Cost of Bugs loads and renders visuals', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs');

        await expect(page.getByRole('heading', { name: 'F1A: The Cost of Bugs' })).toBeVisible();
        await expect(page.getByText('The Multi-Million Dollar Question')).toBeVisible();

        // Check Design Gap Chart
        await expect(page.getByText('Design vs. Verification')).toBeVisible();

        // Check Carousel
        await expect(page.getByText('Intel Pentium FDIV Bug (1994)')).toBeVisible();
    });

    test('F1B: The Verification Mindset loads and renders visuals', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F1B_The_Verification_Mindset');

        await expect(page.getByRole('heading', { name: 'F1B: The Verification Mindset' })).toBeVisible();

        // Check Diagram
        await expect(page.getByTestId('verification-methodologies-diagram')).toBeVisible();

        // Check Game
        await expect(page.getByTestId('first-bug-hunt-game')).toBeVisible();
    });

    test('F1C: Why SystemVerilog loads and renders comparison', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F1C_Why_SystemVerilog');

        await expect(page.getByRole('heading', { name: 'F1C: Why SystemVerilog?' })).toBeVisible();

        // Check VerilogVsSystemVerilog Visualizer
        const visualizer = page.getByTestId('verilog-vs-sv');
        await expect(visualizer).toBeVisible();

        // Interact
        await visualizer.getByRole('button', { name: 'Object Oriented Programming' }).click();
        await expect(visualizer).toContainText('Full OOP support: Classes, Inheritance');
    });

});
