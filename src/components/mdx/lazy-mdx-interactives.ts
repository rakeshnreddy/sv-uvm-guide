export const lazyMdxInteractiveNames = [
  "AnimatedUvmSequenceDriverHandshakeDiagram",
  "DataTypeComparisonChart",
  "UvmPhasingDiagram",
  "AnimatedUvmTestbenchDiagram",
  "UvmVirtualSequencerDiagram",
  "InteractiveUvmArchitectureDiagram",
  "SystemVerilogDataTypesAnimation",
  "InterfaceSignalFlow",
  "ProceduralBlocksSimulator",
  "DebuggingSimulator",
  "InteractiveCode",
  "CurriculumDataTypeExplorer",
  "InteractiveCostOfBugGraph",
  "HallOfShameCarousel",
  "VerificationMethodologiesDiagram",
  "FirstBugHuntGame",
  "CurriculumDataTypeQuiz",
  "DynamicStructureVisualizer",
  "QueueOperationLab",
  "ConfigDbExplorer",
  "PacketSorterGame",
  "SystemVerilog3DVisualizer",
  "VirtualSequencerExplorer",
  "TelemetryEventBusVisualizer",
  "FormalVsSimulationVisualizer",
  "ModportExplorer",
  "EventRegionGame",
  "SignednessVisualizer",
  "DesignGapChart",
  "LogicStateDiagram",
  "StringMethodExplorer",
  "EnumMethodVisualizer",
  "ArrayMethodExplorer",
  "MailboxSemaphoreGame",
  "VerilogVsSystemVerilog",
  "ConstraintSolverExplorer",
  "ConstraintSolverVisualizer",
  "CovergroupBuilder",
  "DPIBoundaryInspector",
  "FactoryOverrideVisualizer",
  "InterviewQuestionPlayground",
  "RALPredictorVisualizer",
  "TemporalLogicExplorer",
  "TLMPortConnector",
  "UVMTreeExplorer",
  "MethodologyPhaseVisualizer",
  "VIPReuseVisualizer",
  "BindDirectiveVisualizer",
  "GenerateElaborationVisualizer",
  "UvmPolicyVisualizer",
  "UvmContainerVisualizer",
  "TransactionRecordingVisualizer",
  "PowerDomainVisualizer",
  "SVSchedulerRegionVisualizer",
  "TlmConnectionBuilderVisualizer",
  "FactoryOverrideExplorerVisualizer",
  "ConstraintSolverHeatmapVisualizer",
  "SvaSequenceWaveformVisualizer",
  "CoverageCrossExplorerVisualizer",
  "RalRegisterMapVisualizer",
  "UvmPhaseTimelineVisualizer",
  "UvmSequenceHierarchyVisualizer",
  "PssIntentMapVisualizer",
  "ProtocolWaveform",
  "AmbaFamilyExplorer",
  "ProtocolAnalogyExplorer",
  "AhbPipelineBurstVisualizer",
  "AxiChannelHandshakeVisualizer",
  "AxiMemoryMathVisualizer",
  "AxiIdOrderingVisualizer",
  "ExclusiveAccessVisualizer",
  "AxiDeadlockSimulator",
  "BridgeTranslationExplorer",
  "TimeSlotRegionMap",
  "TimeSlotTraceVisualizer",
  "RaceConditionDebugger",
  "TestbenchDriveComparison",
  "RaceDebugChallenge",
  "NetResolutionSimulator",
  "OperatorExplorer",
  "ForkJoinVisualizer",
  "ClockingBlockSkewVisualizer",
  "ObjectHandleVisualizer",
  "PolymorphismDispatchVisualizer",
  "AnalysisBroadcastVisualizer",
  "ScoreboardMatchingVisualizer",
  "CallbackTimingVisualizer",
  "MultiAgentCoordinationVisualizer",
  "SequencerArbitrationSandbox",
  "ScenarioSorter",
  "DecisionLab",
  "SelfCheckBenchLab",
  "TimescaleLab",
  "PackedLayoutExplorer",
  "SubroutineLab",
  "KeywordSetExplorer",
  "CounterBenchLab",
  "RunEndingExplorer",
  "FileReadCursorVisualizer",
  "XCheckLab",
  "TimingControlExplorer",
  "FixPathDecisionLab",
  "IpcSmellClinic",
  "ArraySelectExplorer",
  "ExpressionTreeExplorer",
  "VerificationMethodsExplorer",
  "ClosureBudgetLab",
  "ShiftLeftTimeline",
  "StreamPackLab",
  "FsmEdgeStepper",
  "DeferredReportVisualizer",
] as const;

