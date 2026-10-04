import { describe, expect, it } from "vitest";

import {
  addrPresets,
  automaticBins,
  buildExplorerSpec,
  opPresets,
  type AddrPresetId,
  type CellMark,
  type OpPresetId,
  classifyValue,
  covergroupToSource,
  createCoverageAccumulator,
  distributeFixed,
  elaborateCoverpoint,
  elaborateCovergroup,
  expectedSamplesDisjoint,
  expectedSamplesInclusionExclusion,
  forecastClosure,
  generateStimulus,
  harmonic,
  isClosed,
  parseRangeListText,
  parseTransitionText,
  runCoverage,
  samplesFromClockedTrace,
  selectToSource,
  stimulusDistribution,
  stimulusToSource,
  typeCoverage,
  type CoverpointSpec,
  type CovergroupSpec,
  type StimulusSpec,
} from "@/lib/coverage-model";

const cp = (spec: Partial<CoverpointSpec> & Pick<CoverpointSpec, "bins">): CoverpointSpec => ({ name: "cp", expr: "v", width: 4, ...spec });
const binValues = (spec: CoverpointSpec) => Object.fromEntries(elaborateCoverpoint(spec).bins.map((b) => [b.name, b.values]));
const run = (spec: CovergroupSpec, values: Record<string, number>[]) =>
  runCoverage(elaborateCovergroup(spec), values.map((v) => ({ values: v })));
const item = (snapshotItems: { name: string }[], name: string) => snapshotItems.find((i) => i.name === name) as ReturnType<typeof run>["final"]["items"][number];

describe("§19.5.1 explicit value bins", () => {
  it("bins fixed[4] = {[1:10], 1, 4, 7} distributes B = 13/4 = 3 values per bin, the last bin keeps the rest", () => {
    const bins = binValues(cp({ bins: [{ form: "values", keyword: "bins", name: "fixed", array: 4, values: [[1, 10], 1, 4, 7] }] }));
    expect(bins["fixed[0]"]).toEqual([1, 2, 3]);
    expect(bins["fixed[1]"]).toEqual([4, 5, 6]);
    expect(bins["fixed[2]"]).toEqual([7, 8, 9]);
    expect(bins["fixed[3]"]).toEqual([10, 1, 4, 7]);
  });

  it("bins fixed[5] = {1, 4, 7} leaves fixed[3] and fixed[4] empty, and empty bins do not count (§19.11.1)", () => {
    expect(distributeFixed([1, 4, 7], 5)).toEqual([[1], [4], [7], [], []]);
    const { final } = run({ name: "cg", coverpoints: [cp({ bins: [{ form: "values", keyword: "bins", name: "fixed", array: 5, values: [1, 4, 7] }] })] }, [{ v: 1 }]);
    expect(item(final.items, "cp")).toMatchObject({ covered: 1, total: 3 });
  });

  it("bins b[] = {[127:150], [148:191]} creates one bin per distinct value: b[127] … b[191] (65 bins)", () => {
    const e = elaborateCoverpoint({ name: "a", expr: "v_a", width: 10, bins: [{ form: "values", keyword: "bins", name: "b", array: "open", values: [[127, 150], [148, 191]] }] });
    expect(e.bins).toHaveLength(65);
    expect(e.bins[0].name).toBe("b[127]");
    expect(e.bins[64].name).toBe("b[191]");
  });

  it("$ in a range means the coverpoint's maximum: bins d = {[1000:$]} on a 10-bit value is 1000..1023", () => {
    const parsed = parseRangeListText("[1000:$]", 1023);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const e = elaborateCoverpoint({ name: "a", expr: "v_a", width: 10, bins: [{ form: "values", keyword: "bins", name: "d", values: parsed.value }] });
    expect(e.bins[0].values[0]).toBe(1000);
    expect(e.bins[0].values).toHaveLength(24);
  });
});

