import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { estimateQuestionCardHeights, lazyMdxInteractivePlaceholder } from "@/components/mdx/lazy-mdx-interactives";

const option = (length: number) => ({ text: "x".repeat(length), correct: false });

describe("placeholder heights re-measured on 2026-11-11", () => {
  it("gives the time-slot trace visualizer its measured height per scenario, not one value for all", () => {
    expect(lazyMdxInteractivePlaceholder("TimeSlotTraceVisualizer", { scenario: "shift-blocking" })).toMatchObject({ height: 1248, mobileHeight: 1924 });
    expect(lazyMdxInteractivePlaceholder("TimeSlotTraceVisualizer", { scenario: "gclk-interleave" })).toMatchObject({ height: 659, mobileHeight: 870 });
    expect(lazyMdxInteractivePlaceholder("ProceduralBlocksSimulator", { scenario: "decl-init-ready" })).toMatchObject({ height: 645, mobileHeight: 975 });
  });

  it("estimates an interview question card from its wrapped text, and falls back without question or options", () => {
    // A card measured on 2026-11-15 (F1A #0): 565 px at 1440 and 1100, 650 px at 390.
    const f1a = {
      title: "Predict: the designers' own time",
      question:
        "In the 2022 Wilson Research Group study, what share of their own time did design engineers (not the verification team) spend on verification?",
      options: ["About 5%: verification is a final step that the DV team does.", "About 20%.", "About half.", "Nearly all of it."].map((text) => ({ text, correct: false })),
    };
    expect(estimateQuestionCardHeights(f1a)).toEqual({ height: 565, midHeight: 565, mobileHeight: 650 });
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

  it("reserves the measured F1B visual heights and their shared sorter variants", () => {
    expect(heights("FirstBugHuntGame")).toEqual({ height: 796, midHeight: 796, mobileHeight: 972 });
    expect(heights("VerificationMethodsExplorer")).toEqual({ height: 1108, midHeight: 1108, mobileHeight: 1415 });
    expect(heights("VerificationMethodologiesDiagram")).toEqual({ height: 1162, midHeight: 1162, mobileHeight: 1803 });
    expect(heights("ScenarioSorter", { deck: "verification-methods" })).toEqual({ height: 546, midHeight: 546, mobileHeight: 826 });
    expect(heights("VerificationMethodsExplorer", { preset: "f1b-assumptions" })).toEqual({ height: 952, midHeight: 952, mobileHeight: 1331 });
    expect(heights("ScenarioSorter", { deck: "uvm-name-layers" })).toEqual({ height: 440, midHeight: 440, mobileHeight: 580 });
    expect(heights("ScenarioSorter", { deck: "uvm-compile-triage" })).toEqual({ height: 582, midHeight: 600, mobileHeight: 814 });
    expect(heights("ScenarioSorter", { deck: "sv-features" })).toEqual({ height: 526, midHeight: 526, mobileHeight: 834 });
    expect(heights("ScenarioSorter", { deck: "ipc-tools" })).toEqual({ height: 478, midHeight: 478, mobileHeight: 710 });
    expect(heights("ScenarioSorter", { deck: "function-body" })).toEqual({ height: 490, midHeight: 490, mobileHeight: 582 });
    expect(heights("ScenarioSorter", { deck: "task-or-function" })).toEqual({ height: 322, midHeight: 322, mobileHeight: 524 });
    expect(heights("ScenarioSorter", { deck: "regression-log" })).toEqual({ height: 604, midHeight: 604, mobileHeight: 704 });
  });

  it("picks the variant for each preset, mode or section an instance opens", () => {
    expect(heights("DataTypeComparisonChart", { section: "defaults" })).toEqual({ height: 523, midHeight: 523, mobileHeight: 809 });
    expect(heights("DataTypeComparisonChart", { section: "widths" })).toEqual({ height: 1354, midHeight: 1354, mobileHeight: 2189 });
    expect(heights("LiteralDecoder", { preset: "truncated-hex" }).height).toBe(1161);
    expect(heights("LiteralDecoder", { preset: "hex-ff" }).height).toBe(1027);
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
    expect(heights("MailboxSemaphoreGame", { mode: "mailbox" }).mobileHeight).toBe(2110);
    expect(heights("MailboxSemaphoreGame", { mode: "semaphore", initialProgram: "same-time" }).mobileHeight).toBe(2243);
  });

  it("separates the plain-SV scoreboard instances from the UVM ones", () => {
    expect(heights("ScoreboardMatchingVisualizer", { variant: "plain-sv", traffic: "f2b-lesson" })).toEqual({ height: 2527, midHeight: 2647, mobileHeight: 4173 });
    expect(heights("ScoreboardMatchingVisualizer", { variant: "plain-sv", traffic: "f2b-lesson", compare: ["in-order", "per-id"] }).height).toBe(2663);
    expect(heights("ScoreboardMatchingVisualizer", { mode: "debug" })).toEqual({ height: 1285, midHeight: 1309, mobileHeight: 1897 });
    expect(heights("ScoreboardMatchingVisualizer")).toEqual({ height: 1008, midHeight: 1048, mobileHeight: 1647 });
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

describe("placeholder heights measured on 2026-11-15 for all interactives", () => {
  const heights = (...args: Parameters<typeof lazyMdxInteractivePlaceholder>) => {
    const { height, midHeight, mobileHeight } = lazyMdxInteractivePlaceholder(...args);
    return { height, midHeight, mobileHeight };
  };

  it("gives the F1 to F4 and SVA interactives their measured heights, per opening", () => {
    expect(heights("DesignGapChart")).toEqual({ height: 758, midHeight: 754, mobileHeight: 603 });
    expect(heights("ShiftLeftTimeline")).toEqual({ height: 1235, midHeight: 1235, mobileHeight: 2201 });
    expect(heights("StringMethodExplorer")).toEqual({ height: 574, midHeight: 574, mobileHeight: 690 });
    expect(heights("PacketSorterGame")).toEqual({ height: 364, midHeight: 364, mobileHeight: 552 });

    expect(heights("FixPathDecisionLab", { mode: "decide" })).toEqual({ height: 635, midHeight: 635, mobileHeight: 1062 });
    expect(heights("FixPathDecisionLab", { mode: "kata" })).toEqual({ height: 1934, midHeight: 1934, mobileHeight: 3138 });
    expect(heights("FixPathDecisionLab", { mode: "decide", preset: "custom" })).toEqual({ height: 1221, midHeight: 1221, mobileHeight: 1766 });

    expect(heights("FsmEdgeStepper", { machine: "traffic-light" })).toEqual({ height: 2017, midHeight: 2017, mobileHeight: 2748 });
    expect(heights("FsmEdgeStepper", { machine: "seq-detect-101" })).toEqual({ height: 1737, midHeight: 1785, mobileHeight: 2429 });

    expect(heights("XCheckLab", { mode: "checker" })).toEqual({ height: 1086, midHeight: 1086, mobileHeight: 1566 });
    expect(heights("XCheckLab", { mode: "debug", preset: "status-reg" })).toEqual({ height: 1741, midHeight: 1741, mobileHeight: 1993 });
    expect(heights("XCheckLab", { mode: "checker", preset: "int-copy" })).toEqual({ height: 1134, midHeight: 1134, mobileHeight: 1638 });

    expect(heights("NetResolutionSimulator")).toEqual({ height: 1295, midHeight: 1295, mobileHeight: 1809 });
    expect(heights("NetResolutionSimulator", { initialMode: "legality", pattern: "bitwise" })).toEqual({ height: 1130, midHeight: 1130, mobileHeight: 1449 });
    expect(heights("NetResolutionSimulator", { initialMode: "trireg" })).toEqual({ height: 1071, midHeight: 1071, mobileHeight: 1314 });
    expect(heights("NetResolutionSimulator", { initialMode: "drivers", preset: "open-drain" })).toEqual({ height: 1139, midHeight: 1139, mobileHeight: 1597 });

    expect(heights("ArraySelectExplorer", { mode: "select", preset: "packed-unpacked" })).toEqual({ height: 752, midHeight: 752, mobileHeight: 1108 });
    expect(heights("ArraySelectExplorer", { mode: "select", preset: "mixed-dimensions" })).toEqual({ height: 1132, midHeight: 1132, mobileHeight: 1398 });
    expect(heights("ArraySelectExplorer", { mode: "part-select", preset: "indexed-part-select" })).toEqual({ height: 719, midHeight: 719, mobileHeight: 1043 });
    expect(heights("ArraySelectExplorer", { mode: "query", preset: "query-functions" })).toEqual({ height: 1183, midHeight: 1183, mobileHeight: 1737 });

    expect(heights("DynamicStructureVisualizer")).toEqual({ height: 744, midHeight: 744, mobileHeight: 1207 });
    expect(heights("DynamicStructureVisualizer", { initialKind: "queue", initialPreset: "slices" })).toEqual({ height: 964, midHeight: 964, mobileHeight: 1251 });
    expect(heights("DynamicStructureVisualizer", { initialKind: "assoc", initialPreset: "access-semantics" })).toEqual({ height: 947, midHeight: 947, mobileHeight: 1673 });
    expect(heights("DynamicStructureVisualizer", { initialKind: "assoc", initialPreset: "delete-walk" })).toEqual({ height: 721, midHeight: 745, mobileHeight: 1037 });

    expect(heights("LogicStateDiagram")).toEqual({ height: 953, midHeight: 953, mobileHeight: 1469 });
    expect(heights("LogicStateDiagram", { initialConstruct: "if", initialTab: "control", preset: "vector-condition" })).toEqual({ height: 1049, midHeight: 1049, mobileHeight: 1494 });
    expect(heights("LogicStateDiagram", { initialConstruct: "case", initialTab: "control", initialValue: "x0", tabs: ["control"] })).toEqual({ height: 1029, midHeight: 1029, mobileHeight: 1413 });
    expect(heights("LogicStateDiagram", { initialConstruct: "if", initialTab: "control", tabs: ["control"] })).toEqual({ height: 922, midHeight: 922, mobileHeight: 1294 });

    const tour = ["comb-after-nba", "zero-delay-prints", "program-reactive", "program-watcher"];
    expect(heights("SVSchedulerRegionVisualizer", { scenario: "program-reactive", scenarios: ["program-reactive"] })).toEqual({ height: 793, midHeight: 793, mobileHeight: 1134 });
    expect(heights("SVSchedulerRegionVisualizer", { mode: "next-region", scenario: "comb-after-nba", scenarios: tour })).toEqual({ height: 775, midHeight: 775, mobileHeight: 1232 });
    expect(heights("SVSchedulerRegionVisualizer", { scenario: "clocking-drive", scenarios: ["clocking-drive"] })).toEqual({ height: 993, midHeight: 1061, mobileHeight: 1640 });

    expect(heights("SvaSequenceWaveformVisualizer")).toEqual({ height: 1163, midHeight: 1163, mobileHeight: 1743 });
    expect(heights("SvaSequenceWaveformVisualizer", { initialPreset: "req-gnt-2", modes: ["learn"] })).toEqual({ height: 1097, midHeight: 1097, mobileHeight: 1493 });
    expect(heights("SvaSequenceWaveformVisualizer", { initialPreset: "flop-output-low", modes: ["learn"] })).toEqual({ height: 1087, midHeight: 1087, mobileHeight: 1495 });

    expect(heights("DeferredReportVisualizer", { preset: "reset-nba-flush" })).toEqual({ height: 1076, midHeight: 1076, mobileHeight: 1478 });
    expect(heights("DeferredReportVisualizer", { preset: "assert-forms-glitch" })).toEqual({ height: 772, midHeight: 772, mobileHeight: 1146 });
  });

  it("gives the timing, array-method, IPC smell and literal interactives their measured heights, per opening", () => {
    expect(heights("TimingControlExplorer", { preset: "f2c-timing-controls" })).toEqual({ height: 711, midHeight: 711, mobileHeight: 1105 });
    expect(heights("TimingControlExplorer", { mode: "intra", preset: "f2c-intra-assignment" })).toEqual({ height: 715, midHeight: 710, mobileHeight: 1242 });
    expect(heights("TimingControlExplorer", { mode: "wake", preset: "f3a-wake-rules" })).toEqual({ height: 667, midHeight: 667, mobileHeight: 916 });
    expect(heights("TimingControlExplorer", { preset: "f2c-sensitivity-lists" })).toEqual({ height: 692, midHeight: 711, mobileHeight: 1105 });

    expect(heights("ArrayMethodExplorer")).toEqual({ height: 883, midHeight: 883, mobileHeight: 1407 });

    expect(heights("IpcSmellClinic", { mode: "triage" })).toEqual({ height: 864, midHeight: 884, mobileHeight: 1227 });
    expect(heights("IpcSmellClinic", { mode: "deadlock" })).toEqual({ height: 997, midHeight: 997, mobileHeight: 1298 });
    expect(heights("IpcSmellClinic", { mode: "kata" })).toEqual({ height: 1065, midHeight: 1065, mobileHeight: 1363 });

    expect(heights("LiteralDecoder", { preset: "hex-ff" })).toEqual({ height: 1027, midHeight: 1027, mobileHeight: 1723 });
    expect(heights("LiteralDecoder", { preset: "truncated-hex" })).toEqual({ height: 1161, midHeight: 1161, mobileHeight: 1857 });
  });
});

describe("placeholder heights corrected on 2026-11-15 from the full re-measurement", () => {
  const heights = (...args: Parameters<typeof lazyMdxInteractivePlaceholder>) => {
    const { height, midHeight, mobileHeight } = lazyMdxInteractivePlaceholder(...args);
    return { height, midHeight, mobileHeight };
  };

  it("gives each opening of the corrected interactives its measured heights", () => {
    expect(heights("RunEndingExplorer", { preset: "watchdog-race", view: "lanes" })).toEqual({ height: 1727, midHeight: 1727, mobileHeight: 2233 });
    expect(heights("RunEndingExplorer", { preset: "severity-and-end", view: "lanes" })).toEqual({ height: 928, midHeight: 928, mobileHeight: 1358 });
    expect(heights("RunEndingExplorer", { preset: "scheduler-loop", view: "loop" })).toEqual({ height: 975, midHeight: 975, mobileHeight: 1277 });

    expect(heights("ProceduralBlocksSimulator", { scenario: "procedures" })).toEqual({ height: 972, midHeight: 992, mobileHeight: 1342 });
    expect(heights("PackedLayoutExplorer", { mode: "struct", preset: "cmd_t" })).toEqual({ height: 1222, midHeight: 1321, mobileHeight: 1590 });
    expect(heights("PackedLayoutExplorer", { mode: "struct", preset: "pkt_hdr_t" })).toEqual({ height: 1256, midHeight: 1355, mobileHeight: 1756 });
    expect(heights("SignednessVisualizer", { scenario: "lost-carry" })).toEqual({ height: 896, midHeight: 896, mobileHeight: 1271 });
    expect(heights("SignednessVisualizer", { scenario: "ashr-unsigned-context" })).toEqual({ height: 872, midHeight: 872, mobileHeight: 1263 });
    expect(heights("RaceConditionDebugger")).toEqual({ height: 656, midHeight: 656, mobileHeight: 895 });
    expect(heights("RaceConditionDebugger", { bench: "nba-writers" })).toEqual({ height: 687, midHeight: 731, mobileHeight: 931 });
    expect(heights("TimeSlotRegionMap")).toEqual({ height: 686, midHeight: 674, mobileHeight: 1024 });
    expect(heights("TimeSlotTraceVisualizer", { scenario: "tb-nba-drive" })).toEqual({ height: 1144, midHeight: 1272, mobileHeight: 1896 });
    expect(heights("TimescaleLab", { mode: "global-precision" })).toEqual({ height: 815, midHeight: 839, mobileHeight: 1240 });
    expect(heights("TimescaleLab", { mode: "cross-scope" })).toEqual({ height: 1084, midHeight: 1084, mobileHeight: 1507 });

    expect(heights("AnimatedUvmSequenceDriverHandshakeDiagram")).toEqual({ height: 1223, midHeight: 1243, mobileHeight: 2130 });
    expect(heights("AnimatedUvmSequenceDriverHandshakeDiagram", { initialPreset: "missing_item_done" })).toEqual({ height: 1263, midHeight: 1263, mobileHeight: 2218 });
    expect(heights("AnimatedUvmSequenceDriverHandshakeDiagram", { initialPreset: "responses" })).toEqual({ height: 1217, midHeight: 1217, mobileHeight: 2244 });

    expect(heights("ObjectHandleVisualizer", { mode: "bug" })).toEqual({ height: 723, midHeight: 723, mobileHeight: 875 });
    expect(heights("ObjectHandleVisualizer", { scenario: "static-count", scenarios: ["static-count"] })).toEqual({ height: 1124, midHeight: 1124, mobileHeight: 1377 });
    expect(heights("ObjectHandleVisualizer", { scenario: "shallow-copy", scenarios: ["shallow-copy", "deep-copy"] })).toEqual({ height: 1064, midHeight: 1088, mobileHeight: 1338 });
  });

  it("gives the interactives that had no measured height their own, per opening", () => {
    expect(heights("SelfCheckBenchLab", { mode: "step", preset: "smoke" })).toEqual({ height: 2602, midHeight: 2595, mobileHeight: 1626 });
    expect(heights("SelfCheckBenchLab", { mode: "matrix", scope: "plan" })).toEqual({ height: 599, midHeight: 599, mobileHeight: 687 });
    expect(heights("SelfCheckBenchLab", { mode: "matrix" })).toEqual({ height: 728, midHeight: 728, mobileHeight: 872 });
    expect(heights("InteractiveUvmArchitectureDiagram")).toEqual({ height: 2121, midHeight: 2131, mobileHeight: 3147 });
    expect(heights("SubroutineLab", { mode: "lifetime", preset: "initializers" })).toEqual({ height: 2145, midHeight: 2169, mobileHeight: 2912 });
    expect(heights("SubroutineLab", { mode: "lifetime" })).toEqual({ height: 1007, midHeight: 1027, mobileHeight: 1319 });
    expect(heights("CoverageCrossExplorerVisualizer", { mode: "closure" })).toEqual({ height: 580, midHeight: 580, mobileHeight: 909 });
    expect(heights("DecisionLab", { mode: "compare", preset: "casex-vs-inside" })).toEqual({ height: 692, midHeight: 692, mobileHeight: 1259 });
    expect(heights("CurriculumDataTypeQuiz")).toEqual({ height: 714, midHeight: 714, mobileHeight: 866 });
    expect(heights("SystemVerilogDataTypesAnimation")).toEqual({ height: 800, midHeight: 800, mobileHeight: 1100 });
  });
});

describe("the question card estimate runs in every browser the site supports", () => {
  const option = (text: string) => ({ text, correct: false });

  it("uses no lookbehind regex: Safari before 16.4 cannot parse one, and the estimate runs while a lesson renders", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/mdx/lazy-mdx-interactives.ts"), "utf8");
    const code = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(code).not.toMatch(/\(\?<[=!]/);
  });

  it("wraps after hyphens and returns whole positive heights for awkward text", () => {
    const plain = estimateQuestionCardHeights({ question: "Why?", options: [option("x"), option("y")] })!;
    const hyphenated = estimateQuestionCardHeights({
      question: "Why?",
      options: [option(Array.from({ length: 40 }, () => "read-modify-write").join("-")), option("y")],
    })!;
    expect(hyphenated.height).toBeGreaterThan(plain.height);
    for (const text of ["", "-", "--", "a--b", "trailing-", "-leading", "x".repeat(5000), "混合 text 🙂", "tab\tand\nnewline"]) {
      const estimate = estimateQuestionCardHeights({ question: text || "?", options: [option(text), option("ok")] });
      if (!estimate) continue;
      for (const value of [estimate.height, estimate.midHeight, estimate.mobileHeight]) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    }
  });
});
