import { describe, expect, it } from "vitest";

import {
  bindToSource,
  elaborateGenerate,
  generateBlockNames,
  resolveBinds,
  type BindDirective,
  type DesignInstance,
} from "@/lib/sv-elaboration-model";

const design: DesignInstance[] = [
  { path: "tb_top.dut", module: "soc" },
  { path: "tb_top.dut.u_slave_0", module: "ahb_slave", localNames: ["u_fifo"] },
  { path: "tb_top.dut.u_slave_1", module: "ahb_slave", localNames: ["u_fifo"] },
  { path: "tb_top.dut.u_spi", module: "spi_ctrl" },
];

const chk = (over: Partial<BindDirective>): BindDirective => ({
  form: "module",
  target: "ahb_slave",
  unit: "ahb_protocol_chk",
  instanceName: "chk_inst",
  ports: ".hclk(clk_i), .haddr(addr_i)",
  ...over,
});

describe("sv-elaboration-model: bind (§23.11)", () => {
  it("binding to a module inserts the instance into every instance of that module, designwide", () => {
    const result = resolveBinds(design, [chk({})]);
    expect(result.errors).toEqual([]);
    expect(result.bound.map((b) => b.path)).toEqual(["tb_top.dut.u_slave_0.chk_inst", "tb_top.dut.u_slave_1.chk_inst"]);
  });

  it("binding to an instance path inserts it into that instance only", () => {
    const result = resolveBinds(design, [chk({ form: "instance", target: "tb_top.dut.u_slave_0" })]);
    expect(result.bound.map((b) => b.path)).toEqual(["tb_top.dut.u_slave_0.chk_inst"]);
  });

  it("the module : instance-list form binds only the listed instances of that module", () => {
    const result = resolveBinds(design, [chk({ form: "module-list", instances: ["tb_top.dut.u_slave_1"] })]);
    expect(result.bound.map((b) => b.path)).toEqual(["tb_top.dut.u_slave_1.chk_inst"]);
    const wrong = resolveBinds(design, [chk({ form: "module-list", instances: ["tb_top.dut.u_spi"] })]);
    expect(wrong.errors).toHaveLength(1);
  });

  it("the bound instance lives in the target scope, not in the scope that contains the bind", () => {
    const result = resolveBinds(design, [chk({})]);
    expect(result.bound.every((b) => !b.path.startsWith("tb_top.chk_inst"))).toBe(true);
    expect(result.bound[0].parent).toBe("tb_top.dut.u_slave_0");
  });

  it("an instance name that clashes with one introduced by another bind is an error", () => {
    const result = resolveBinds(design, [chk({}), chk({ unit: "ahb_cov" })]);
    expect(result.bound).toHaveLength(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].clause).toBe("§23.11");
  });

  it("an instance name that clashes with an existing name in the target is an error", () => {
    const result = resolveBinds(design, [chk({ instanceName: "u_fifo" })]);
    expect(result.bound).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
  });

  it("emits the three syntactic forms", () => {
    expect(bindToSource(chk({}))).toBe("bind ahb_slave ahb_protocol_chk chk_inst (.hclk(clk_i), .haddr(addr_i));");
    expect(bindToSource(chk({ form: "module-list", instances: ["tb_top.dut.u_slave_1"] }))).toMatch(/^bind ahb_slave : tb_top\.dut\.u_slave_1 ahb_protocol_chk chk_inst/);
    expect(bindToSource(chk({ form: "instance", target: "tb_top.dut.u_slave_0" }))).toMatch(/^bind tb_top\.dut\.u_slave_0 ahb_protocol_chk/);
  });
});

describe("sv-elaboration-model: generate block names (§27.4, §27.6)", () => {
  it("a labelled loop creates <label>[i].<instance>", () => {
    const paths = elaborateGenerate({
      path: "tb_top",
      declared: ["clk"],
      constructs: [{ kind: "loop", label: "gen_chk", iterations: 3, items: ["chk_inst"] }],
    });
    expect(paths).toEqual(["tb_top.gen_chk[0].chk_inst", "tb_top.gen_chk[1].chk_inst", "tb_top.gen_chk[2].chk_inst"]);
  });

  it("an unlabelled loop is named genblk<n>, where n counts every generate construct in the scope, named or not", () => {
    const alone = elaborateGenerate({ path: "tb_top", declared: [], constructs: [{ kind: "loop", iterations: 2, items: ["chk_inst"] }] });
    expect(alone).toEqual(["tb_top.genblk1[0].chk_inst", "tb_top.genblk1[1].chk_inst"]);
    const second = elaborateGenerate({
      path: "tb_top",
      declared: [],
      constructs: [
        { kind: "if", label: "gen_cov", condition: true, items: ["cov_inst"] },
        { kind: "loop", iterations: 1, items: ["chk_inst"] },
      ],
    });
    expect(second).toEqual(["tb_top.gen_cov.cov_inst", "tb_top.genblk2[0].chk_inst"]);
  });

  it("reproduces the LRM §27.6 example, including leading zeros and nested numbering", () => {
    const constructs = [
      { kind: "if" as const, condition: true, items: ["b"] },
      { kind: "if" as const, condition: true, items: ["b"] },
      { kind: "loop" as const, label: "g1", iterations: 1, items: [], nested: [{ kind: "if" as const, condition: true, items: ["a"] }] },
      { kind: "loop" as const, iterations: 1, items: [], nested: [{ kind: "if" as const, condition: true, items: ["a"] }] },
      { kind: "if" as const, condition: true, items: ["a"] },
    ];
    expect(generateBlockNames(["genblk2", "i"], constructs)).toEqual(["genblk1", "genblk02", "g1", "genblk4", "genblk5"]);
    expect(elaborateGenerate({ path: "top", declared: ["genblk2", "i"], constructs })).toEqual([
      "top.genblk1.b",
      "top.genblk02.b",
      "top.g1[0].genblk1.a",
      "top.genblk4[0].genblk1.a",
      "top.genblk5.a",
    ]);
  });

  it("an if-generate whose condition is false creates no block but still consumes its number", () => {
    const paths = elaborateGenerate({
      path: "tb_top",
      declared: [],
      constructs: [
        { kind: "if", condition: false, items: ["cov_inst"] },
        { kind: "if", condition: true, items: ["mon"] },
      ],
    });
    expect(paths).toEqual(["tb_top.genblk2.mon"]);
  });
});
