import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LAB_FILE_LIMITS, getLearnerLabAssets, readLabAsset, readLabFilesForBuild } from "@/lib/lab-assets";
import type { LabManifest } from "@/lib/lab-manifest";
import { getAllLabs, getLabById } from "@/lib/lab-registry";

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

describe("readLabFilesForBuild", () => {
  it("returns guide, starter and reference files with contents, and keeps solutions separate", async () => {
    const lab = getLabById("basics-1")!;
    const { files, solutions } = await readLabFilesForBuild(lab);

    expect(files.map((file) => [file.path, file.role, file.editable])).toEqual([
      ["README.md", "guide", false],
      ["work/dut_counter.sv", "starter", true],
      ["work/tb_counter_unrefactored.sv", "starter", true],
    ]);
    expect(solutions.map((file) => [file.path, file.role, file.language])).toEqual([
      ["solution/tb_counter_refactored.sv", "solution", "systemverilog"],
    ]);
    const onDisk = (relative: string) => fs.readFileSync(path.join(process.cwd(), lab.assetLocation, relative), "utf8");
    for (const file of [...files, ...solutions]) {
      expect(file.content).toBe(onDisk(file.path));
      expect(file.fileName).toBe(path.basename(file.path));
    }
  });

  it("reads exactly the declared assets of every available lab, within the caps", async () => {
    for (const lab of getAllLabs().filter((candidate) => candidate.status === "available")) {
      const { files, solutions } = await readLabFilesForBuild(lab);
      expect([...files, ...solutions].map((file) => file.path).sort()).toEqual(lab.assets.map((asset) => asset.path).sort());
      expect(files.every((file) => file.role !== "solution")).toBe(true);
      expect(solutions.every((file) => file.role === "solution")).toBe(true);
    }
    expect(LAB_FILE_LIMITS).toEqual({ maxFileBytes: 256 * 1024, maxLabBytes: 1024 * 1024 });
  }, 20_000); // Reads every file of 23 labs from disk; slow only on a loaded machine.

  it("refuses a declared path that escapes the lab directory", async () => {
    const lab = getLabById("scoreboard-reference-model")!;
    const escaping = {
      ...lab,
      assets: [{ path: "../../package.json", role: "reference", language: "json", editable: false }],
    } as LabManifest;
    await expect(readLabFilesForBuild(escaping)).rejects.toThrow("LAB_ASSET_PATH_INVALID");
    await expect(readLabFilesForBuild({ ...lab, assetLocation: "src/lib" } as LabManifest)).rejects.toThrow(
      "LAB_ASSET_ROOT_INVALID",
    );
  });

  it("fails on the per-file and per-lab caps", async () => {
    const lab = getLabById("basics-1")!;
    await expect(readLabFilesForBuild(lab, { maxFileBytes: 1024, maxLabBytes: 1024 * 1024 })).rejects.toThrow(
      "LAB_ASSET_TOO_LARGE",
    );
    await expect(readLabFilesForBuild(lab, { maxFileBytes: 256 * 1024, maxLabBytes: 8 * 1024 })).rejects.toThrow(
      "LAB_ASSET_PAYLOAD_TOO_LARGE",
    );
  });
});
