import { expect, test, type Page } from "@playwright/test";

type SceneId = "dynamic-array" | "queue" | "associative" | "packed-matrix";

const sceneLabels: Record<SceneId, string> = {
  "dynamic-array": "Dynamic Array",
  queue: "Queue",
  associative: "Associative Array",
  "packed-matrix": "Fixed/Packed Array",
};

async function expectInitialScene(page: Page, scene: SceneId): Promise<void> {
  const visualizer = page.getByTestId("sv-3d-visualizer");
  await expect(visualizer).toBeVisible();
  await expect(visualizer.getByRole("combobox")).toContainText(sceneLabels[scene]);
  if (scene !== "dynamic-array") {
    await expect(page).toHaveURL(new RegExp(`scene=${scene}`), { timeout: 15_000 });
  }
}

test.describe("SystemVerilog 3D Explorer deep linking", () => {
  test("loads the default scene without a query parameter", async ({ page }) => {
    await page.goto("/visualizations/systemverilog-3d");
    await expect(page.getByRole("heading", { name: "SV Data Structures" })).toBeVisible();
    await expectInitialScene(page, "dynamic-array");
    await expect(page).not.toHaveURL(/scene=/, { timeout: 15_000 });
  });

  test("loads and switches scenes through the live React controls", async ({ page }) => {
    await page.goto("/visualizations/systemverilog-3d?scene=queue");
    await expectInitialScene(page, "queue");

    await page.getByTestId("sv-3d-visualizer").getByRole("combobox").click();
    await page.getByRole("option", { name: "Associative Array" }).click();
    await expectInitialScene(page, "associative");
  });

  test("preserves a scene after reload", async ({ page }) => {
    await page.goto("/visualizations/systemverilog-3d?scene=packed-matrix");
    await expectInitialScene(page, "packed-matrix");
    await page.reload();
    await expectInitialScene(page, "packed-matrix");
  });

  test("normalizes an invalid scene to the default", async ({ page }) => {
    await page.goto("/visualizations/systemverilog-3d?scene=invalid-scene-name");
    await expectInitialScene(page, "dynamic-array");
    await expect(page).not.toHaveURL(/scene=/, { timeout: 15_000 });
  });

  test("deep links from the F2B curriculum", async ({ page }) => {
    await page.goto("/curriculum/T1_Foundational/F2B_Dynamic_Structures/");
    await page.locator('a[href="/visualizations/systemverilog-3d?scene=queue"]').click();
    await expectInitialScene(page, "queue");
  });

  test("maps packed and unpacked coordinates to the requested logical bit", async ({ page }) => {
    await page.goto("/visualizations/systemverilog-3d?scene=packed-matrix");
    const visualizer = page.getByTestId("sv-3d-visualizer");
    await visualizer.getByLabel("Unpacked index 1", { exact: true }).fill("1");
    await visualizer.getByLabel("Packed index 1", { exact: true }).fill("2");
    await visualizer.getByRole("button", { name: "Find Bit" }).click();
    await expect(visualizer.getByText("Highlighted logical bit 6")).toBeVisible();
  });

  test("supports every documented scene parameter", async ({ page }) => {
    for (const scene of ["dynamic-array", "queue", "associative", "packed-matrix"] as SceneId[]) {
      await page.goto(`/visualizations/systemverilog-3d?scene=${scene}`);
      await expectInitialScene(page, scene);
    }
  });
});