describe("§19.5.3 automatic bins", () => {
  it("an enum coverpoint gets one bin per enum constant (N = cardinality)", () => {
    expect(automaticBins(2, 64, ["READ", "WRITE", "BURST"]).map((b) => b.name)).toEqual(["auto[READ]", "auto[WRITE]", "auto[BURST]"]);
  });

  it("M = 3 bits and N = 3 bins distribute as <0,1>, <2,3>, <4,5,6,7>", () => {
    expect(automaticBins(3, 3).map((b) => b.values)).toEqual([[0, 1], [2, 3], [4, 5, 6, 7]]);
  });

  it("the default auto_bin_max is 64 (Table 19-1): an 8-bit value gets 64 bins of 4 values", () => {
    const e = elaborateCoverpoint({ name: "c", expr: "x", width: 8, bins: [] });
    expect(e.autoBins).toBe(true);
    expect(e.bins).toHaveLength(64);
    expect(e.bins[1].name).toBe("auto[4:7]");
  });

  it("automatic bins are still created when only ignore_bins/illegal_bins are declared", () => {
    const e = elaborateCoverpoint(cp({ width: 2, bins: [{ form: "values", keyword: "ignore_bins", name: "ig", values: [3] }] }));
    expect(e.autoBins).toBe(true);
    expect(e.bins.filter((b) => b.counted).map((b) => b.name)).toEqual(["auto[0]", "auto[1]", "auto[2]"]);
  });

  it("§19.11.1 example: auto_bin_max = 4 with ignore_bins {[0:1],[5:6]} leaves 3 countable bins; the empty one is excluded", () => {
    const e = elaborateCoverpoint({ name: "b", expr: "b", width: 3, autoBinMax: 4, bins: [{ form: "values", keyword: "ignore_bins", name: "ig", values: [[0, 1], [5, 6]] }] });
    const counted = e.bins.filter((b) => b.counted);
    expect(counted.map((b) => b.values)).toEqual([[2, 3], [4], [7]]);
    expect(e.bins.find((b) => b.name === "auto[0:1]")?.counted).toBe(false);
  });
});

describe("§19.5.4 wildcard bins", () => {
  it("wildcard bins g12_15 = {4'b11??} counts 12, 13, 14 and 15", () => {
    const e = elaborateCoverpoint(cp({ bins: [{ form: "wildcard", keyword: "bins", name: "g12_15", pattern: "4'b11??" }] }));
    expect(e.bins[0].values).toEqual([12, 13, 14, 15]);
  });

  it("wildcard bins g12_15_array[] creates a separate bin for each matching value", () => {
    const e = elaborateCoverpoint(cp({ bins: [{ form: "wildcard", keyword: "bins", name: "g", array: "open", pattern: "4'b11??" }] }));
    expect(e.bins.map((b) => b.name)).toEqual(["g[12]", "g[13]", "g[14]", "g[15]"]);
  });
});

describe("§19.5.2 transition bins", () => {
  const lrmSequence = [1, 4, 3, 2, 3, 3, 2, 2, 3, 2, 3, 1, 5, 5, 5, 5, 5, 5];
  const spec: CovergroupSpec = {
    name: "sg",
    coverpoints: [
      {
        name: "v",
        expr: "v",
        width: 4,
        bins: [
          { form: "transition", keyword: "bins", name: "b2", sequences: [[{ values: [2], repeat: { op: "->", min: 3, max: 5 } }]] },
          { form: "transition", keyword: "bins", name: "b3", sequences: [[{ values: [3], repeat: { op: "->", min: 3, max: 5 } }]] },
          { form: "transition", keyword: "bins", name: "b5", sequences: [[{ values: [5], repeat: { op: "*", min: 3, max: 3 } }]] },
          {
            form: "transition",
            keyword: "bins",
            name: "b6",
            sequences: [[{ values: [1] }, { values: [3], repeat: { op: "->", min: 4, max: 6 } }, { values: [1] }]],
          },
        ],
      },
    ],
  };
  const incrementsOf = (bin: string) => {
    const { records } = run(spec, lrmSequence.map((v) => ({ v })));
    return records.filter((r) => r.hits.includes(`v.${bin}`)).map((r) => r.index + 1);
  };

  it("LRM example: goto b2 = (2 [-> 3:5]) increments on samples 8 and 10", () => {
    expect(incrementsOf("b2")).toEqual([8, 10]);
  });

  it("LRM example: goto b3 = (3 [-> 3:5]) increments on samples 6, 9 and 11", () => {
    expect(incrementsOf("b3")).toEqual([6, 9, 11]);
  });

  it("LRM example: consecutive b5 = (5 [* 3]) increments on samples 15, 16, 17 and 18 (overlapping matches count)", () => {
    expect(incrementsOf("b5")).toEqual([15, 16, 17, 18]);
  });

  it("LRM example: b6 = (1 => 3 [-> 4:6] => 1) increments on sample 12, where the 1 immediately follows the last 3", () => {
    expect(incrementsOf("b6")).toEqual([12]);
  });

  it("a transition bin increments at most once per sample even when two matches end together (sample 10 for b2)", () => {
    const { final } = run(spec, lrmSequence.map((v) => ({ v })));
    expect(item(final.items, "v").bins.find((b) => b.name === "b2")?.hits).toBe(2);
  });

  it("(1, 5 => 6, 7) as an array expands to the four transitions 1=>6, 1=>7, 5=>6, 5=>7", () => {
    const e = elaborateCoverpoint(cp({ bins: [{ form: "transition", keyword: "bins", name: "t", array: "open", sequences: [[{ values: [1, 5] }, { values: [6, 7] }]] }] }));
    expect(e.bins.map((b) => b.name)).toEqual(["t[1=>6]", "t[1=>7]", "t[5=>6]", "t[5=>7]"]);
  });

  it("3 [* 3:5] is the same as (3=>3=>3), (3=>3=>3=>3), (3=>3=>3=>3=>3)", () => {
    const e = elaborateCoverpoint(cp({ bins: [{ form: "transition", keyword: "bins", name: "r", array: "open", sequences: [[{ values: [3], repeat: { op: "*", min: 3, max: 5 } }]] }] }));
    expect(e.bins.map((b) => b.name)).toEqual(["r[3=>3=>3]", "r[3=>3=>3=>3]", "r[3=>3=>3=>3=>3]"]);
  });

  it("transitions of length 0 such as (0) or (0 [* 1]) are illegal", () => {
    const e = elaborateCoverpoint(cp({ bins: [{ form: "transition", keyword: "bins", name: "z", sequences: [[{ values: [0] }], [{ values: [0], repeat: { op: "*", min: 1, max: 1 } }]] }] }));
    expect(e.diagnostics.join(" ")).toMatch(/length 0/);
    expect(e.bins[0].counted).toBe(false);
  });

  it("a goto repetition cannot form an array of bins (its length is not fixed)", () => {
    const e = elaborateCoverpoint(cp({ bins: [{ form: "transition", keyword: "bins", name: "g", array: "open", sequences: [[{ values: [1] }, { values: [2], repeat: { op: "->", min: 2, max: 2 } }]] }] }));
    expect(e.diagnostics.join(" ")).toMatch(/cannot form an array/);
  });

  it("§19.5.5: the ignored sequence 2=>3 removes the covered sequence 1=>2=>3=>4", () => {
    const e = elaborateCoverpoint(
      cp({
        bins: [
          { form: "transition", keyword: "bins", name: "s", array: "open", sequences: [[{ values: [1] }, { values: [2] }, { values: [3] }, { values: [4] }], [{ values: [5] }, { values: [6] }]] },
          { form: "transition", keyword: "ignore_bins", name: "ig", sequences: [[{ values: [2] }, { values: [3] }]] },
        ],
      }),
    );
    const s = e.bins.filter((b) => b.declName === "s");
    expect(s.map((b) => b.counted)).toEqual([false, true]);
  });
});