export type LazyMdxInteractiveName = (typeof lazyMdxInteractiveNames)[number];

/** One kind of instance whose first state is a different height, picked by its MDX props. */
export interface LazyMdxInteractiveVariant {
  /** Which instances this applies to. */
  when: (props: Readonly<Record<string, unknown>>) => boolean;
  height: number;
  /** Height in the 1024 to 1279 px band (see LazyMdxInteractiveMeta.midHeight); defaults to `height`. */
  midHeight?: number;
  mobileHeight?: number;
}

/**
 * What the placeholder needs before an interactive's code arrives: its title
 * and the height to reserve, so the page does not move when it swaps in.
 */
export interface LazyMdxInteractiveMeta {
  /** Sentence-case title; defaults to one derived from the component name. */
  title?: string;
  /** Rendered height in px from 640 px up, margins excluded (measured with the lesson column at 800 px, 1440 px wide). */
  height?: number;
  /**
   * Rendered height in px from 1024 to 1279 px wide (MID_BAND), where the
   * lesson column is 704 to 959 px; measured at 1100 px (a 780 px column).
   * Defaults to `height`.
   */
  midHeight?: number;
  /** Rendered height in px on a 390 px phone. */
  mobileHeight?: number;
  /** Instances whose props open a different preset or section; the first match wins over `height`. */
  variants?: readonly LazyMdxInteractiveVariant[];
  /** Heights estimated from an instance's own props, for an interactive whose height follows its text; used when no variant matches. */
  estimate?: (props: Readonly<Record<string, unknown>>) => Omit<LazyMdxInteractiveVariant, "when"> | undefined;
}

/** Reserved height for an interactive with no measured value: about the median of the 37 measured on 2026-11-10. */
export const DEFAULT_INTERACTIVE_HEIGHT = 800;
export const DEFAULT_INTERACTIVE_MOBILE_HEIGHT = 1100;

/**
 * MDX props one instance can set to state its own reserved height, for an
 * instance no variant below describes. They are read by the placeholder and
 * never passed to the interactive.
 */
export const PLACEHOLDER_HEIGHT_PROP = "placeholderHeight";
export const PLACEHOLDER_MID_HEIGHT_PROP = "placeholderMidHeight";
export const PLACEHOLDER_MOBILE_HEIGHT_PROP = "placeholderMobileHeight";

/**
 * The viewport band `midHeight` covers: Tailwind's lg up to xl. Between these
 * widths the lesson layout drops the docked outline and the column runs from
 * 704 px (1024 wide) to 959 px (1279 wide), so a height measured at 1440 px
 * (an 800 px column) is short at the low end and tall at the high end.
 */
export const MID_BAND = { min: 1024, max: 1279 } as const;

const propIs = (key: string, value: unknown) => (props: Readonly<Record<string, unknown>>) => props[key] === value;
const listLength = (value: unknown) => (Array.isArray(value) ? value.length : 0);
const all =
  (...checks: ((props: Readonly<Record<string, unknown>>) => boolean)[]) =>
  (props: Readonly<Record<string, unknown>>) =>
    checks.every((check) => check(props));

/** Lines a text takes at about `perLine` characters a line. */
const wrappedLines = (text: string, perLine: number) => Math.max(1, Math.ceil(text.length / perLine));

/**
 * InterviewQuestionPlayground's height follows its question and its options,
 * so it is estimated from their wrapped line counts. Fitted on 2026-11-11 to
 * 137 instances (lesson column at 1440 and 390 px): the mean error is 9 px at
 * 1440 and 21 px at 390, against 30 and 71 px for one fixed value.
 */
export function estimateQuestionCardHeights(props: Readonly<Record<string, unknown>>) {
  const question = typeof props.question === "string" ? props.question : "";
  const options = Array.isArray(props.options)
    ? props.options.map((option) => (option && typeof option === "object" && typeof (option as { text?: unknown }).text === "string" ? (option as { text: string }).text : ""))
    : [];
  if (!question || options.length === 0) return undefined;
  const lines = (questionPerLine: number, optionPerLine: number) =>
    wrappedLines(question, questionPerLine) + options.reduce((sum, text) => sum + wrappedLines(text, optionPerLine), 0);
  const height = Math.round(407 + 27.2 * lines(96, 94));
  return { height, midHeight: height, mobileHeight: Math.round(421 + 28 * lines(42, 38)) };
}

