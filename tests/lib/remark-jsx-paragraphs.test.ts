import { describe, expect, it } from "vitest";
import { compileSync } from "@mdx-js/mdx";

import { remarkJsxParagraphs } from "@/lib/curriculum/remark-jsx-paragraphs";

const compile = (source: string, plugins: unknown[] = []) =>
  String(compileSync(source, { remarkPlugins: plugins as never, outputFormat: "function-body", development: false }));

describe("remarkJsxParagraphs", () => {
  const source = `<p className="note">\n  Launch the <strong>visualizer</strong>\n  to trace stimulus.\n</p>\n`;

  it("reproduces the nested paragraph without the plugin", () => {
    // MDX 2 wraps the indented text in a markdown paragraph inside the JSX <p>.
    expect(compile(source)).toMatch(/_components\.p,\s*\{\s*children:/);
  });

  it("removes the nested paragraph so <p> only contains phrasing content", () => {
    expect(compile(source, [remarkJsxParagraphs])).not.toMatch(/_components\.p,\s*\{\s*children:/);
  });

  it("leaves block containers such as <div> untouched", () => {
    const div = `<div>\n  First paragraph.\n</div>\n`;
    expect(compile(div, [remarkJsxParagraphs])).toMatch(/_components\.p/);
  });
});