describe("§19.5 default bins", () => {
  const withDefault = cp({ bins: [{ form: "values", keyword: "bins", name: "low", values: [[0, 3]] }, { form: "default", name: "others" }] });
  const withoutDefault = cp({ bins: [{ form: "values", keyword: "bins", name: "low", values: [[0, 3]] }] });

  it("a value outside every bin lands in the default bin, which never counts toward coverage", () => {
    const e = elaborateCoverpoint(withDefault);
    expect(classifyValue(e, 9).outcome).toBe("default");
    const { final } = run({ name: "cg", coverpoints: [withDefault] }, [{ v: 9 }]);
    expect(item(final.items, "cp")).toMatchObject({ covered: 0, total: 1, percent: 0 });
  });

  it("without a default bin the value is simply not counted — there is no implicit 'covered by default'", () => {
    const e = elaborateCoverpoint(withoutDefault);
    const c = classifyValue(e, 9);
    expect(c.outcome).toBe("none");
    expect(c.hits).toHaveLength(0);
    expect(c.why).toMatch(/not counted/);
  });

  it("default bins are not crossed (§19.6)", () => {
    const g = elaborateCovergroup({
      name: "cg",
      coverpoints: [withDefault, { name: "op", expr: "op", width: 1, bins: [] }],
      crosses: [{ name: "x", coverpoints: ["cp", "op"] }],
    });
    expect(g.crosses[0].products).toHaveLength(2); // low × {auto[0], auto[1]}
    expect(g.crosses[0].axes[0].map((b) => b.name)).toEqual(["low"]);
  });
});

