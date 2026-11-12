import { describe, expect, it } from "vitest";

import { estimateQuestionCardHeights, lazyMdxInteractivePlaceholder } from "@/components/mdx/lazy-mdx-interactives";

const option = (length: number) => ({ text: "x".repeat(length), correct: false });

describe("placeholder heights re-measured on 2026-11-11", () => {
  it("gives the time-slot trace visualizer its measured height per scenario, not one value for all", () => {
    expect(lazyMdxInteractivePlaceholder("TimeSlotTraceVisualizer", { scenario: "shift-blocking" })).toMatchObject({ height: 1240, mobileHeight: 1916 });
    expect(lazyMdxInteractivePlaceholder("TimeSlotTraceVisualizer", { scenario: "gclk-interleave" })).toMatchObject({ height: 659, mobileHeight: 870 });
    expect(lazyMdxInteractivePlaceholder("ProceduralBlocksSimulator", { scenario: "decl-init-ready" })).toMatchObject({ height: 645, mobileHeight: 975 });
  });

  it("estimates an interview question card from its wrapped text, and falls back without question or options", () => {
    const short = estimateQuestionCardHeights({ question: "Why?", options: [option(40), option(40), option(40), option(40)] })!;
    const long = estimateQuestionCardHeights({ question: "Why?", options: [option(200), option(200), option(200), option(200)] })!;
    expect(short.height).toBeGreaterThan(500);
    expect(long.height).toBeGreaterThan(short.height);
    expect(long.mobileHeight! - short.mobileHeight!).toBeGreaterThan(long.height - short.height);
    expect(estimateQuestionCardHeights({})).toBeUndefined();
    expect(lazyMdxInteractivePlaceholder("InterviewQuestionPlayground", { question: "Why?", options: [option(40)] }).height).toBe(
      estimateQuestionCardHeights({ question: "Why?", options: [option(40)] })!.height,
    );
    expect(lazyMdxInteractivePlaceholder("InterviewQuestionPlayground").height).toBe(594);
  });
});
