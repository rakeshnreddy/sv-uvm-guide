import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LessonTable, SCROLL_REGION_CLASS } from "@/components/curriculum/ScrollRegion";
import { VisualFrame, VISUAL_FRAME_CLASS } from "@/components/visual-system/VisualFrame";

/*
 * DESIGN.md section 12: the panels around lesson text are quiet liquid glass
 * (glass-liquid: the fill, a bright top edge, a sheen, radius 16, no blur).
 * Their content (tables, controls, code) keeps its own surfaces.
 */
describe("lesson glass panels", () => {
  it("wraps a lesson table in a liquid glass panel that still scrolls", () => {
    render(
      <LessonTable>
        <tbody>
          <tr>
            <td>cell</td>
          </tr>
        </tbody>
      </LessonTable>,
    );
    // jsdom lays nothing out, so the box measures as fitting and drops its region role; find it by its hook.
    const region = screen.getByRole("table").parentElement!;
    expect(region).toHaveAttribute("data-scroll-region");
    expect(region).toHaveClass("glass-liquid", "overflow-x-auto", "focus-visible:ring-2");
    expect(region.className).not.toMatch(/\brounded-lg\b|\bglass\b(?!-)/);
    expect(SCROLL_REGION_CLASS.split(" ")).not.toContain("glass");
  });

  it("frames a curriculum visual in liquid glass, never a blurred layer", () => {
    render(
      <VisualFrame label="Four values" eyebrow="Experiment" title="Four values" fidelity="model">
        <p>body</p>
      </VisualFrame>,
    );
    const frame = screen.getByRole("region", { name: "Four values" });
    expect(frame).toHaveClass("glass-liquid", "not-prose");
    expect(frame.className).not.toMatch(/bg-card\/40|border-border\/70|rounded-2xl/);
    expect(VISUAL_FRAME_CLASS.split(" ")).not.toContain("glass");
  });
});