describe("§19.5.5 ignore_bins and §19.5.6 illegal_bins", () => {
  it("values are removed after distribution: q[2] = {[0:7]} with ignore {[4:7]} leaves q[0] = 0..3 and an empty, excluded q[1]", () => {
    const e = elaborateCoverpoint(cp({ bins: [{ form: "values", keyword: "bins", name: "q", array: 2, values: [[0, 7]] }, { form: "values", keyword: "ignore_bins", name: "skip", values: [[4, 7]] }] }));
    expect(e.bins.find((b) => b.name === "q[0]")?.values).toEqual([0, 1, 2, 3]);
    expect(e.bins.find((b) => b.name === "q[1]")?.counted).toBe(false);
  });

  it("an illegal value reports a run-time error, counts in no bin, and takes precedence over bins and ignore_bins", () => {
    const spec = cp({
      bins: [
        { form: "values", keyword: "bins", name: "high", values: [[12, 15]] },
        { form: "values", keyword: "ignore_bins", name: "skip", values: [13] },
        { form: "values", keyword: "illegal_bins", name: "bad", values: [13] },
      ],
    });
    const e = elaborateCoverpoint(spec);
    expect(classifyValue(e, 13).outcome).toBe("illegal");
    const { final, records } = run({ name: "cg", coverpoints: [spec] }, [{ v: 13 }, { v: 12 }]);
    expect(records[0].errors).toHaveLength(1);
    expect(records[0].errors[0].message).toMatch(/illegal_bins cp\.bad/);
    // The simulation keeps sampling after the error (stopping is a tool setting): 12 still counts.
    expect(item(final.items, "cp").bins.find((b) => b.name === "high")?.hits).toBe(1);
  });

  it("an ignored value is excluded from coverage and never reaches the default bin", () => {
    const e = elaborateCoverpoint(cp({ bins: [{ form: "values", keyword: "ignore_bins", name: "skip", values: [5] }, { form: "values", keyword: "bins", name: "b", values: [1] }, { form: "default", name: "others" }] }));
    expect(classifyValue(e, 5).outcome).toBe("ignored");
  });
});

const sixteenBy: CovergroupSpec = {
  name: "cov3",
  coverpoints: [
    { name: "b", expr: "b_var", width: 4, bins: [] },
    { name: "A", expr: "a_var", width: 8, bins: [{ form: "values", keyword: "bins", name: "yy", array: "open", values: [[0, 9]] }] },
  ],
  crosses: [{ name: "CC", coverpoints: ["b", "A"] }],
};

