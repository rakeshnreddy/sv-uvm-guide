import { test, expect, type Page } from '@playwright/test';

const frameSelector = 'iframe[title="SystemVerilog 3D Explorer"]';
type SceneId = 'dynamic-array' | 'queue' | 'associative' | 'packed-matrix';

const sceneButtonText: Record<SceneId, RegExp> = {
  'dynamic-array': /Dynamic Array/i,
  queue: /Queue/i,
  associative: /Associative Array/i,
  'packed-matrix': /Fixed Array/i,
};

const expectInitialScene = async (page: Page, scene: SceneId) => {
  const visualizer = page.getByTestId('sv-3d-visualizer');
  await expect(visualizer).toHaveAttribute('data-initial-scene', scene);
  await expect(visualizer).toHaveAttribute('data-active-scene', scene);

  const frame = page.locator(frameSelector);
  const expectedSrc =
    scene === 'dynamic-array'
      ? /systemverilog-3d\.html(?:$|\?)/
      : new RegExp(`systemverilog-3d\\.html\\?scene=${scene}`);
  await expect(frame).toHaveAttribute('src', expectedSrc);
};

test.describe('SystemVerilog 3D Explorer Deep Linking', () => {
  test('loads default scene when no query parameter provided', async ({ page }) => {
    await page.goto('/visualizations/systemverilog-3d');

    const frame = page.frameLocator(frameSelector);
    await expect(frame.getByRole('heading', { name: /SV Data Structures/i })).toBeVisible();
    await expect(frame.locator('button.tab-btn.active')).toHaveText(/Dynamic Array/i);
    await expect(page).not.toHaveURL(/scene=/, { timeout: 15000 });
  });

  test('loads specific scene from URL parameter', async ({ page }) => {
    await page.goto('/visualizations/systemverilog-3d?scene=queue');
    await expectInitialScene(page, 'queue');
  });

  test('updates scene state when switching scenes via buttons', async () => {
    test.skip(true, '3D explorer button interactions depend on iframe events not available in CI.');
  });

  test('preserves scene selection after page reload', async ({ page }) => {
    await page.goto('/visualizations/systemverilog-3d?scene=packed-matrix');
    await expectInitialScene(page, 'packed-matrix');

    await page.reload();
    await expectInitialScene(page, 'packed-matrix');
    await expect(page).toHaveURL(/scene=packed-matrix/, { timeout: 15000 });
  });

  test('handles browser back/forward navigation correctly', async () => {
    test.skip(true, '3D explorer navigation relies on iframe mode events that do not fire in CI.');
  });

  test('handles invalid scene parameter gracefully', async ({ page }) => {
    await page.goto('/visualizations/systemverilog-3d?scene=invalid-scene-name');

    await expectInitialScene(page, 'dynamic-array');
    await expect(page).toHaveURL('/visualizations/systemverilog-3d');
  });

  test('deep links from F2B curriculum work correctly', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2B_Dynamic_Structures/');
    await page.click('a[href*="/visualizations/systemverilog-3d?scene=queue"]');

    await expect(page).toHaveURL(/visualizations\/systemverilog-3d\?scene=queue/);
    await expectInitialScene(page, 'queue');
  });

  test('all scene parameters work correctly', async ({ page }) => {
    const scenes: Array<SceneId> = ['dynamic-array', 'queue', 'associative', 'packed-matrix'];

    for (const scene of scenes) {
      await page.goto(`/visualizations/systemverilog-3d?scene=${scene}`);
      await expectInitialScene(page, scene);
    }
  });
});
