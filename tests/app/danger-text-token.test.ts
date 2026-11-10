import { describe, expect, it } from "vitest";

import { contrast, modes } from "./theme-tokens";

/*
 * Error text uses --danger-text, not --destructive: the old dark themes'
 * destructive fill was 1.46:1 on the lab console (theme-2). Each mode must
 * define a danger text colour that reads at WCAG AA (4.5:1) on the surfaces
 * error text sits on, and the destructive fill must carry its text at 4.5:1.
 * The full set of pairs is in theme-contrast.test.ts.
 */

describe("--danger-text token", () => {
  const { dark, light } = modes();

  it.each([
    ["dark", dark.vars],
    ["light", light.vars],
  ] as const)("%s mode reads at 4.5:1", (_name, vars) => {
    expect(vars["danger-text"]).toBeTruthy();
    for (const surface of ["background", "card", "muted", "secondary"]) {
      expect(contrast(vars["danger-text"], vars[surface]), surface).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(vars["destructive-foreground"], vars.destructive), "text on destructive fill").toBeGreaterThanOrEqual(4.5);
  });

  it("is a separate role from the destructive fill in dark mode, where the fill is too dark for text", () => {
    expect(dark.vars["danger-text"]).not.toBe(dark.vars.destructive);
    expect(contrast(dark.vars["danger-text"], dark.vars.background)).toBeGreaterThan(contrast(dark.vars.destructive, dark.vars.background));
  });
});