describe("§19.6 cross coverage", () => {
  it("a cross is the Cartesian product of the coverpoint bins: 16 auto bins × 10 yy bins = 160 cross bins", () => {
    const g = elaborateCovergroup(sixteenBy);
    expect(g.crosses[0].products).toHaveLength(160);
    expect(g.crosses[0].autoCount).toBe(160);
  });

  it("a sample counts in the cross only when every crossed coverpoint matches a counted bin", () => {
    const { final } = run(sixteenBy, [{ b_var: 3, a_var: 4 }, { b_var: 3, a_var: 200 }]);
    expect(item(final.items, "CC").covered).toBe(1);
  });

  const lrmCross: CovergroupSpec = {
    name: "cg",
    coverpoints: [
      { name: "a", expr: "v_a", width: 8, bins: [0, 64, 128, 192].map((lo, i) => ({ form: "values" as const, keyword: "bins" as const, name: `a${i + 1}`, values: [[lo, lo + 63] as const] })) },
      {
        name: "b",
        expr: "v_b",
        width: 8,
        bins: [
          { form: "values", keyword: "bins", name: "b1", values: [0] },
          { form: "values", keyword: "bins", name: "b2", values: [[1, 84]] },
          { form: "values", keyword: "bins", name: "b3", values: [[85, 169]] },
          { form: "values", keyword: "bins", name: "b4", values: [[170, 255]] },
        ],
      },
    ],
    crosses: [
      {
        name: "c",
        coverpoints: ["a", "b"],
        bins: [
          { keyword: "bins", name: "c1", select: { op: "binsof", coverpoint: "a", intersect: [[100, 200]], negate: true } },
          { keyword: "bins", name: "c2", select: { op: "or", left: { op: "binsof", coverpoint: "a", bin: "a2" }, right: { op: "binsof", coverpoint: "b", bin: "b2" } } },
          { keyword: "bins", name: "c3", select: { op: "and", left: { op: "binsof", coverpoint: "a", bin: "a1" }, right: { op: "binsof", coverpoint: "b", bin: "b4" } } },
        ],
      },
    ],
  };

  it("§19.6.1.1 example: c1 has 4 products, c2 has 7, c3 has 1, and 6 automatic bins are retained", () => {
    const x = elaborateCovergroup(lrmCross).crosses[0];
    const size = (n: string) => x.bins.find((b) => b.name === n)?.products.length;
    expect([size("c1"), size("c2"), size("c3")]).toEqual([4, 7, 1]);
    expect(x.bins.filter((b) => b.kind === "auto").map((b) => b.name).sort()).toEqual(
      ["<a3,b1>", "<a4,b1>", "<a3,b3>", "<a4,b3>", "<a3,b4>", "<a4,b4>"].sort(),
    );
  });

  it("§19.11.2: cross coverage = covered / (Bc + Bu): 6 auto bins + 3 user bins = 9", () => {
    const { final } = run(lrmCross, [{ v_a: 10, v_b: 0 }]); // <a1,b1> lies in c1
    expect(item(final.items, "c")).toMatchObject({ covered: 1, total: 9 });
  });

  const opCross = (extra: CovergroupSpec["crosses"]): CovergroupSpec => ({
    name: "cg",
    coverpoints: [
      { name: "cp_addr", expr: "addr", width: 6, bins: [{ form: "values", keyword: "bins", name: "low", values: [[0, 15]] }, { form: "values", keyword: "bins", name: "mid", values: [[16, 47]] }, { form: "values", keyword: "bins", name: "high", values: [[48, 63]] }] },
      { name: "cp_op", expr: "op", width: 2, enumLabels: ["READ", "WRITE", "BURST"], bins: [] },
    ],
    crosses: extra,
  });

  it("ignore_bins selected with binsof(cp.bin) && binsof(cp) intersect {value} leave Bc = 8 of 9 products", () => {
    const g = elaborateCovergroup(
      opCross([
        {
          name: "x",
          coverpoints: ["cp_addr", "cp_op"],
          bins: [{ keyword: "ignore_bins", name: "ign", select: { op: "and", left: { op: "binsof", coverpoint: "cp_addr", bin: "high" }, right: { op: "binsof", coverpoint: "cp_op", intersect: [2] } } }],
        },
      ]),
    );
    expect(g.crosses[0].autoCount + g.crosses[0].userCount).toBe(8);
    expect(g.crosses[0].products.filter((p) => p.status === "ignored").map((p) => p.label)).toEqual(["<high,auto[BURST]>"]);
  });

  it("§19.6.2: an ignored product is excluded even when a user bin also selects it", () => {
    const g = elaborateCovergroup(
      opCross([
        {
          name: "x",
          coverpoints: ["cp_addr", "cp_op"],
          bins: [
            { keyword: "bins", name: "all_high", select: { op: "binsof", coverpoint: "cp_addr", bin: "high" } },
            { keyword: "ignore_bins", name: "ign", select: { op: "and", left: { op: "binsof", coverpoint: "cp_addr", bin: "high" }, right: { op: "binsof", coverpoint: "cp_op", intersect: [2] } } },
          ],
        },
      ]),
    );
    expect(g.crosses[0].bins.find((b) => b.name === "all_high")?.products).toHaveLength(2);
  });

  it("§19.6.3: an illegal cross product raises a run-time error even if it is also ignored", () => {
    const spec = opCross([
      {
        name: "x",
        coverpoints: ["cp_addr", "cp_op"],
        bins: [
          { keyword: "ignore_bins", name: "ign", select: { op: "binsof", coverpoint: "cp_op", intersect: [2] } },
          { keyword: "illegal_bins", name: "bad", select: { op: "and", left: { op: "binsof", coverpoint: "cp_addr", bin: "high" }, right: { op: "binsof", coverpoint: "cp_op", intersect: [2] } } },
        ],
      },
    ]);
    const { records } = run(spec, [{ addr: 50, op: 2 }]);
    expect(records[0].errors.map((e) => e.bin)).toEqual(["bad"]);
  });
});

describe("§19.11 coverage computation", () => {
  const spec: CovergroupSpec = {
    name: "cg",
    coverpoints: [
      { name: "p", expr: "p", width: 1, bins: [] },
      { name: "q", expr: "q", width: 2, bins: [] },
    ],
  };

  it("covergroup coverage is the weighted average of its items (option.weight)", () => {
    const { final } = run(spec, [{ p: 0, q: 0 }, { p: 1, q: 0 }]); // p = 100%, q = 25%
    expect(final.percent).toBeCloseTo((100 + 25) / 2, 6);
    const weighted = run({ ...spec, coverpoints: [{ ...spec.coverpoints[0], weight: 3 }, spec.coverpoints[1]] }, [{ p: 0, q: 0 }, { p: 1, q: 0 }]);
    expect(weighted.final.percent).toBeCloseTo((3 * 100 + 25) / 4, 6);
  });

  it("an item with option.weight = 0 does not move the covergroup number", () => {
    const { final } = run({ ...spec, coverpoints: [{ ...spec.coverpoints[0], weight: 0 }, spec.coverpoints[1]] }, [{ p: 0, q: 1 }]);
    expect(final.percent).toBeCloseTo(25, 6);
  });

  it("option.at_least: a bin is covered only when its hit count reaches at_least (Table 19-1)", () => {
    const withAtLeast: CovergroupSpec = { name: "cg", atLeast: 2, coverpoints: [{ name: "p", expr: "p", width: 1, bins: [] }] };
    expect(item(run(withAtLeast, [{ p: 1 }]).final.items, "p").covered).toBe(0);
    expect(item(run(withAtLeast, [{ p: 1 }, { p: 1 }]).final.items, "p").covered).toBe(1);
  });

  it("a coverpoint whose bins are all empty is excluded from the covergroup average (§19.11.1)", () => {
    const g: CovergroupSpec = {
      name: "cg",
      coverpoints: [
        { name: "p", expr: "p", width: 1, bins: [] },
        { name: "e", expr: "e", width: 2, bins: [{ form: "values", keyword: "bins", name: "only", values: [1] }, { form: "values", keyword: "ignore_bins", name: "ig", values: [1] }] },
      ],
    };
    const { final } = run(g, [{ p: 0, e: 0 }, { p: 1, e: 0 }]);
    expect(item(final.items, "e").excluded).toBe(true);
    expect(final.percent).toBe(100);
    expect(isClosed(final)).toBe(true);
  });
});