/**
 * Measured in the browser on 2026-11-10 (lesson column at 1440 px and at
 * 390 px, the interactive's first state, margins excluded), and again on
 * 2026-11-11 at 1440 and 390 px for every instance of each interactive below
 * (four lessons of InterviewQuestionPlayground): an interactive whose openings
 * differ by more than 40 px has one variant per opening, at its exact value,
 * with the mid-band height of a new variant taken from its 1440 px value. Where one
 * interactive opens different presets, each preset is a variant; otherwise the
 * value is the median of its instances (InterviewQuestionPlayground grows with
 * its question, from 565 to 652 px wide and 623 to 975 px on phones).
 *
 * `midHeight` was measured on 2026-11-11 at 1100 px: every instance in up to
 * three lessons per interactive and every instance of the two with variants,
 * 175 instances in 34 lessons. A variant takes its exact value. Elsewhere the
 * value is the lowest per-lesson average: every instance of one interactive
 * swaps in together (they share one code chunk), so on none of the measured
 * lessons does the page get shorter when it loads, and the lesson with the
 * lowest average does not move at all (InterviewQuestionPlayground: 536 to
 * 710 px at 1100, per-lesson averages 551 to 662).
 * Re-measure when one of them changes its layout.
 */
export const lazyMdxInteractiveMeta: Partial<Record<LazyMdxInteractiveName, LazyMdxInteractiveMeta>> = {
  InterviewQuestionPlayground: { height: 594, midHeight: 551, mobileHeight: 812, estimate: estimateQuestionCardHeights },
  // Bug mode (8 of 13 instances) is the base; trace mode varies with its scenario and tab list.
  ObjectHandleVisualizer: {
    height: 731,
    midHeight: 731,
    mobileHeight: 878,
    variants: [
      { when: propIs("mode", "bug"), height: 731, midHeight: 731, mobileHeight: 878 },
      { when: (props) => listLength(props.scenarios) > 2, height: 1050, midHeight: 1050, mobileHeight: 1369 },
      { when: (props) => listLength(props.scenarios) === 2, height: 1050, midHeight: 1050, mobileHeight: 1325 },
      { when: propIs("scenario", "aliasing"), height: 900, midHeight: 900, mobileHeight: 1152 },
      { when: propIs("scenario", "static-count"), height: 1107, midHeight: 1107, mobileHeight: 1367 },
      { when: propIs("scenario", "null-and-garbage"), height: 930, midHeight: 930, mobileHeight: 1210 },
    ],
  },
  // Every instance opens one section; "dispatch" is the taller one and the base value.
  PolymorphismDispatchVisualizer: {
    height: 1684,
    midHeight: 1719,
    mobileHeight: 2421,
    variants: [{ when: propIs("section", "cast"), height: 990, midHeight: 1010, mobileHeight: 1377 }],
  },
  // Each scenario opens a different program; "procedures" (three instances) is the base.
  ProceduralBlocksSimulator: {
    height: 972,
    midHeight: 915,
    mobileHeight: 1334,
    variants: [
      { when: propIs("scenario", "decl-init-ready"), height: 645, midHeight: 644, mobileHeight: 975 },
      { when: all(propIs("scenario", "comb-vs-star"), (props) => listLength(props.scenarios) === 1), height: 895, midHeight: 895, mobileHeight: 1233 },
      { when: (props) => listLength(props.scenarios) === 2, height: 947, midHeight: 947, mobileHeight: 1211 },
      { when: propIs("scenario", "edge-vs-level"), height: 785, midHeight: 785, mobileHeight: 1171 },
      { when: propIs("scenario", "fork-timing"), height: 881, midHeight: 881, mobileHeight: 1155 },
      { when: propIs("scenario", "nba-swap"), height: 991, midHeight: 991, mobileHeight: 1399 },
      { when: propIs("scenario", "time0-race"), height: 809, midHeight: 809, mobileHeight: 1143 },
      { when: propIs("scenario", "time0-reset"), height: 929, midHeight: 929, mobileHeight: 1297 },
    ],
  },
  AnimatedUvmSequenceDriverHandshakeDiagram: { height: 1228, midHeight: 1210, mobileHeight: 2211 },
  // Each family opens its own operator table; "equality" and "shift" sit at the base value.
  OperatorExplorer: {
    height: 773,
    midHeight: 771,
    mobileHeight: 991,
    variants: [
      { when: propIs("family", "bitcount"), height: 948, midHeight: 948, mobileHeight: 1338 },
      { when: propIs("family", "concat"), height: 825, midHeight: 825, mobileHeight: 1084 },
      { when: propIs("family", "conditional"), height: 928, midHeight: 928, mobileHeight: 1291 },
      { when: propIs("family", "inside"), height: 797, midHeight: 797, mobileHeight: 1063 },
      { when: propIs("family", "reduction"), height: 851, midHeight: 851, mobileHeight: 1067 },
      { when: propIs("family", "stream"), height: 933, midHeight: 933, mobileHeight: 1144 },
    ],
  },
  // Each scenario opens its own expression; "lost-carry" and "ashr-unsigned-context" sit at the base value.
  SignednessVisualizer: {
    height: 896,
    midHeight: 801,
    mobileHeight: 1254,
    variants: [
      { when: propIs("scenario", "casts"), height: 775, midHeight: 775, mobileHeight: 1126 },
      { when: propIs("scenario", "int-vs-logic"), height: 852, midHeight: 852, mobileHeight: 1087 },
      { when: propIs("scenario", "part-select"), height: 828, midHeight: 828, mobileHeight: 1070 },
      { when: propIs("scenario", "shift-fill"), height: 687, midHeight: 687, mobileHeight: 950 },
      { when: propIs("scenario", "signed-compare"), height: 872, midHeight: 872, mobileHeight: 1036 },
      { when: propIs("scenario", "x-arith"), height: 735, midHeight: 735, mobileHeight: 997 },
    ],
  },
  // The base is the timeout-disable-fork tour; the other openings are shorter.
  ForkJoinVisualizer: {
    height: 1139,
    midHeight: 971,
    mobileHeight: 1501,
    variants: [
      { when: propIs("mode", "debug"), height: 1015, midHeight: 1015, mobileHeight: 1195 },
      { when: propIs("scenario", "event-race"), height: 964, midHeight: 964, mobileHeight: 1301 },
      { when: propIs("scenario", "join-variants"), height: 1101, midHeight: 1101, mobileHeight: 1327 },
      { when: all(propIs("scenario", "timeout-disable-fork"), (props) => listLength(props.scenarios) === 1), height: 1087, midHeight: 1087, mobileHeight: 1449 },
    ],
  },
  // Each mode (and read-time preset) opens a different panel; "cross-scope" sits at the base value.
  TimescaleLab: {
    height: 1084,
    midHeight: 1144,
    mobileHeight: 1491,
    variants: [
      { when: all(propIs("mode", "read-time"), propIs("preset", "make-it-work")), height: 1757, midHeight: 1757, mobileHeight: 2243 },
      { when: all(propIs("mode", "read-time"), propIs("preset", "f2d-printing-time")), height: 1463, midHeight: 1463, mobileHeight: 1739 },
      { when: propIs("mode", "read-time"), height: 1365, midHeight: 1365, mobileHeight: 1866 },
      { when: propIs("mode", "global-precision"), height: 791, midHeight: 791, mobileHeight: 1240 },
      { when: propIs("mode", "rounding"), height: 738, midHeight: 738, mobileHeight: 1048 },
      { when: propIs("mode", "two-modules"), height: 1050, midHeight: 1050, mobileHeight: 1550 },
      { when: propIs("mode", "which-unit"), height: 1093, midHeight: 1093, mobileHeight: 1538 },
    ],
  },
  // Each lesson opens its own scenario and picker; the picker's length changes the height as much as the scenario does.
  TimeSlotTraceVisualizer: {
    height: 1059,
    midHeight: 1059,
    mobileHeight: 1739,
    variants: [
      { when: propIs("scenario", "shift-blocking"), height: 1240, midHeight: 1240, mobileHeight: 1916 },
      { when: propIs("scenario", "shift-nba"), height: 1202, midHeight: 1202, mobileHeight: 1764 },
      { when: propIs("scenario", "display-vs-strobe"), height: 1059, midHeight: 1059, mobileHeight: 1699 },
      { when: propIs("scenario", "f3a-one-edge"), height: 901, midHeight: 901, mobileHeight: 1185 },
      { when: propIs("scenario", "gclk-interleave"), height: 659, midHeight: 659, mobileHeight: 870 },
      { when: propIs("scenario", "tb-blocking-drive"), height: 1136, midHeight: 1136, mobileHeight: 1888 },
      { when: propIs("scenario", "tb-nba-drive"), height: 1136, midHeight: 1136, mobileHeight: 1888 },
      { when: propIs("scenario", "tb-clocking-block"), height: 1045, midHeight: 1045, mobileHeight: 1739 },
    ],
  },
  // Each deck holds a different number of cards.
  ScenarioSorter: {
    height: 510,
    midHeight: 458,
    mobileHeight: 798,
    variants: [
      { when: propIs("deck", "function-body"), height: 474, midHeight: 474, mobileHeight: 566 },
      { when: propIs("deck", "ipc-tools"), height: 462, midHeight: 462, mobileHeight: 694 },
      { when: propIs("deck", "regression-log"), height: 588, midHeight: 588, mobileHeight: 688 },
      { when: propIs("deck", "sv-features"), height: 510, midHeight: 510, mobileHeight: 818 },
      { when: propIs("deck", "task-or-function"), height: 306, midHeight: 306, mobileHeight: 508 },
      { when: propIs("deck", "uvm-compile-triage"), height: 566, midHeight: 566, mobileHeight: 798 },
      { when: propIs("deck", "uvm-name-layers"), height: 424, midHeight: 424, mobileHeight: 564 },
      { when: propIs("deck", "verification-methods"), height: 530, midHeight: 530, mobileHeight: 810 },
    ],
  },
  // Each mode and preset opens a different layout; the "word_u" union sits at the base value.
  PackedLayoutExplorer: {
    height: 1097,
    midHeight: 1098,
    mobileHeight: 1399,
    variants: [
      { when: propIs("mode", "mutation"), height: 1505, midHeight: 1505, mobileHeight: 1795 },
      { when: propIs("mode", "tagged"), height: 647, midHeight: 647, mobileHeight: 807 },
      { when: propIs("preset", "cmd_t"), height: 1222, midHeight: 1222, mobileHeight: 1578 },
      { when: propIs("preset", "pkt_hdr_t"), height: 1256, midHeight: 1256, mobileHeight: 1744 },
      { when: propIs("preset", "swapped-fields"), height: 867, midHeight: 867, mobileHeight: 1223 },
      { when: propIs("preset", "empty-name-struct"), height: 903, midHeight: 903, mobileHeight: 1196 },
    ],
  },
  // Measured on 2026-11-11 from the instances on F2A, F2D, F3A and F3C (1440 and 390 px).
  TimingControlExplorer: {
    height: 667,
    midHeight: 667,
    mobileHeight: 908,
  },
  RunEndingExplorer: {
    height: 928,
    midHeight: 928,
    mobileHeight: 1310,
    variants: [{ when: propIs("view", "loop"), height: 975, midHeight: 975, mobileHeight: 1269 }],
  },
  // All seven instances: 641 to 681 px at 1440 and 681 to 781 px at 390 (the editor scrolls past a fixed height).
  InteractiveCode: { height: 661, midHeight: 661, mobileHeight: 701 },
  TimeSlotRegionMap: { height: 686, midHeight: 686, mobileHeight: 1024 },
  RaceConditionDebugger: { height: 656, midHeight: 656, mobileHeight: 895 },
  TestbenchDriveComparison: { height: 462, midHeight: 462, mobileHeight: 688 },
  RaceDebugChallenge: { height: 623, midHeight: 623, mobileHeight: 761 },
  EnumMethodVisualizer: { height: 1060, midHeight: 1060, mobileHeight: 1700 },
  // Every instance opens its own preset, so each has its own value.
  FileReadCursorVisualizer: {
    height: 1294,
    midHeight: 1294,
    mobileHeight: 1934,
    variants: [
      { when: propIs("preset", "feeding-files"), height: 1328, midHeight: 1328, mobileHeight: 1914 },
      { when: propIs("preset", "lesson"), height: 1156, midHeight: 1156, mobileHeight: 1673 },
      { when: propIs("preset", "worked-example"), height: 659, midHeight: 659, mobileHeight: 1008 },
      { when: propIs("preset", "case-2"), height: 1493, midHeight: 1493, mobileHeight: 1580 },
      { when: propIs("preset", "robust-parsing"), height: 1392, midHeight: 1392, mobileHeight: 2141 },
      { when: propIs("preset", "regression-scale"), height: 1294, midHeight: 1294, mobileHeight: 1934 },
    ],
  },
};

