import { describe, expect, it } from "vitest";

import { TYPE_SCALE_TOKENS, cn } from "@/lib/utils";

/*
 * cn() must treat the named type-scale sizes as font sizes, not colours, so a
 * size token survives beside a text colour class (lead decision 2, phase 1 fix round).
 */
describe("cn() and the type-scale tokens", () => {
  it.each(TYPE_SCALE_TOKENS)("keeps text-%s beside each text colour role", (token) => {
    for (const colour of ["text-foreground", "text-subtle", "text-muted-foreground"]) {
      expect(cn(`text-${token}`, colour)).toBe(`text-${token} ${colour}`);
      expect(cn(colour, `text-${token}`)).toBe(`${colour} text-${token}`);
    }
  });

  it("lets a later size replace an earlier one", () => {
    expect(cn("text-sm", "text-label")).toBe("text-label");
    expect(cn("text-label", "text-sm")).toBe("text-sm");
    expect(cn("text-h1", "text-h2")).toBe("text-h2");
    expect(cn("text-sm text-subtle", "text-label")).toBe("text-subtle text-label");
  });

  it("tells the text-code size from the code-surface colour roles", () => {
    expect(cn("text-code", "text-code-foreground")).toBe("text-code text-code-foreground");
    expect(cn("text-sm text-code-foreground", "text-code-muted")).toBe("text-sm text-code-muted");
  });

  it("still lets a later colour replace an earlier one", () => {
    expect(cn("text-label text-subtle", "text-foreground")).toBe("text-label text-foreground");
  });
});
