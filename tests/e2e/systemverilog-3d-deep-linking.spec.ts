import { test, expect } from '@playwright/test';

const frameSelector = 'iframe[title="SystemVerilog 3D Explorer"]';
const sceneButtonText: Record<string, RegExp> = {
  'dynamic-array': /Dynamic Array/i,
  queue: /Queue/i,
  associative: /Associative Array/i,
  'packed-matrix': /Fixed Array/i,
};

const expectActiveTab = async (page: ReturnType<typeof test.extend>['page'], scene: string) => {
  const frame = page.frameLocator(frameSelector);
  await expect(frame.locator('button.tab-btn.active')).toHaveText(sceneButtonText[scene]);
};

test.describe('SystemVerilog 3D Explorer Deep Linking', () => {
  test('loads default scene when no query parameter provided', async ({ page }) => {
    await page.goto('/visualizations/systemverilog-3d');

    const frame = page.frameLocator(frameSelector);
    await expect(frame.getByRole('heading', { name: /SV Data Structures/i })).toBeVisible();
    await expect(frame.locator('button.tab-btn.active')).toHaveText(/Dynamic Array/i);
    await expect(page).not.toHaveURL(/scene=/);
  });

  test('loads specific scene from URL parameter', async ({ page }) => {
    await page.goto('/visualizations/systemverilog-3d?scene=queue');
    await expectActiveTab(page, 'queue');
  });

  test('updates URL when switching scenes via buttons', async ({ page }) => {
    await page.goto('/visualizations/systemverilog-3d');
    const frame = page.frameLocator(frameSelector);

    await frame.getByRole('button', { name: /Associative Array/i }).click();
    await expect(page).toHaveURL(/scene=associative/);
    await expect(frame.locator('#aa-size')).toHaveText(/aa\.num\(\) = 3/);
  });

  test('preserves scene selection after page reload', async ({ page }) => {
    await page.goto('/visualizations/systemverilog-3d?scene=packed-matrix');
    await expectActiveTab(page, 'packed-matrix');

    await page.reload();
    await expectActiveTab(page, 'packed-matrix');
    await expect(page).toHaveURL(/scene=packed-matrix/);
  });

  test('handles browser back/forward navigation correctly', async ({ page }) => {
    await page.goto('/visualizations/systemverilog-3d');
    const frame = page.frameLocator(frameSelector);

    await frame.getByRole('button', { name: /Queue/i }).click();
    await expect(page).toHaveURL(/scene=queue/);

    await frame.getByRole('button', { name: /Associative Array/i }).click();
    await expect(page).toHaveURL(/scene=associative/);

    await page.goBack();
    await expect(page).toHaveURL(/scene=queue/);
    await expect(frame.locator('button.tab-btn.active')).toHaveText(/Queue/i);

    await page.goBack();
    await expect(page).not.toHaveURL(/scene=/);

    await page.goForward();
    await expect(page).toHaveURL(/scene=queue/);
    await frame.getByRole('button', { name: /Associative Array/i }).click();
    await expect(page).toHaveURL(/scene=associative/);
  });

  test('handles invalid scene parameter gracefully', async ({ page }) => {
    await page.goto('/visualizations/systemverilog-3d?scene=invalid-scene-name');

    await expectActiveTab(page, 'dynamic-array');
    await expect(page).toHaveURL('/visualizations/systemverilog-3d');
  });

  test('deep links from F2B curriculum work correctly', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2B_Dynamic_Structures/');
    await page.click('a[href*="/visualizations/systemverilog-3d?scene=queue"]');

    await expect(page).toHaveURL(/visualizations\/systemverilog-3d\?scene=queue/);
    await expectActiveTab(page, 'queue');
  });

  test('all scene parameters work correctly', async ({ page }) => {
    const scenes: Array<SceneId> = ['dynamic-array', 'queue', 'associative', 'packed-matrix'];

    for (const scene of scenes) {
      await page.goto(`/visualizations/systemverilog-3d?scene=${scene}`);
      await expectActiveTab(page, scene);
    }
  });
});

type SceneId = 'dynamic-array' | 'queue' | 'associative' | 'packed-matrix';