/** Words that keep their own spelling in a derived title. */
const TITLE_WORDS: Record<string, string> = {
  ahb: "AHB", amba: "AMBA", apb: "APB", axi: "AXI", db: "DB", dpi: "DPI", fsm: "FSM", id: "ID", ipc: "IPC",
  pss: "PSS", ral: "RAL", sva: "SVA", sv: "SV", tlm: "TLM", uvm: "UVM", vip: "VIP", "3d": "3D",
  systemverilog: "SystemVerilog", verilog: "Verilog",
};

/** "PssIntentMapVisualizer" -> "PSS intent map visualizer"; "UVMTreeExplorer" -> "UVM tree explorer". */
export function interactiveTitleFromName(name: string): string {
  const words = (name.match(/\d+[A-Z](?![a-z])|[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? [name])
    .join(" ")
    .replace(/System Verilog/g, "SystemVerilog")
    .split(" ");
  return words
    .map((word, index) => {
      const known = TITLE_WORDS[word.toLowerCase()];
      if (known) return known;
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      return index === 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase();
    })
    .join(" ");
}

const positivePixels = (value: unknown): number | undefined => {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

export interface LazyMdxInteractivePlaceholderInfo {
  title: string;
  /** From 640 px up, outside MID_BAND. */
  height: number;
  /** Inside MID_BAND (1024 to 1279 px). */
  midHeight: number;
  /** Below 640 px. */
  mobileHeight: number;
}

/**
 * Title and reserved heights for one interactive instance. In order of
 * precedence: the instance's own `placeholderHeight` / `placeholderMidHeight`
 * / `placeholderMobileHeight` props, the first variant its props match, the
 * interactive's measured height, then the default. An MDX `title` prop wins
 * over the derived title. A height without its own mid or phone value falls
 * back to the wider height it was given with.
 */
export function lazyMdxInteractivePlaceholder(
  name: LazyMdxInteractiveName,
  props: Readonly<Record<string, unknown>> = {},
): LazyMdxInteractivePlaceholderInfo {
  const meta = lazyMdxInteractiveMeta[name] ?? {};
  const variant = meta.variants?.find((candidate) => candidate.when(props)) ?? meta.estimate?.(props);
  const titleProp = props.title;
  const title = typeof titleProp === "string" && titleProp.trim() ? titleProp : meta.title ?? interactiveTitleFromName(name);
  const ownHeight = positivePixels(props[PLACEHOLDER_HEIGHT_PROP]);
  const ownMobileHeight = positivePixels(props[PLACEHOLDER_MOBILE_HEIGHT_PROP]);
  const height = ownHeight ?? variant?.height ?? meta.height ?? DEFAULT_INTERACTIVE_HEIGHT;
  const mobileHeight =
    ownMobileHeight ??
    (ownHeight !== undefined
      ? ownHeight
      : variant
        ? variant.mobileHeight ?? variant.height
        : meta.mobileHeight ?? meta.height ?? DEFAULT_INTERACTIVE_MOBILE_HEIGHT);
  const ownMidHeight = positivePixels(props[PLACEHOLDER_MID_HEIGHT_PROP]);
  const midHeight =
    ownMidHeight ??
    (ownHeight !== undefined
      ? ownHeight
      : variant
        ? variant.midHeight ?? variant.height
        : meta.midHeight ?? meta.height ?? DEFAULT_INTERACTIVE_HEIGHT);
  return { title, height, midHeight, mobileHeight };
}

const PLACEHOLDER_PROPS = [PLACEHOLDER_HEIGHT_PROP, PLACEHOLDER_MID_HEIGHT_PROP, PLACEHOLDER_MOBILE_HEIGHT_PROP] as const;

/** The props to hand the interactive itself: everything except the placeholder's own height props. */
export function interactiveComponentProps<Props extends Record<string, unknown>>(props: Props): Props {
  if (!PLACEHOLDER_PROPS.some((key) => key in props)) return props;
  const rest: Record<string, unknown> = { ...props };
  for (const key of PLACEHOLDER_PROPS) delete rest[key];
  return rest as Props;
}
