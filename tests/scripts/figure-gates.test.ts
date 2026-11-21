import { describe, expect, it } from "vitest";
import { openDetailsForEmptyEmbeds } from "../../scripts/figure-gates/browser.cjs";
import {
  compareWords,
  inspectSource,
  literalColours,
} from "../../scripts/figure-gates/source.cjs";

const draw = (body: string) =>
  `<figure><svg role="img" aria-label="Trace">${body}</svg><figcaption>A trace.</figcaption></figure>`;

it("opens the lesson disclosures needed to read an embed's default text", () => {
  const fixture = document.createElement("div");
  fixture.innerHTML = `
    <details id="lesson"><details id="section"><div id="hidden"><details id="internal"></details></div></details></details>
    <details id="other"><div id="visible"></div></details>
  `;
  const outer = fixture.querySelector<HTMLDetailsElement>("#lesson")!;
  const section = fixture.querySelector<HTMLDetailsElement>("#section")!;
  const hidden = fixture.querySelector("#hidden")!;
  const visible = fixture.querySelector("#visible")!;
  Object.defineProperty(hidden, "innerText", {
    get: () => (outer.open && section.open ? "Default value" : ""),
  });
  Object.defineProperty(visible, "innerText", { value: "Already readable" });

  expect(openDetailsForEmptyEmbeds([hidden, visible])).toBe(true);
  expect(outer.open).toBe(true);
  expect(section.open).toBe(true);
  expect(fixture.querySelector("#internal")?.hasAttribute("open")).toBe(false);
  expect(fixture.querySelector("#other")?.hasAttribute("open")).toBe(false);
  expect(openDetailsForEmptyEmbeds([hidden, visible])).toBe(false);
});

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

describe("per-visual figure gates", () => {
  it("selects a single source line without losing its inventory index", async () => {
    const { selectVisuals } = await import("../../scripts/figure-gates/audit.cjs");
    const visuals = [
      { key: "drawing", name: "Two curves", line: 12 },
      { key: "Chart", name: "Chart", line: 24 },
      { key: "Chart", name: "Chart", line: 40 },
    ];
    expect(selectVisuals(visuals, "Chart@40")).toEqual([2]);
    expect(selectVisuals(visuals, "Two curves")).toEqual([0]);
    expect(() => selectVisuals(visuals, "Chart")).toThrow(/24.*40/);
    expect(() => selectVisuals(visuals, "absent")).toThrow(/absent/);
  });

  it("requires a substantial change to the drawing pixels", async () => {
    const { artworkDifference } = await import("../../scripts/figure-gates/audit.cjs");
    const image = (bytes: number[]) => Buffer.from(bytes).toString("base64");
    const original = [image([40, 40, 40, 60, 60, 60, 120, 120, 120])];
    expect(artworkDifference(original, original)).toBe(0);
    expect(artworkDifference(original, [image([40, 40, 40, 62, 62, 62, 119, 119, 119])])).toBe(0);
    expect(artworkDifference(original, [image([40, 40, 40, 60, 60, 60, 200, 120, 120])])).toBeCloseTo(1 / 3);
    expect(artworkDifference(undefined, original)).toBeNull();
    expect(artworkDifference([], original)).toBe(1);
    expect(artworkDifference(original, [])).toBe(0);
  });

  it("requires a reason tied to the visual to waive a focal part", async () => {
    const { focalWaiver } = await import("../../scripts/figure-gates/audit.cjs");
    const report = "## Two curves\nno focal part: the shape of both curves carries the comparison.\n\n## Another chart\n";
    expect(focalWaiver(report, { name: "Two curves", line: 20 })).toContain("comparison");
    expect(focalWaiver(report, { name: "Another chart", line: 38 })).toBeNull();
    expect(focalWaiver("no focal part: unspecified", { name: "Two curves", line: 20 })).toBeNull();
    expect(focalWaiver("Chart@20 — no focal part: time is the subject", { name: "Chart", line: 20 })).toContain("time");
  });

  it("accepts a named focal record only for a released lesson", async () => {
    const { focalWaiver } = await import("../../scripts/figure-gates/audit.cjs");
    const row = { name: "Chart", line: 20 };
    const report = "- Chart@20 — focal part: the most recent bar (lesson report)";
    expect(focalWaiver(report, row)).toBeNull();
    expect(focalWaiver(report, row, true)).toContain("most recent bar");
  });

  it("sends an undetected drawing to review and still checks reference depth", async () => {
    const { auditResults } = await import("../../scripts/figure-gates/audit.cjs");
    const row = { name: "Chart", line: 20, domIndex: 0, hasStage: true, hasTokens: true };
    const view = { rows: [row], width: 1440, theme: "light", artwork: { 0: { parts: [] } },
      audits: { 0: { findings: [], depth: false, focus: 1 } }, pixels: [],
      decisionCrops: { 0: "chart.png" } };
    const options = { decisions: [] };
    expect(auditResults([view], null, "", [], options).G14.status).toBe("PASS");
    expect(options.decisions).toContainEqual(expect.objectContaining({ crop: "chart.png" }));
    expect(auditResults([view], null, "", [], { skipPixels: true }).G14.status).toBe("FAIL");
    view.audits[0].depth = true;
    expect(auditResults([view], null, "", [], { skipPixels: true }).G14.status).toBe("SKIPPED");
  });
});

it("accepts only exact released-baseline findings and limits cleared rows to the focused visual", async () => {
  const { releaseStatus } = await import("../../scripts/figure-gates/released.cjs");
  const existing = { gate: "G11", visual: "First@10", label: "100%", width: 390, theme: "light" };
  const other = { ...existing, visual: "Second@20" };
  const added = { ...existing, width: 768 };
  const gates = { G11: { status: "FAIL", summary: "two findings", details: [] } };
  expect(releaseStatus(gates, [existing, added], [existing, other], "First@10")).toEqual({
    retained: 1, cleared: [], newFindings: [added],
  });
  expect(gates.G11.status).toBe("FAIL");
  expect(releaseStatus(gates, [existing], [existing, other]).cleared).toEqual([other]);
  expect(gates.G11.status).toBe("PASS");
});
