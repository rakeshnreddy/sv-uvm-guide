import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

import { compileHeader, extractBlocks, inheritFiles, lessonUnits } from "../../scripts/compile-sv.mjs";

const LABS_DIR = path.resolve(__dirname, "../../content/curriculum/labs");
const labUnits = JSON.parse(fs.readFileSync(path.join(LABS_DIR, "compile-units.json"), "utf8")).labs as Record<
  string,
  { name: string; files: string[]; includeDirs?: string[] }[]
>;
const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../scripts/sv-compile.config.json"), "utf8")) as {
  inherit: Record<string, unknown>;
  known: Record<string, { kind: string; reason: string }>;
};

const fence = (header: string, body: string) => `\`\`\`systemverilog\n${header}\n${body}\n\`\`\``;

describe("compile-sv: lesson code blocks", () => {
  it("finds fenced blocks and InteractiveCode bodies, with the lesson line of their first line", () => {
    const source = [
      "# Lesson",
      fence("// compile", "module tb_top; endmodule"),
      '<InteractiveCode',
      '  language="systemverilog"',
      "  code={`",
      "// compile",
      "module tb_top; string s = \\`\"\\${x}\\`\"; endmodule`}",
      "/>",
    ].join("\n");
    const blocks = extractBlocks(source);
    expect(blocks.map((block) => [block.lang, block.line])).toEqual([["systemverilog", 3], ["systemverilog", 9]]);
    expect(blocks[1].code).toContain('string s = `"${x}`";');
  });

  it("reads the compile tag: a unit, a bench file, an addition to a file or to a package, or nothing", () => {
    expect(compileHeader("\n// compile\nmodule m; endmodule")).toEqual({ kind: "unit" });
    expect(compileHeader("// compile: mem_pkg.sv (file 3 of 5)")).toEqual({ kind: "file", file: "mem_pkg.sv" });
    expect(compileHeader("// compile: add to mem_seqs.svh, after mem_rand_seq")).toEqual({ kind: "add", file: "mem_seqs.svh" });
    expect(compileHeader("// compile (add to my_pkg, after mock_test)")).toEqual({ kind: "add-package", name: "my_pkg" });
    expect(compileHeader("// compile: needs bus_pkg from Make It Work")).toEqual({ kind: "unit" });
    expect(compileHeader("// snippet: the driver loop")).toBeNull();
  });

  it("numbers standalone units and groups named files into benches; a repeated name starts a new bench", () => {
    const source = [
      fence("// compile", "module a; endmodule"),
      fence("// compile: dut.sv", "module dut; endmodule"),
      fence("// compile: tb_top.sv", "module tb_top; dut u(); endmodule"),
      fence("// snippet", "dut u();"),
      fence("// compile: add to tb_top.sv", "// extra"),
      fence("// compile: tb_top.sv (the fixed version)", "module tb_top; endmodule"),
    ].join("\n\n");
    const units = lessonUnits("T1_Foundational/F0_Test/index.mdx", source);
    expect(units.map((unit) => unit.id)).toEqual([
      "T1_Foundational/F0_Test/index#1",
      "T1_Foundational/F0_Test/index#bench",
      "T1_Foundational/F0_Test/index#bench-2",
    ]);
    const [, bench, second] = units;
    expect(bench.files.map((file) => file.name)).toEqual(["dut.sv", "tb_top.sv"]);
    expect(bench.files[1].code).toContain("// extra");
    expect(second.files.map((file) => file.name)).toEqual(["dut.sv", "tb_top.sv"]);
    expect(second.files[1].code).toContain("the fixed version");
  });

  it("compiles an addition to a package inside the block that declares it", () => {
    const source = [
      fence("// compile", "package my_pkg;\n  class a; endclass\nendpackage\nmodule tb_top; endmodule"),
      fence("// compile (add to my_pkg, after a)", "class b extends a; endclass"),
    ].join("\n\n");
    const [, added] = lessonUnits("x/index.mdx", source);
    const code = added.files[0].code;
    expect(code.indexOf("class b extends a")).toBeGreaterThan(code.indexOf("class a"));
    expect(code.indexOf("class b extends a")).toBeLessThan(code.indexOf("endpackage"));
  });

  it("takes the files a bench does not show from the bench it builds on, in that bench's order", () => {
    const parent = { lesson: "p.mdx", files: [{ name: "a.sv" }, { name: "b.svh" }, { name: "c.sv" }] };
    expect(inheritFiles([{ name: "c.sv", own: true }], parent).map((file) => file.name)).toEqual(["a.sv", "b.svh", "c.sv"]);
    expect(inheritFiles([{ name: "c.sv" }], parent, ["b.svh"]).map((file) => [file.name, file.from])).toEqual([
      ["b.svh", "p.mdx"],
      ["c.sv", undefined],
    ]);
  });
});

describe("compile-sv: lab units and the known-failure list", () => {
  it("lists every lab that has SystemVerilog, with files that exist", () => {
    const labDirs = fs
      .readdirSync(LABS_DIR, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith("lab.json"))
      .map((file) => path.dirname(file));
    for (const dir of labDirs) {
      const svFiles = fs.readdirSync(path.join(LABS_DIR, dir), { recursive: true, encoding: "utf8" }).filter((file) => /\.svh?$/.test(file));
      if (svFiles.length) expect(Object.keys(labUnits), `${dir} has no compile units`).toContain(dir);
    }
    for (const [lab, units] of Object.entries(labUnits)) {
      expect(units.length, lab).toBeGreaterThan(0);
      for (const unit of units) {
        for (const file of unit.files) expect(fs.existsSync(path.join(LABS_DIR, lab, file)), `${lab}#${unit.name}: ${file}`).toBe(true);
        for (const dir of unit.includeDirs ?? []) expect(fs.existsSync(path.join(LABS_DIR, lab, dir)), `${lab}#${unit.name}: -I${dir}`).toBe(true);
      }
    }
  });

  it("gives every known failure a kind and a reason", () => {
    for (const [id, entry] of Object.entries(config.known)) {
      expect(["verilator-limitation", "content-bug", "harness", "to-verify"], id).toContain(entry.kind);
      expect(entry.reason.length, id).toBeGreaterThan(20);
    }
  });
});
