import { test, expect } from '@playwright/test';

test.describe('Homepage Interactivity', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage before each test
    await page.goto('/');
  });

  test('should display the main heading and hero SVG', async ({ page }) => {
    // Assert that the main heading is visible
    await expect(page.getByRole('heading', { name: 'Master SystemVerilog & UVM' })).toBeVisible();

    // Assert that the UvmHeroDiagram SVG is present
    // We can look for the SVG element itself. A more specific selector might be needed
    // if there are other SVGs, e.g., targetting by a class or ID on its container.
    const uvmDiagram = page.locator('main section svg'); // Basic check for an svg in the main section
    await expect(uvmDiagram).toBeVisible();
    await expect(uvmDiagram).toHaveCount(1); // Ensure it's the one we expect (or adjust if icons are SVGs)
  });

  test('should show description on UVM diagram component hover', async ({ page }) => {
    // Target the SVG element that corresponds to the "Driver"
    // In uvm-hero-diagram.svg, this is <g id="driver" data-description="...">
    // We need to ensure this element is targetable by Playwright.
    // Using a selector that finds the <g> element with id="driver"
    const driverElement = page.locator('#driver');

    // Ensure the driver element is visible within the SVG
    await expect(driverElement).toBeVisible();

    // Simulate a mouse hover over the 'Driver' element
    await driverElement.hover();

    // Assert that the associated tooltip or description text for the Driver becomes visible
    // The description text is "The Driver converts sequence items into pin-level activity on the DUT interface."
    const descriptionText = "The Driver converts sequence items into pin-level activity on the DUT interface.";
    const descriptionBox = page.locator('div[style*="position: absolute"][style*="background-color: rgba(0, 0, 0, 0.7)"]');

    await expect(descriptionBox).toBeVisible();
    await expect(descriptionBox).toContainText(descriptionText);

    // Optional: Move mouse away to check if description disappears (if that's the desired behavior)
    await page.mouse.move(0,0); // Move mouse to a neutral position
    // await expect(descriptionBox).not.toBeVisible(); // This depends on the onHoverEnd logic in UvmHeroDiagram
  });

  test('should display the highlights carousel with five slides', async ({ page }) => {
    // Assert that the highlights carousel section is visible
    const carouselSection = page.locator('#highlights-carousel-section');
    await expect(carouselSection).toBeVisible();

    // Assert that the carousel heading "Key Features" is visible
    await expect(carouselSection.getByRole('heading', { name: 'Key Features' })).toBeVisible();

    // Assert that the carousel itself (e.g., the embla container) is present
    const emblaContainer = carouselSection.locator('.embla__container');
    await expect(emblaContainer).toBeVisible();

    // Assert that the carousel contains five slides
    // Each slide has a Card component. We can count the number of .embla__slide elements.
    const slides = emblaContainer.locator('.embla__slide');
    await expect(slides).toHaveCount(5);

    // Optional: Check for titles of the cards to be more specific
    await expect(slides.nth(0)).toContainText("Authoritative Curriculum");
    await expect(slides.nth(1)).toContainText("Interactive Labs");
    await expect(slides.nth(2)).toContainText("AI-Powered Tutor");
    await expect(slides.nth(3)).toContainText("Spaced Repetition");
    await expect(slides.nth(4)).toContainText("Community Forum");
  });
});
