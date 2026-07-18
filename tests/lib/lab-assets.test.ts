import { describe, expect, it } from "vitest";

import { getLearnerLabAssets, readLabAsset } from "@/lib/lab-assets";
import { getLabById } from "@/lib/lab-registry";

describe("lab asset loader", () => {
  it("uses manifest roles and excludes solutions from the learner payload", async () => {
    const lab = getLabById("pss-portable-intent");
    expect(lab).toBeDefined();

    const assets = await getLearnerLabAssets(lab!, { userId: "user-1", canRevealSolution: false });
    expect(assets.map((asset) => asset.path)).toEqual(["README.md", "starter/mem_test.pss"]);
    expect(assets.find((asset) => asset.path === "starter/mem_test.pss")).toMatchObject({
      role: "starter",
      language: "pss",
      editable: true,
    });
    expect(assets.every((asset) => !("content" in asset))).toBe(true);
  });

  it("enforces the solution reveal policy during content retrieval", async () => {
    const lab = getLabById("pss-portable-intent")!;
    const hidden = await readLabAsset(
      lab,
      "solution/generated_baremetal_test.c",
      { userId: "user-1", canRevealSolution: false },
    );
    expect(hidden).toBeNull();

    const revealed = await readLabAsset(
      lab,
      "solution/generated_baremetal_test.c",
      { userId: "user-1", canRevealSolution: true },
    );
    expect(revealed).toMatchObject({ role: "solution", language: "c", editable: false });
    expect(revealed?.content.length).toBeGreaterThan(0);
  });

  it("loads only manifest-declared paths", async () => {
    const lab = getLabById("scoreboard-reference-model")!;
    await expect(
      readLabAsset(lab, "../../package.json", { userId: "user-1", canRevealSolution: true }),
    ).resolves.toBeNull();
  });
});
