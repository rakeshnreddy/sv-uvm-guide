import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VISUAL_LABEL_CLASS, VisualFrame, toSentenceCaseLabel } from "@/components/visual-system/VisualFrame";
import { VisualRecap } from "@/components/visual-system/VisualRecap";

describe("visual-system labels", () => {
  it("renders labels authored in all lower case or all capitals in sentence case", () => {
    expect(toSentenceCaseLabel("experiment")).toBe("Experiment");
    expect(toSentenceCaseLabel("MENTAL PICTURE")).toBe("Mental picture");
    expect(toSentenceCaseLabel("Experiment · AHB transfers")).toBe("Experiment · AHB transfers");
    expect(toSentenceCaseLabel("AXI")).toBe("AXI");
    expect(toSentenceCaseLabel("Practice tool")).toBe("Practice tool");
  });

  it("sets the VisualFrame eyebrow in the label style with no uppercase or tracking", () => {
    render(
      <VisualFrame label="Frame" eyebrow="debug it" title="Title" fidelity="model">
        <p>body</p>
      </VisualFrame>,
    );
    const eyebrow = screen.getByText("Debug it");
    expect(eyebrow.className).toBe(VISUAL_LABEL_CLASS);
    expect(eyebrow.className).toContain("text-label");
    expect(eyebrow.className).not.toMatch(/uppercase|tracking-|text-\[11px\]/);
  });

  it("sets every VisualRecap section label in the label style", () => {
    render(<VisualRecap title="Recap title" rule="r" code="c" mistake="m" inTestbench="t" />);
    for (const name of ["Recap", "Mental picture", "Rule", "Minimal code", "✕ Common mistake", "In a real testbench"]) {
      const label = screen.getByText(name);
      expect(label.className, name).toContain("text-label");
      expect(label.className, name).not.toMatch(/uppercase|tracking-|text-\[1[01]px\]/);
    }
  });
});
