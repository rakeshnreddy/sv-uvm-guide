import { describe, expect, it } from "vitest";
import {
  compareWords,
  inspectSource,
  literalColours,
} from "../../scripts/figure-gates/source.cjs";

const draw = (body: string) =>
  `<figure><svg role="img" aria-label="Trace">${body}</svg><figcaption>A trace.</figcaption></figure>`;

describe("figure gate word proof", () => {
  it("compares every composition, aria value, caption and ordered repeated label", async () => {
    const before = draw(
      '<text>{"A"}</text><text>{"B"}</text><text>{"A"}</text>',
    );
    const twice = before.replace(
      "</svg>",
      '</svg><svg role="img" aria-label="Trace"><text>A</text><text>B</text><text>A</text></svg>',
    );
    const base = await inspectSource(before);
    expect(compareWords(base, await inspectSource(twice))).toEqual([]);
    for (const changed of [
      twice.replace("<text>B", "<text>C"),
      twice.replace('aria-label="Trace"', 'aria-label="Other"'),
      twice.replace("A trace.", "A trace!"),
    ]) {
      expect(
        compareWords(base, await inspectSource(changed)).length,
      ).toBeGreaterThan(0);
    }
  });

  it("skips examples, preserves prose bytes, and scopes permitted keys to kit data", async () => {
    const lesson =
      'Example\n\n```mdx\n<svg></svg>\n```\n\n<ArchitectureDiagram title="Demo" nodes={[{ id: "n", label: "role: design" }]} />\n';
    const base = await inspectSource(lesson);
    expect(base.visuals.map((v: { kind: string }) => v.kind)).toEqual(["kit"]);
    const allowed = lesson
      .replace(" nodes=", '\n  focus="n" nodes=')
      .replace(
        'label: "role: design"',
        'label: "role: design", role: "design"',
      );
    expect(compareWords(base, await inspectSource(allowed))).toEqual([]);
    expect(
      compareWords(
        base,
        await inspectSource(allowed.replace("Example", "Example ")),
      ),
    ).not.toEqual([]);
    expect(
      compareWords(
        base,
        await inspectSource(allowed.replace("role: design", "role: testbench")),
      ),
    ).not.toEqual([]);
  });

  it("detects a dangling phone aria reference and stray visible words in the panel", async () => {
    const svg =
      '<svg role="img" aria-labelledby="n"><title id="n">Title</title><text>9</text></svg>';
    const before = "<figure>" + svg + "</figure>";
    const base = await inspectSource(before);
    expect(
      compareWords(
        base,
        await inspectSource(
          before.replace(
            "</figure>",
            svg.replace('id="n"', 'id="n-s"') + "</figure>",
          ),
        ),
      ),
    ).not.toEqual([]);
    expect(
      compareWords(
        base,
        await inspectSource(
          before.replace("</figure>", "<span>extra</span></figure>"),
        ),
      ),
    ).not.toEqual([]);
  });
});

describe("figure gate literal colour scan", () => {
  it("finds literals, arbitrary values, alpha colours, side borders and responsive variants", () => {
    const input =
      'fill="#abc" #abcf #aabbcc #aabbccdd bg-[rgb(12 34 56)] hsl(20deg 80% 50%) rgba(1,2,3,.5)\nsm:dark:border-l-cyan-400/50 fill-rose-950 text-white';
    const hits = literalColours(input);
    expect(hits.length).toBe(10);
    expect(hits.at(-1)).toEqual({ token: "text-white", line: 2 });
  });
  it("preserves fragment references, variables, figure classes, and SVG IDs", () => {
    expect(
      literalColours(
        'stroke="url(#abc)" href="#def" fill-fig-rose-text hsl(var(--fig-rose)) id="face" #abc-route',
      ),
    ).toEqual([]);
  });
});
