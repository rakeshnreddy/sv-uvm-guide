import { describe, expect, it } from "vitest";

import manifest from "../../content/curriculum/curriculum.manifest.json";
import {
  MODULE_TIERS,
  TIER_NUMBERS,
  lessonTierFromPathname,
  tierDataAttribute,
  tierOfModuleCode,
  tierOfTierSlug,
} from "@/lib/tier-colors";

/*
 * The one tier lookup (DESIGN.md section 11): the tier of a module code comes
 * from the curriculum manifest, never from the code's prefix.
 */
describe("tierOfModuleCode", () => {
  it("maps every module code in the manifest to the tier that contains it", () => {
    let count = 0;
    for (const tier of manifest.tiers) {
      const expected = Number(/^T(\d)/.exec(tier.id)?.[1]);
      for (const mod of tier.modules) {
        const code = mod.id.split("_")[0];
        expect(tierOfModuleCode(code), `${code} in ${tier.id}`).toBe(expected);
        expect(tierOfModuleCode(mod.id), mod.id).toBe(expected);
        count += 1;
      }
    }
    expect(count).toBeGreaterThan(50);
    expect(MODULE_TIERS.size).toBe(count);
  });

  it("knows the examples from the contract, including codes whose prefix names no tier", () => {
    expect(tierOfModuleCode("F1A")).toBe(1);
    expect(tierOfModuleCode("I-UVM-1B")).toBe(2);
    expect(tierOfModuleCode("B-AXI-1")).toBe(3);
    expect(tierOfModuleCode("E-DBG-1")).toBe(4);
  });

  it("ignores case and surrounding space", () => {
    expect(tierOfModuleCode(" i-uvm-1c ")).toBe(2);
  });

  it("returns undefined for milestones, tier codes, unknown and empty codes", () => {
    for (const code of ["M0", "M3", "M8", "T1", "T4", "X-NOPE-1", "", null, undefined]) {
      expect(tierOfModuleCode(code), String(code)).toBeUndefined();
    }
  });
});

describe("tier slugs and lesson paths", () => {
  it("reads a tier folder or its pretty form", () => {
    expect(tierOfTierSlug("T1_Foundational")).toBe(1);
    expect(tierOfTierSlug("t2-intermediate")).toBe(2);
    expect(tierOfTierSlug("T3_Advanced")).toBe(3);
    expect(tierOfTierSlug("T4%5FExpert")).toBe(4);
    expect(tierOfTierSlug("expert-index")).toBeUndefined();
    expect(tierOfTierSlug(undefined)).toBeUndefined();
  });

  it("finds the tier of a lesson URL and nothing on hub pages", () => {
    expect(lessonTierFromPathname("/curriculum/T2_Intermediate/I-SV-1_OOP/index")).toBe(2);
    expect(lessonTierFromPathname("/curriculum/t4-expert/e-dbg-1-advanced-uvm-debug-methodologies")).toBe(4);
    expect(lessonTierFromPathname("/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index?x=1#top")).toBe(1);
    for (const path of ["/curriculum", "/curriculum/expert-index", "/curriculum/T2_Intermediate", "/practice", "/", null]) {
      expect(lessonTierFromPathname(path), String(path)).toBeUndefined();
    }
  });

  it("gives the data-tier value or leaves the attribute off", () => {
    expect(TIER_NUMBERS.map((tier) => tierDataAttribute(tier))).toEqual(["1", "2", "3", "4"]);
    expect(tierDataAttribute(undefined)).toBeUndefined();
  });
});