describe("§19.11.3 type coverage", () => {
  // covergroup gt (int l, h); coverpoint a { bins b[] = { [l:h] }; } endgroup
  const gt = (l: number, h: number): CovergroupSpec => ({ name: "gt", coverpoints: [{ name: "a", expr: "a", width: 2, bins: [{ form: "values", keyword: "bins", name: "b", array: "open", values: [[l, h]] }] }] });
  const gv1 = run(gt(0, 1), [{ a: 0 }, { a: 1 }]).final;
  const gv2 = run(gt(1, 2), [{ a: 1 }]).final;

  it("LRM example: instance coverage of gv1 is 100 and of gv2 is 50", () => {
    expect([gv1.percent, gv2.percent]).toEqual([100, 50]);
  });

  it("merge_instances = 1 computes the union of bins: 2 of b[0], b[1], b[2] → 66.67%", () => {
    expect(typeCoverage([{ snapshot: gv1 }, { snapshot: gv2 }], { mergeInstances: true })).toBeCloseTo(66.6667, 3);
  });

  it("merge_instances = 0 (the default) averages the instances, weighted by option.weight: (100 + 50) / 2 = 75", () => {
    expect(typeCoverage([{ snapshot: gv1 }, { snapshot: gv2 }], { mergeInstances: false })).toBeCloseTo(75, 6);
    expect(typeCoverage([{ snapshot: gv1, weight: 3 }, { snapshot: gv2 }], { mergeInstances: false })).toBeCloseTo(87.5, 6);
  });
});

describe("§19.3 sampling", () => {
  const signals = { valid: [0, 1, 0, 1], addr: [13, 12, 14, 2] };
  const spec = (iff?: string): CovergroupSpec => ({
    name: "cg",
    coverpoints: [{ name: "cp_addr", expr: "addr", width: 4, iff, bins: [{ form: "values", keyword: "bins", name: "low", values: [[0, 3]] }, { form: "values", keyword: "bins", name: "high", values: [[12, 15]] }] }],
  });
  const highHits = (iff: string | undefined, mode: Parameters<typeof samplesFromClockedTrace>[2]) =>
    item(runCoverage(elaborateCovergroup(spec(iff)), samplesFromClockedTrace(signals, 4, mode)).final.items, "cp_addr").bins.find((b) => b.name === "high")?.hits;

  it("a clocking event samples once per edge, including idle cycles when there is no guard", () => {
    expect(samplesFromClockedTrace(signals, 4, "clock")).toHaveLength(4);
    expect(highHits(undefined, "clock")).toBe(3);
  });

  it("an iff guard that is false ignores the sample (§19.5)", () => {
    expect(highHits("valid", "clock")).toBe(1);
  });

  it("a manual sample() on the same edge as the clocking event samples twice (double counting)", () => {
    expect(samplesFromClockedTrace(signals, 4, "clock+sample")).toHaveLength(6);
    expect(highHits("valid", "clock+sample")).toBe(2);
  });

  it("sampling from a monitor once per valid transfer counts each transfer once", () => {
    expect(highHits(undefined, "sample-on-valid")).toBe(1);
  });
});

