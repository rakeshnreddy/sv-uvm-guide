import React from "react";
import { describe, expect, it } from "vitest";

import { extractCodeText } from "@/components/ui/InteractiveCode";

describe("InteractiveCode source extraction", () => {
  it("reads the text of an MDX v2 fenced block (<pre><code>…</code></pre>)", () => {
    const fenced = (
      <pre>
        <code className="language-systemverilog">{"class Packet;\n  rand bit [7:0] addr;\nendclass\n"}</code>
      </pre>
    );
    expect(extractCodeText(fenced)).toBe("class Packet;\n  rand bit [7:0] addr;\nendclass\n");
    expect(extractCodeText(fenced)).not.toContain("[object Object]");
  });

  it("handles mapped components and arrays of children", () => {
    const Pre = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
    const nested = [
      <Pre key="a">
        <code>{["q <= d;", "\n"]}</code>
      </Pre>,
      "// tail",
    ];
    expect(extractCodeText(nested)).toBe("q <= d;\n// tail");
  });
});
