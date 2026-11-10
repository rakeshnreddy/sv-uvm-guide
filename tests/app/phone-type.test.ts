import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import config from "../../tailwind.config";

/*
 * Phone type sizes (DESIGN.md section 4): body 16/27 and h1 28/36 under 640 px.
 * The typography plugin cannot nest @media keys (it emits an invalid
 * ".prose :where(@media ...)" selector), so the phone rules live in globals.css.
 */
const globals = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

function mediaKeys(value: unknown, trail: string[] = []): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
    ...(key.startsWith("@media") ? [[...trail, key].join(" > ")] : []),
    ...mediaKeys(child, [...trail, key]),
  ]);
}

function phoneBlocks(): string {
  const blocks: string[] = [];
  const re = /@media \(max-width: 639px\) \{/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(globals))) {
    let depth = 1;
    let i = match.index + match[0].length;
    while (depth > 0 && i < globals.length) {
      if (globals[i] === "{") depth += 1;
      if (globals[i] === "}") depth -= 1;
      i += 1;
    }
    blocks.push(globals.slice(match.index, i));
  }
  return blocks.join("\n");
}

describe("phone type sizes", () => {
  it("keeps @media keys out of the typography plugin config", () => {
    const typography = (config.theme?.extend as Record<string, unknown> | undefined)?.typography;
    expect(typography).toBeTruthy();
    expect(mediaKeys(typography)).toEqual([]);
  });

  it("sets prose body to 16/27 and the prose h1 to 28/36 under 640 px", () => {
    const phone = phoneBlocks();
    expect(phone).toMatch(/\.prose,\s*\.prose-base\s*\{\s*font-size: 1rem;\s*line-height: 1\.6875;/);
    expect(phone).toMatch(/\.prose :where\(h1\)[^{]*\{\s*font-size: 1\.75rem;\s*line-height: 2\.25rem;/);
  });

  it("drops the text-h1 token to 28/36 under 640 px", () => {
    expect(phoneBlocks()).toMatch(/\.text-h1\s*\{\s*font-size: 1\.75rem;\s*line-height: 2\.25rem;/);
  });
});

/*
 * Weights (DESIGN.md section 4): type of 28 px and larger is set at 500, smaller
 * headings at 600, and nothing in the sans face above 600.
 */
describe("type scale weights", () => {
  const extend = config.theme?.extend as Record<string, unknown>;
  const fontSize = extend.fontSize as Record<string, [string, { fontWeight?: string }]>;
  const proseCss = (extend.typography as { DEFAULT: { css: Record<string, Record<string, string>> } }).DEFAULT.css;

  it("sets the display and h1 tokens at 500 and h2 to h4 at 600", () => {
    expect(fontSize.display[1].fontWeight).toBe("500");
    expect(fontSize.h1[1].fontWeight).toBe("500");
    for (const token of ["h2", "h3", "h4"]) expect(fontSize[token][1].fontWeight, token).toBe("600");
  });

  it("sets the prose h1 at 500, and keeps it out of the shared h2 to h4 rule that would override it", () => {
    expect(proseCss.h1.fontWeight).toBe("500");
    expect(proseCss["h2, h3, h4"].fontWeight).toBe("600");
    expect(Object.keys(proseCss).filter((key) => key.includes(",") && key.split(",").map((s) => s.trim()).includes("h1"))).toEqual([]);
  });

  it("keeps strong at 600 in prose and inside prose headings", () => {
    for (const key of ["strong", "h1 strong", "h2 strong", "h3 strong", "h4 strong"]) {
      expect(proseCss[key]?.fontWeight, key).toBe("600");
    }
  });

  it("sets b, strong and th at 600 outside prose", () => {
    expect(globals).toMatch(/b,\s*strong,\s*th\s*\{\s*font-weight: 600;/);
  });
});