describe("seeded stimulus", () => {
  const vars = [{ name: "addr", width: 6 }, { name: "op", width: 2, enumLabels: ["READ", "WRITE", "BURST"] }];

  it("is deterministic for a seed and changes with the seed", () => {
    const spec: StimulusSpec = { vars };
    expect(generateStimulus(spec, 20, 7)).toEqual(generateStimulus(spec, 20, 7));
    expect(generateStimulus(spec, 20, 7)).not.toEqual(generateStimulus(spec, 20, 8));
  });

  it("dist := gives each value the weight; :/ shares the weight across the range (§18.5.4)", () => {
    const each = stimulusDistribution({ vars: [{ name: "x", width: 3 }], dist: { x: [{ values: [0, 3], weight: 1, op: ":=" }, { values: 7, weight: 4, op: ":=" }] } });
    const shared = stimulusDistribution({ vars: [{ name: "x", width: 3 }], dist: { x: [{ values: [0, 3], weight: 1, op: ":/" }, { values: 7, weight: 4, op: ":=" }] } });
    const p7 = (d: typeof each) => d.outcomes.find((o) => o.values.x === 7)?.p;
    expect(p7(each)).toBeCloseTo(4 / 8, 9);
    expect(p7(shared)).toBeCloseTo(4 / 5, 9);
    expect(each.outcomes.find((o) => o.values.x === 5)).toBeUndefined(); // dist also restricts the value set
  });

  it("an excluded combination is never generated and the rest is renormalised", () => {
    const spec: StimulusSpec = { vars, exclude: [[{ var: "addr", values: [[48, 63]] }, { var: "op", values: [2] }]] };
    const d = stimulusDistribution(spec);
    expect(d.outcomes).toHaveLength(64 * 3 - 16);
    expect(d.outcomes.reduce((s, o) => s + o.p, 0)).toBeCloseTo(1, 9);
    expect(generateStimulus(spec, 500, 3).some((s) => s.values.addr >= 48 && s.values.op === 2)).toBe(false);
    expect(stimulusToSource(spec).join("\n")).toContain("!(addr inside {[48:63]} && op == BURST);");
  });
});

describe("closure forecast (coupon collector)", () => {
  const grid: CovergroupSpec = {
    name: "cg",
    coverpoints: [
      { name: "cp_addr", expr: "addr", width: 6, bins: [{ form: "values", keyword: "bins", name: "low", values: [[0, 15]] }, { form: "values", keyword: "bins", name: "mid", values: [[16, 47]] }, { form: "values", keyword: "bins", name: "high", values: [[48, 63]] }] },
      { name: "cp_op", expr: "op", width: 2, enumLabels: ["READ", "WRITE", "BURST"], bins: [] },
    ],
    crosses: [{ name: "x", coverpoints: ["cp_addr", "cp_op"] }],
  };
  const vars = [{ name: "addr", width: 6 }, { name: "op", width: 2, enumLabels: ["READ", "WRITE", "BURST"] }];
  const equalThirds: StimulusSpec = { vars, dist: { addr: [{ values: [0, 15], weight: 1, op: ":/" }, { values: [16, 47], weight: 1, op: ":/" }, { values: [48, 63], weight: 1, op: ":/" }] } };

  it("k equally likely disjoint bins need k·H_k samples on average: 9 cells → 25.46", () => {
    const f = forecastClosure(elaborateCovergroup(grid), equalThirds);
    expect(f.gating).toHaveLength(9); // coverpoint bins are implied by the cross cells
    expect(f.expectedSamples).toBeCloseTo(9 * harmonic(9), 1);
    expect(f.couponBaseline).toBeCloseTo(25.46, 2);
  });

  it("inclusion–exclusion and the Poisson integral agree on unequal disjoint bins", () => {
    const ps = [0.5, 0.3, 0.15, 0.05];
    const sig = new Map(ps.map((p, i) => [1 << i, p]));
    expect(expectedSamplesInclusionExclusion(4, sig)).toBeCloseTo(expectedSamplesDisjoint(ps.map((p) => ({ p, atLeast: 1 }))), 2);
  });

  it("a constraint hole makes closure impossible and names the unreachable bin", () => {
    const f = forecastClosure(elaborateCovergroup(grid), { ...equalThirds, exclude: [[{ var: "addr", values: [[48, 63]] }, { var: "op", values: [2] }]] });
    expect(f.expectedSamples).toBe(Infinity);
    expect(f.unreachable.map((t) => t.name)).toEqual(["<high,auto[BURST]>"]);
  });

  it("matches a seeded Monte Carlo average within 8%", () => {
    const biased: StimulusSpec = { vars, dist: { op: [{ values: 0, weight: 6, op: ":=" }, { values: 1, weight: 3, op: ":=" }, { values: 2, weight: 1, op: ":=" }] } };
    const model = elaborateCovergroup(grid);
    const f = forecastClosure(model, biased);
    let total = 0;
    const runs = 200;
    for (let seed = 1; seed <= runs; seed += 1) {
      const acc = createCoverageAccumulator(model);
      let n = 0;
      for (const s of generateStimulus(biased, 3000, seed)) {
        n += 1;
        acc.apply(s);
        if (isClosed(acc.snapshot())) break;
      }
      total += n;
    }
    expect(total / runs).toBeGreaterThan(f.expectedSamples * 0.92);
    expect(total / runs).toBeLessThan(f.expectedSamples * 1.08);
    expect(f.probabilityWithin(10)).toBeLessThan(f.probabilityWithin(100));
  });
});

