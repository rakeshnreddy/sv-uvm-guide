import { describe, expect, it } from "vitest";

import { codeSurfaceHljsStyle, codeSurfaceStyleKey } from "@/lib/code-surface-hljs";
import {
  highlightCode,
  normalizeCode,
  parseHighlightedHtml,
  resolveCodeLanguage,
  splitTokenLines,
} from "@/lib/highlight-code";

const lineText = (line: { text: string }[]) => line.map((token) => token.text).join("");

describe("resolveCodeLanguage", () => {
  it("labels the curriculum's fence names in their own spelling", () => {
    expect(resolveCodeLanguage("systemverilog")).toEqual({ id: "systemverilog", grammar: "verilog", label: "SystemVerilog" });
    expect(resolveCodeLanguage("SV").label).toBe("SystemVerilog");
    expect(resolveCodeLanguage("bash")).toMatchObject({ grammar: "bash", label: "Bash" });
    expect(resolveCodeLanguage("cpp").label).toBe("C++");
    expect(resolveCodeLanguage("tcl").label).toBe("Tcl");
    expect(resolveCodeLanguage("yaml").label).toBe("YAML");
  });

  it("treats text and PSS as plain text, and keeps unknown names", () => {
    expect(resolveCodeLanguage("text")).toEqual({ id: "text", label: "Text" });
    expect(resolveCodeLanguage("pss")).toEqual({ id: "pss", label: "PSS" });
    expect(resolveCodeLanguage("vhdl")).toEqual({ id: "vhdl", label: "vhdl" });
    expect(resolveCodeLanguage(undefined)).toEqual({ id: "", label: "Code" });
  });
});

describe("parseHighlightedHtml", () => {
  it("decodes entities and takes the innermost styled span", () => {
    const tokens = parseHighlightedHtml(
      '<span class="hljs-string">&quot;a&lt;&amp;&gt;&#x27;<span class="hljs-subst">x</span></span> y',
    );
    expect(tokens).toEqual([
      { text: "\"a<&>'", style: "hljs-string" },
      // hljs-subst has no rule of its own, so it keeps the string colour.
      { text: "x", style: "hljs-string" },
      { text: " y" },
    ]);
  });

  it("maps class titles to the type colour", () => {
    expect(codeSurfaceStyleKey("hljs-title class_")).toBe("hljs-class .hljs-title");
    expect(codeSurfaceStyleKey("hljs-title function_")).toBe("hljs-title");
    expect(codeSurfaceStyleKey("hljs-unknown")).toBeUndefined();
  });
});

describe("highlightCode", () => {
  it("highlights SystemVerilog keywords, numbers and strings", () => {
    const [line] = highlightCode('class a extends b; int x = 8\'hFF; string s = "hi"; endclass', "systemverilog");
    const styled = Object.fromEntries(line.filter((t) => t.style).map((t) => [t.text, t.style]));
    expect(styled.class).toBe("hljs-keyword");
    expect(styled.endclass).toBe("hljs-keyword");
    expect(styled["8'hFF"]).toBe("hljs-number");
    expect(styled['"hi"']).toBe("hljs-string");
    for (const token of line) if (token.style) expect(codeSurfaceHljsStyle[token.style]).toBeDefined();
  });

  it("splits a multi-line comment into one token per line, keeping its colour", () => {
    const lines = highlightCode("/* one\n   two */\nlogic a;", "systemverilog");
    expect(lines.map(lineText)).toEqual(["/* one", "   two */", "logic a;"]);
    expect(lines[0][0]).toEqual({ text: "/* one", style: "hljs-comment" });
    expect(lines[1][0]).toEqual({ text: "   two */", style: "hljs-comment" });
  });

  it("returns plain text line by line, empty lines included", () => {
    expect(highlightCode("UVM_INFO @ 0\n\nUVM_ERROR @ 10", "text")).toEqual([
      [{ text: "UVM_INFO @ 0" }],
      [],
      [{ text: "UVM_ERROR @ 10" }],
    ]);
  });

  it("keeps the text exactly, apart from blank lines at the start and whitespace at the end", () => {
    const source = "\n\n  module m;\n    wire w;\n  endmodule\n\n";
    expect(normalizeCode(source)).toBe("  module m;\n    wire w;\n  endmodule");
    expect(highlightCode(source, "systemverilog").map(lineText).join("\n")).toBe(normalizeCode(source));
  });

  it("splits tokens across line breaks without empty tokens", () => {
    expect(splitTokenLines([{ text: "a\n", style: "hljs-comment" }, { text: "b" }])).toEqual([
      [{ text: "a", style: "hljs-comment" }],
      [{ text: "b" }],
    ]);
  });
});
