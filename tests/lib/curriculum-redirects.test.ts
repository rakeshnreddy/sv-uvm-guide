import { describe, expect, it } from "vitest";

import { curriculumRedirects } from "@/generated/curriculum-redirects.mjs";

interface Redirect {
  source: string;
  destination: string;
}

function matchRedirect(pathname: string, redirect: Redirect): string | null {
  const escaped = redirect.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped
    .replace(/\\\(\/:slug\\\*\\\)/g, "(?:/(.*))?")
    .replace(/\/:slug\\\*/g, "/(.*)");
  const match = pathname.match(new RegExp(`^${pattern}$`));
  if (!match) return null;

  return redirect.destination.replace(/\/:slug\*/g, match[1] ? `/${match[1]}` : "");
}

function resolveRedirect(pathname: string): string | null {
  for (const redirect of curriculumRedirects) {
    const destination = matchRedirect(pathname, redirect);
    if (destination) return destination;
  }
  return null;
}

describe("generated curriculum redirect resolution", () => {
  it("places exact advanced RAL descendants before the broad legacy RAL redirect", () => {
    const exact = "/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/built-in-ral-sequences";
    const broad = "/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL(/:slug*)";

    expect(curriculumRedirects.findIndex((redirect) => redirect.source === exact))
      .toBeLessThan(curriculumRedirects.findIndex((redirect) => redirect.source === broad));
    expect(resolveRedirect(exact)).toBe(
      "/curriculum/T3_Advanced/A-UVM-4B_Advanced_RAL_Techniques/built-in-ral-sequences",
    );
  });

  it("preserves wildcard descendants when the destination declares a wildcard", () => {
    expect(resolveRedirect(
      "/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/sequence-arbitration",
    )).toBe(
      "/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-arbitration",
    );
  });
});