describe("generated SystemVerilog", () => {
  const spec: CovergroupSpec = {
    name: "cg_bus",
    event: { kind: "sample", args: "bit [5:0] addr, op_t op" },
    coverpoints: [
      { name: "cp_addr", expr: "addr", width: 6, autoBinMax: 4, bins: [] },
      { name: "cp_op", expr: "op", width: 2, enumLabels: ["READ", "WRITE", "BURST"], bins: [{ form: "values", keyword: "bins", name: "rd", values: [0] }] },
    ],
    crosses: [
      {
        name: "x",
        coverpoints: ["cp_addr", "cp_op"],
        bins: [{ keyword: "ignore_bins", name: "ign", select: { op: "and", left: { op: "binsof", coverpoint: "cp_addr", intersect: [[48, 63]] }, right: { op: "binsof", coverpoint: "cp_op", bin: "rd" } } }],
      },
    ],
  };

  it("names bins with binsof(cp.bin) and value sets with binsof(cp) intersect {…}", () => {
    const text = covergroupToSource(spec).join("\n");
    expect(text).toContain("ignore_bins ign = binsof(cp_addr) intersect {[48:63]} && binsof(cp_op.rd);");
    expect(text).toContain("covergroup cg_bus with function sample(bit [5:0] addr, op_t op);");
  });

  it("auto_bin_max is an instance option (option.auto_bin_max), never type_option (§19.7, Table 19-2)", () => {
    const text = covergroupToSource(spec).join("\n");
    expect(text).toContain("option.auto_bin_max = 4;");
    expect(text).not.toContain("type_option.auto_bin_max");
  });

  it("parenthesises a nested || inside &&", () => {
    expect(
      selectToSource(
        { op: "and", left: { op: "or", left: { op: "binsof", coverpoint: "a", bin: "x" }, right: { op: "binsof", coverpoint: "a", bin: "y" } }, right: { op: "binsof", coverpoint: "b", bin: "z", negate: true } },
        [],
      ),
    ).toBe("(binsof(a.x) || binsof(a.y)) && ! binsof(b.z)");
  });
});

describe("bins editor parsing", () => {
  it("reads range lists with sized literals and $", () => {
    const r = parseRangeListText("{[0:3], 7, 4'hC, [14:$]}", 15);
    expect(r).toEqual({ ok: true, value: [[0, 3], 7, 12, [14, 15]] });
    expect(parseRangeListText("[5:2]", 15).ok).toBe(false);
    expect(parseRangeListText("16", 15).ok).toBe(false);
  });

  it("reads transition lists with consecutive and goto repetition, and rejects [= n]", () => {
    const r = parseTransitionText("(0 => 1 => 2), (5 [* 3]), (8 => 9 [-> 2] => 10)", 15);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(3);
    expect(r.value[1][0].repeat).toEqual({ op: "*", min: 3, max: 3 });
    expect(r.value[2][1].repeat).toEqual({ op: "->", min: 2, max: 2 });
    expect(parseTransitionText("(1 [= 2])", 15).ok).toBe(false);
  });
});

describe("cross explorer: marked cells → ignore_bins / illegal_bins (§19.6.1–§19.6.3)", () => {
  const addrIds = Object.keys(addrPresets) as AddrPresetId[];
  const opIds = Object.keys(opPresets) as OpPresetId[];

  it("for every preset, the generated selects exclude exactly the marked cells — single cells, whole rows and whole columns", () => {
    for (const addr of addrIds) {
      for (const op of opIds) {
        const base = elaborateCovergroup(buildExplorerSpec({ addr, op, marks: {} })).crosses[0];
        const [rows, cols] = base.axes;
        const key = (r: number, c: number) => `${rows[r].key}|${cols[c].key}`;
        const marks: Record<string, CellMark> = {};
        cols.forEach((_, c) => (marks[key(0, c)] = "ignore")); // whole first row
        rows.forEach((_, r) => (marks[key(r, cols.length - 1)] = "illegal")); // whole last column (wins on the overlap)
        if (rows.length > 1 && cols.length > 2) marks[key(rows.length - 1, 0)] = "ignore"; // one single cell
        const x = elaborateCovergroup(buildExplorerSpec({ addr, op, marks })).crosses[0];
        for (const p of x.products) {
          const want = marks[p.key];
          const got = p.status === "ignored" ? "ignore" : p.status === "illegal" ? "illegal" : undefined;
          expect(got, `${addr}/${op} ${p.label}`).toBe(want);
        }
        const text = covergroupToSource(buildExplorerSpec({ addr, op, marks })).join("\n");
        expect(text).not.toMatch(/intersect \{[a-z]/); // intersect never takes a bin name
      }
    }
  });
});
