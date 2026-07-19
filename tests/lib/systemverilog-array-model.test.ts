import { describe, expect, it } from "vitest";

import {
  buildArrayInstances,
  createQueueIdAllocator,
  encodeArrayCoordinates,
  MAX_VISIBLE_INSTANCES,
  validateDimensions,
} from "@/lib/systemverilog-array-model";

describe("SystemVerilog array visualization model", () => {
  it("caps fixed-array rendering work", () => {
    const result = buildArrayInstances(
      { packed: [1_000, 1_000, 1_000], unpacked: [1_000, 1_000] },
      MAX_VISIBLE_INSTANCES,
    );
    expect(result.instances).toHaveLength(MAX_VISIBLE_INSTANCES);
    expect(result.truncated).toBe(true);
    expect(result.logicalInstanceCount).toBeGreaterThan(MAX_VISIBLE_INSTANCES);
  });

  it("normalizes negative, NaN, empty, and extreme dimensions", () => {
    expect(validateDimensions({
      packed: [-4, Number.NaN, Number.POSITIVE_INFINITY, 12],
      unpacked: [],
    })).toEqual({ packed: [1, 1, 1], unpacked: [1] });
    expect(validateDimensions({ packed: [10_000], unpacked: [10_000] })).toEqual({
      packed: [64],
      unpacked: [64],
    });
  });

  it("allocates queue IDs independently per visualizer mount", () => {
    const firstMount = createQueueIdAllocator();
    const secondMount = createQueueIdAllocator();
    expect([firstMount.next(), firstMount.next(), secondMount.next()]).toEqual([1, 2, 1]);
  });

  it("maps every packed and unpacked coordinate to its row-major logical bit", () => {
    const dimensions = { packed: [3, 4], unpacked: [2, 5] };
    expect(encodeArrayCoordinates(dimensions, {
      unpacked: [1, 3],
      packed: [2, 1],
    })).toBe(105);
    expect(encodeArrayCoordinates(dimensions, {
      unpacked: [2, 0],
      packed: [0, 0],
    })).toBeNull();
  });

  it("keeps a requested logical bit in a capped instance preview", () => {
    const result = buildArrayInstances(
      { packed: [64, 64], unpacked: [64] },
      8,
      200_000,
    );
    expect(result.instances).toHaveLength(8);
    expect(result.instances.at(-1)?.logicalIndex).toBe(200_000);
  });
});
