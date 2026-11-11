import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/*
 * The lesson measure (DESIGN.md section 4: about 65 characters a line on
 * average, never more than 75). globals.css holds the lesson article's text
 * children and callouts at 31em.
 */
const globals = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

function ruleBody(selector: string): string | undefined {
  const start = globals.indexOf(`${selector} {`);
  if (start < 0) return undefined;
  return globals.slice(start, globals.indexOf("}", start));
}

describe("lesson article measure", () => {
  it("caps the article's text children at 31em with a selector that outranks Prose's child cap", () => {
    const body = ruleBody("article[data-lesson-article] > :is(p, ul, ol, dl, blockquote, h3, h4, h5, h6)");
    expect(body).toBeDefined();
    expect(body).toContain("max-width: 31em;");
  });

  it("matches callouts to the same measure plus their padding and border", () => {
    expect(ruleBody("[data-lesson-article] > aside.callout")).toContain("max-width: calc(31em + 2.25rem);");
    expect(globals).not.toContain("calc(30em + 2.25rem)");
  });
});
