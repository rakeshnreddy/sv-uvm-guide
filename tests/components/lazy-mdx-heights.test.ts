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

describe("placeholder heights measured on 2026-11-15 for the Tier 1 interactives", () => {
  const heights = (...args: Parameters<typeof lazyMdxInteractivePlaceholder>) => {
    const { height, midHeight, mobileHeight } = lazyMdxInteractivePlaceholder(...args);
    return { height, midHeight, mobileHeight };
  };

  it("gives each new interactive its measured height, not the default", () => {
    expect(heights("BoundaryProbe")).toEqual({ height: 1166, midHeight: 1166, mobileHeight: 1500 });
    expect(heights("EventMemoryMatrix")).toEqual({ height: 1188, midHeight: 1188, mobileHeight: 1498 });
    expect(heights("ReadmemLoader")).toEqual({ height: 776, midHeight: 776, mobileHeight: 1310 });
    expect(heights("InteractiveCostOfBugGraph")).toEqual({ height: 520, midHeight: 520, mobileHeight: 716 });
    expect(heights("HallOfShameCarousel", { predict: true })).toEqual({ height: 927, midHeight: 927, mobileHeight: 1476 });
  });

  it("picks the variant for each preset, mode or section an instance opens", () => {
    expect(heights("DataTypeComparisonChart", { section: "defaults" })).toEqual({ height: 523, midHeight: 523, mobileHeight: 809 });
    expect(heights("DataTypeComparisonChart", { section: "widths" })).toEqual({ height: 1354, midHeight: 1354, mobileHeight: 2189 });
    expect(heights("LiteralDecoder", { preset: "truncated-hex" }).height).toBe(1141);
    expect(heights("LiteralDecoder", { preset: "hex-ff" }).height).toBe(1007);
    expect(heights("SystemVerilog3DVisualizer", { initialScene: "queue" }).height).toBe(668);
    expect(heights("SystemVerilog3DVisualizer", { initialScene: "mem-block" }).height).toBe(1316);
    expect(heights("EnumMethodVisualizer", { initialTab: "declaration" })).toEqual({ height: 763, midHeight: 783, mobileHeight: 1095 });
    expect(heights("EnumMethodVisualizer", { initialTab: "casts" }).mobileHeight).toBe(1619);
    expect(heights("EnumMethodVisualizer")).toEqual({ height: 1112, midHeight: 1192, mobileHeight: 1772 });
    expect(heights("EventRegionGame").height).toBe(334);
    expect(heights("EventRegionGame", { items: "first-read" })).toEqual({ height: 1138, midHeight: 1186, mobileHeight: 1122 });
    expect(heights("RegionTraceExercise", { preset: "f3b-kata" }).height).toBe(1860);
    expect(heights("RegionTraceExercise", { preset: "f3b-worked-example" }).midHeight).toBe(1891);
    expect(heights("LoopTracer", { preset: "foreach-visit-order" }).height).toBe(719);
    expect(heights("LoopTracer", { preset: "repeat-1101" }).mobileHeight).toBe(1099);
    expect(heights("LoopTracer", { preset: "for-continue-break" }).height).toBe(807);
    expect(heights("PrintingLab", { mode: "format" }).height).toBe(803);
    expect(heights("PrintingLab", { mode: "monitor" }).height).toBe(1765);
    expect(heights("PrintingLab", { mode: "monitor", preset: "replaced-list" }).height).toBe(1192);
    expect(heights("MailboxSemaphoreGame").height).toBe(1496);
    expect(heights("MailboxSemaphoreGame", { mode: "bench" }).height).toBe(1649);
    expect(heights("MailboxSemaphoreGame", { mode: "debug" }).height).toBe(1072);
    expect(heights("MailboxSemaphoreGame", { mode: "mailbox" }).mobileHeight).toBe(2098);
    expect(heights("MailboxSemaphoreGame", { mode: "semaphore", initialProgram: "same-time" }).mobileHeight).toBe(2243);
  });

  it("separates the plain-SV scoreboard instances from the UVM ones", () => {
    expect(heights("ScoreboardMatchingVisualizer", { variant: "plain-sv", traffic: "f2b-lesson" })).toEqual({ height: 2527, midHeight: 2647, mobileHeight: 4173 });
    expect(heights("ScoreboardMatchingVisualizer", { variant: "plain-sv", traffic: "f2b-lesson", compare: ["in-order", "per-id"] }).height).toBe(2663);
    expect(heights("ScoreboardMatchingVisualizer", { mode: "debug" })).toEqual({ height: 1285, midHeight: 1309, mobileHeight: 1873 });
    expect(heights("ScoreboardMatchingVisualizer")).toEqual({ height: 1008, midHeight: 1048, mobileHeight: 1619 });
  });

  it("gives the fork-join process-tree openings their own heights and keeps the older ones", () => {
    const tour = { scenario: "timeout-disable-fork", scenarios: ["timeout-disable-fork", "wrapper-begin-end", "named-disable", "wait-fork"], treeView: true };
    expect(heights("ForkJoinVisualizer", tour)).toEqual({ height: 1827, midHeight: 1864, mobileHeight: 2248 });
    expect(heights("ForkJoinVisualizer", { scenario: "finished-child-grandchild", scenarios: ["finished-child-grandchild"], treeView: true }).height).toBe(1517);
    expect(heights("ForkJoinVisualizer", { scenario: "fork-loop-capture", scenarios: ["fork-loop-capture"] }).height).toBe(809);
    expect(heights("ForkJoinVisualizer", { scenario: "join-variants", scenarios: ["join-variants"], treeView: true }).height).toBe(1049);
    expect(heights("ForkJoinVisualizer", { scenario: "timeout-disable-fork", scenarios: ["timeout-disable-fork"] }).height).toBe(1087);
    expect(heights("ForkJoinVisualizer", { scenario: "timeout-disable-fork", scenarios: ["timeout-disable-fork", "named-disable"] }).height).toBe(1139);
    expect(heights("ForkJoinVisualizer", { mode: "debug" }).height).toBe(1015);
  });
});
