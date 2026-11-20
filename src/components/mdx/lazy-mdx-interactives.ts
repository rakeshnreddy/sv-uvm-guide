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
  "BoundaryProbe",
  "RegionTraceExercise",
  "SignednessVisualizer",
  "DesignGapChart",
  "LogicStateDiagram",
  "StringMethodExplorer",
  "EnumMethodVisualizer",
  "LiteralDecoder",
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
  "LoopTracer",
  "EventMemoryMatrix",
  "PrintingLab",
  "ReadmemLoader",
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

/**
 * IBM Plex Sans (the lesson font) advance widths in 1/1000 em, by weight:
 * characters 32 to 126 in order, then the ones in PLEX_EXTRA_CHARS. Measured
 * with canvas measureText in Chrome on 2026-11-15. Other characters count as
 * PLEX_FALLBACK_WIDTH.
 */
const PLEX_WIDTHS = {
  400: [
    236, 284, 419, 713, 598, 927, 694, 242, 335, 335, 450, 600, 272, 399, 272, 383, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 292, 292,
    600, 600, 600, 477, 891, 641, 653, 621, 671, 583, 559, 695, 707, 400, 510, 634, 501, 812, 707, 708, 606, 708, 640, 581, 572, 678, 609, 891,
    613, 593, 580, 317, 383, 317, 600, 565, 600, 534, 580, 503, 580, 549, 324, 528, 568, 250, 250, 527, 272, 873, 568, 560, 580, 580, 367, 487,
    351, 568, 492, 768, 507, 499, 464, 343, 314, 343, 600, 780, 803, 586, 573, 600,
  ],
  500: [
    236, 299, 451, 678, 599, 947, 706, 253, 336, 336, 514, 600, 288, 401, 288, 416, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 308, 308,
    600, 600, 600, 487, 896, 660, 659, 634, 682, 593, 570, 705, 714, 414, 531, 660, 513, 815, 714, 711, 627, 711, 655, 599, 577, 685, 627, 926,
    639, 617, 592, 324, 416, 324, 600, 561, 600, 549, 592, 509, 592, 555, 340, 538, 580, 265, 265, 548, 285, 882, 580, 562, 592, 592, 383, 494,
    365, 580, 512, 799, 530, 514, 487, 355, 352, 355, 600, 780, 843, 579, 585, 600,
  ],
  600: [
    236, 309, 471, 656, 600, 960, 713, 260, 337, 337, 556, 600, 299, 402, 299, 437, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 319, 319,
    600, 600, 600, 493, 899, 672, 663, 642, 689, 600, 577, 712, 719, 423, 545, 678, 521, 817, 719, 712, 641, 712, 664, 611, 580, 689, 638, 949,
    655, 632, 599, 329, 437, 329, 600, 559, 600, 559, 600, 513, 600, 558, 350, 545, 588, 275, 275, 562, 294, 888, 588, 563, 600, 600, 393, 499,
    374, 588, 524, 819, 544, 524, 502, 363, 376, 363, 600, 780, 869, 574, 593, 600,
  ],
} as const;
const PLEX_EXTRA_CHARS = "—…§µ×";
const PLEX_FALLBACK_WIDTH = 560;

function plexWidth(text: string, weight: keyof typeof PLEX_WIDTHS, sizePx: number) {
  const widths = PLEX_WIDTHS[weight];
  let total = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    const extra = PLEX_EXTRA_CHARS.indexOf(char);
    total += code >= 32 && code <= 126 ? widths[code - 32] : extra >= 0 ? widths[95 + extra] : PLEX_FALLBACK_WIDTH;
  }
  return (total * sizePx) / 1000;
}

/** Lines a text wraps to in a box `widthPx` wide: breaks at spaces and after hyphens, and inside a word longer than the box. */
function wrappedLines(text: string, weight: keyof typeof PLEX_WIDTHS, sizePx: number, widthPx: number) {
  const space = plexWidth(" ", weight, sizePx);
  let lines = 1;
  let line = 0;
  for (const word of text.split(/ +/).filter(Boolean)) {
    // Split after each hyphen without a lookbehind: Safari before 16.4 cannot parse one, and this runs while a lesson renders.
    (word.match(/[^-]*-|[^-]+/g) ?? [word]).forEach((part, index) => {
      const width = plexWidth(part, weight, sizePx);
      const gap = index === 0 && line > 0 ? space : 0;
      if (line === 0) line = width;
      else if (line + gap + width <= widthPx + 0.01) line += gap + width;
      else {
        lines += 1;
        line = width;
      }
      while (line > widthPx + 0.01) {
        lines += 1;
        line -= widthPx;
      }
    });
  }
  return lines;
}

/**
 * The question card's text boxes per band, from the browser on 2026-11-15:
 * font size and line height of the question and options, and the widths of the
 * question, of an option's label and of the title beside its icon (lesson
 * column at 1440, 1100 and 390 px).
 */
const QUESTION_CARD_BANDS = {
  height: { size: 17, lineHeight: 29, question: 750, option: 715, title: 698 },
  midHeight: { size: 17, lineHeight: 29, question: 730, option: 695, title: 678 },
  mobileHeight: { size: 16, lineHeight: 27, question: 308, option: 273, title: 256 },
} as const;

/**
 * InterviewQuestionPlayground's height follows its title, question and
 * options, so it is worked out from their wrapped lines in the card's own font
 * and widths: 167 px of frame and button, a line height per line, 46 px per
 * option (padding, border and gap), and the header (a 40 px icon beside a
 * title of 28 px lines). Checked on 2026-11-15 against all 366 instances at
 * 1440, 1100 and 390 px: 362, 359 and 347 of them are within 4 px; the rest are
 * one line out (a line that only just fits or only just wraps) and state their
 * own height with the placeholder props.
 */
export function estimateQuestionCardHeights(props: Readonly<Record<string, unknown>>) {
  const question = typeof props.question === "string" ? props.question : "";
  const options = Array.isArray(props.options)
    ? props.options.map((option) => (option && typeof option === "object" && typeof (option as { text?: unknown }).text === "string" ? (option as { text: string }).text : ""))
    : [];
  if (!question || options.length === 0) return undefined;
  const title = typeof props.title === "string" && props.title.trim() ? props.title : "Interview pitfall";
  const band = ({ size, lineHeight, question: questionWidth, option: optionWidth, title: titleWidth }: (typeof QUESTION_CARD_BANDS)[keyof typeof QUESTION_CARD_BANDS]) => {
    const lines = wrappedLines(question, 400, size, questionWidth) + options.reduce((sum, text) => sum + wrappedLines(text, 500, size, optionWidth), 0);
    const header = Math.max(40, 28 * wrappedLines(title, 600, 19, titleWidth));
    return Math.round(167 + lineHeight * lines + 46 * options.length + header);
  };
  return { height: band(QUESTION_CARD_BANDS.height), midHeight: band(QUESTION_CARD_BANDS.midHeight), mobileHeight: band(QUESTION_CARD_BANDS.mobileHeight) };
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
  // Re-measured on 2026-11-15 at 1440, 1100 and 390 px (every instance).
  ObjectHandleVisualizer: {
    height: 723,
    midHeight: 723,
    mobileHeight: 875,
    variants: [
      { when: propIs("mode", "bug"), height: 723, midHeight: 723, mobileHeight: 875 },
      { when: (props) => listLength(props.scenarios) > 2, height: 1064, midHeight: 1088, mobileHeight: 1386 },
      { when: (props) => listLength(props.scenarios) === 2, height: 1064, midHeight: 1088, mobileHeight: 1338 },
      { when: propIs("scenario", "aliasing"), height: 916, midHeight: 916, mobileHeight: 1162 },
      { when: propIs("scenario", "static-count"), height: 1124, midHeight: 1124, mobileHeight: 1377 },
      { when: propIs("scenario", "null-and-garbage"), height: 944, midHeight: 944, mobileHeight: 1218 },
    ],
  },
  // Every instance opens one section; "dispatch" is the taller one and the base value.
  PolymorphismDispatchVisualizer: {
    height: 1684,
    midHeight: 1684,
    mobileHeight: 2437,
    variants: [{ when: propIs("section", "cast"), height: 1000, midHeight: 1000, mobileHeight: 1386 }],
  },
  // Each scenario opens a different program; "procedures" (three instances) is the base.
  ProceduralBlocksSimulator: {
    height: 972,
    midHeight: 992,
    mobileHeight: 1342,
    variants: [
      { when: propIs("scenario", "decl-init-ready"), height: 645, midHeight: 665, mobileHeight: 975 },
      { when: all(propIs("scenario", "comb-vs-star"), (props) => listLength(props.scenarios) === 1), height: 895, midHeight: 895, mobileHeight: 1233 },
      { when: (props) => listLength(props.scenarios) === 2, height: 947, midHeight: 947, mobileHeight: 1215 },
      { when: propIs("scenario", "edge-vs-level"), height: 785, midHeight: 785, mobileHeight: 1179 },
      { when: propIs("scenario", "fork-timing"), height: 881, midHeight: 881, mobileHeight: 1163 },
      { when: propIs("scenario", "nba-swap"), height: 991, midHeight: 991, mobileHeight: 1411 },
      { when: propIs("scenario", "time0-race"), height: 809, midHeight: 809, mobileHeight: 1143 },
      { when: propIs("scenario", "time0-reset"), height: 929, midHeight: 929, mobileHeight: 1297 },
    ],
  },
  // Each preset opens its own trace; "basic" (and no preset) is the base. Two Tier 4 instances state their own heights.
  AnimatedUvmSequenceDriverHandshakeDiagram: {
    height: 1223,
    midHeight: 1243,
    mobileHeight: 2130,
    variants: [
      { when: propIs("initialPreset", "missing_item_done"), height: 1263, midHeight: 1263, mobileHeight: 2218 },
      { when: propIs("initialPreset", "double_get"), height: 1203, midHeight: 1203, mobileHeight: 2169 },
      { when: propIs("initialPreset", "responses"), height: 1217, midHeight: 1217, mobileHeight: 2244 },
      { when: propIs("initialPreset", "response_hang"), height: 1217, midHeight: 1217, mobileHeight: 2125 },
    ],
  },
  // Each family opens its own operator table; "equality" and "shift" sit at the base value.
  OperatorExplorer: {
    height: 773,
    midHeight: 773,
    mobileHeight: 999,
    variants: [
      { when: propIs("family", "bitcount"), height: 948, midHeight: 948, mobileHeight: 1350 },
      { when: propIs("family", "concat"), height: 825, midHeight: 825, mobileHeight: 1092 },
      { when: propIs("family", "conditional"), height: 928, midHeight: 928, mobileHeight: 1295 },
      { when: propIs("family", "inside"), height: 797, midHeight: 797, mobileHeight: 1067 },
      { when: propIs("family", "reduction"), height: 851, midHeight: 851, mobileHeight: 1071 },
      { when: propIs("family", "stream"), height: 933, midHeight: 933, mobileHeight: 1152 },
    ],
  },
  // Each scenario opens its own expression; "lost-carry" sits at the base value.
  SignednessVisualizer: {
    height: 896,
    midHeight: 896,
    mobileHeight: 1271,
    variants: [
      { when: propIs("scenario", "ashr-unsigned-context"), height: 872, midHeight: 872, mobileHeight: 1263 },
      { when: propIs("scenario", "casts"), height: 775, midHeight: 775, mobileHeight: 1146 },
      { when: propIs("scenario", "int-vs-logic"), height: 852, midHeight: 852, mobileHeight: 1091 },
      { when: propIs("scenario", "part-select"), height: 828, midHeight: 828, mobileHeight: 1078 },
      { when: propIs("scenario", "shift-fill"), height: 687, midHeight: 687, mobileHeight: 958 },
      { when: propIs("scenario", "signed-compare"), height: 872, midHeight: 872, mobileHeight: 1044 },
      { when: propIs("scenario", "x-arith"), height: 735, midHeight: 735, mobileHeight: 1005 },
    ],
  },
  // The base is the timeout-disable-fork tour; the other openings are shorter, except the tour with its process tree.
  ForkJoinVisualizer: {
    height: 1139,
    midHeight: 1139,
    mobileHeight: 1509,
    variants: [
      { when: propIs("mode", "debug"), height: 1015, midHeight: 1015, mobileHeight: 1199 },
      { when: propIs("scenario", "event-race"), height: 964, midHeight: 964, mobileHeight: 1317 },
      // Measured on 2026-11-15 on F2C (1440, 1100 and 390 px), with the process tree open where `treeView` is set.
      { when: all(propIs("scenario", "timeout-disable-fork"), propIs("treeView", true)), height: 1827, midHeight: 1864, mobileHeight: 2248 },
      { when: propIs("scenario", "finished-child-grandchild"), height: 1517, midHeight: 1531, mobileHeight: 1802 },
      { when: propIs("scenario", "fork-loop-capture"), height: 809, midHeight: 809, mobileHeight: 1135 },
      { when: propIs("scenario", "join-variants"), height: 1049, midHeight: 1049, mobileHeight: 1279 },
      { when: all(propIs("scenario", "timeout-disable-fork"), (props) => listLength(props.scenarios) === 1), height: 1087, midHeight: 1087, mobileHeight: 1453 },
    ],
  },
  // Each mode (and read-time preset) opens a different panel; "cross-scope" sits at the base value.
  TimescaleLab: {
    height: 1084,
    midHeight: 1084,
    mobileHeight: 1507,
    variants: [
      { when: all(propIs("mode", "read-time"), propIs("preset", "make-it-work")), height: 1757, midHeight: 1757, mobileHeight: 2247 },
      { when: all(propIs("mode", "read-time"), propIs("preset", "f2d-printing-time")), height: 1463, midHeight: 1463, mobileHeight: 1739 },
      { when: propIs("mode", "read-time"), height: 1365, midHeight: 1385, mobileHeight: 1870 },
      { when: propIs("mode", "global-precision"), height: 815, midHeight: 839, mobileHeight: 1240 },
      { when: propIs("mode", "rounding"), height: 738, midHeight: 738, mobileHeight: 1048 },
      { when: propIs("mode", "two-modules"), height: 1050, midHeight: 1102, mobileHeight: 1550 },
      { when: propIs("mode", "which-unit"), height: 1093, midHeight: 1093, mobileHeight: 1542 },
    ],
  },
  // Each lesson opens its own scenario and picker; the picker's length changes the height as much as the scenario does.
  // Mid-band heights measured on 2026-11-15 at 1100 px; re-measured on 2026-11-16 at 1440, 1100 and 390 px (every
  // instance) after the figure title strip: the openings with a figure are 8 px taller.
  TimeSlotTraceVisualizer: {
    height: 1067,
    midHeight: 1081,
    mobileHeight: 1707,
    variants: [
      { when: propIs("scenario", "shift-blocking"), height: 1248, midHeight: 1236, mobileHeight: 1924 },
      { when: propIs("scenario", "shift-nba"), height: 1210, midHeight: 1198, mobileHeight: 1772 },
      { when: propIs("scenario", "display-vs-strobe"), height: 1067, midHeight: 1081, mobileHeight: 1707 },
      { when: propIs("scenario", "f3a-one-edge"), height: 901, midHeight: 901, mobileHeight: 1185 },
      { when: propIs("scenario", "gclk-interleave"), height: 659, midHeight: 659, mobileHeight: 870 },
      { when: propIs("scenario", "tb-blocking-drive"), height: 1144, midHeight: 1192, mobileHeight: 1896 },
      { when: propIs("scenario", "tb-nba-drive"), height: 1144, midHeight: 1272, mobileHeight: 1896 },
      { when: propIs("scenario", "tb-clocking-block"), height: 1053, midHeight: 1101, mobileHeight: 1747 },
    ],
  },
  // Each deck holds a different number of cards.
  ScenarioSorter: {
    height: 510,
    midHeight: 458,
    mobileHeight: 798,
    variants: [
      { when: propIs("deck", "function-body"), height: 490, midHeight: 490, mobileHeight: 582 },
      { when: propIs("deck", "ipc-tools"), height: 478, midHeight: 478, mobileHeight: 710 },
      { when: propIs("deck", "regression-log"), height: 604, midHeight: 604, mobileHeight: 704 },
      { when: propIs("deck", "sv-features"), height: 526, midHeight: 526, mobileHeight: 834 },
      { when: propIs("deck", "task-or-function"), height: 322, midHeight: 322, mobileHeight: 524 },
      { when: propIs("deck", "uvm-compile-triage"), height: 582, midHeight: 600, mobileHeight: 814 },
      { when: propIs("deck", "uvm-name-layers"), height: 440, midHeight: 440, mobileHeight: 580 },
      { when: propIs("deck", "verification-methods"), height: 546, midHeight: 546, mobileHeight: 826 },
    ],
  },
  // Each mode and preset opens a different layout; the "word_u" union sits at the base value.
  PackedLayoutExplorer: {
    height: 1097,
    midHeight: 1097,
    mobileHeight: 1407,
    variants: [
      { when: propIs("mode", "mutation"), height: 1505, midHeight: 1505, mobileHeight: 1795 },
      { when: propIs("mode", "tagged"), height: 647, midHeight: 647, mobileHeight: 807 },
      { when: propIs("preset", "cmd_t"), height: 1222, midHeight: 1321, mobileHeight: 1590 },
      { when: propIs("preset", "pkt_hdr_t"), height: 1256, midHeight: 1355, mobileHeight: 1756 },
      { when: propIs("preset", "swapped-fields"), height: 867, midHeight: 867, mobileHeight: 1243 },
      { when: propIs("preset", "empty-name-struct"), height: 903, midHeight: 903, mobileHeight: 1216 },
    ],
  },
  // Re-measured on 2026-11-15 at 1440, 1100 and 390 px on F2C and F3A: each preset opens its own program;
  // "f2c-timing-controls" is the base.
  TimingControlExplorer: {
    height: 711,
    midHeight: 711,
    mobileHeight: 1105,
    variants: [
      { when: propIs("mode", "intra"), height: 715, midHeight: 710, mobileHeight: 1242 },
      { when: propIs("mode", "wake"), height: 667, midHeight: 667, mobileHeight: 916 },
      { when: propIs("preset", "f2c-sensitivity-lists"), height: 692, midHeight: 711, mobileHeight: 1105 },
    ],
  },
  // The base is the "severity-and-end" lanes (F2D); the watchdog race and the scheduler loop open taller panels.
  RunEndingExplorer: {
    height: 928,
    midHeight: 928,
    mobileHeight: 1358,
    variants: [
      { when: propIs("preset", "watchdog-race"), height: 1727, midHeight: 1727, mobileHeight: 2233 },
      { when: propIs("view", "loop"), height: 975, midHeight: 975, mobileHeight: 1277 },
    ],
  },
  // All seven instances: 641 to 681 px at 1440 and 681 to 781 px at 390 (the editor scrolls past a fixed height);
  // the instances away from the base value state their own heights.
  InteractiveCode: { height: 661, midHeight: 661, mobileHeight: 701 },
  TimeSlotRegionMap: { height: 686, midHeight: 674, mobileHeight: 1024 },
  // The base is the default bench (F3C); "nba-writers" (F3B) opens a taller one.
  RaceConditionDebugger: {
    height: 656,
    midHeight: 656,
    mobileHeight: 895,
    variants: [{ when: propIs("bench", "nba-writers"), height: 687, midHeight: 731, mobileHeight: 931 }],
  },
  TestbenchDriveComparison: { height: 462, midHeight: 462, mobileHeight: 688 },
  RaceDebugChallenge: { height: 623, midHeight: 623, mobileHeight: 761 },
  // Re-measured on 2026-11-15 on F2A and its structs lesson: the base is the methods tab (no initialTab).
  EnumMethodVisualizer: {
    height: 1112,
    midHeight: 1192,
    mobileHeight: 1772,
    variants: [
      { when: propIs("initialTab", "declaration"), height: 763, midHeight: 783, mobileHeight: 1095 },
      { when: propIs("initialTab", "casts"), height: 1125, midHeight: 1125, mobileHeight: 1619 },
    ],
  },
  // Every instance opens its own preset, so each has its own value.
  FileReadCursorVisualizer: {
    height: 1294,
    midHeight: 1294,
    mobileHeight: 1946,
    variants: [
      { when: propIs("preset", "feeding-files"), height: 1328, midHeight: 1328, mobileHeight: 1938 },
      { when: propIs("preset", "lesson"), height: 1156, midHeight: 1156, mobileHeight: 1685 },
      { when: propIs("preset", "worked-example"), height: 659, midHeight: 659, mobileHeight: 1024 },
      { when: propIs("preset", "case-2"), height: 1493, midHeight: 1493, mobileHeight: 1584 },
      { when: propIs("preset", "robust-parsing"), height: 1392, midHeight: 1392, mobileHeight: 2165 },
      { when: propIs("preset", "regression-scale"), height: 1294, midHeight: 1294, mobileHeight: 1946 },
    ],
  },
  // Measured on 2026-11-15 at 1440, 1100 and 390 px for every instance in the nine Tier 1 lessons that embed them
  // (F1A, F2A and its structs lesson, F2B, F2C and flow-control, F2D and ipc, F3B).
  InteractiveCostOfBugGraph: { height: 520, midHeight: 520, mobileHeight: 716 },
  HallOfShameCarousel: { height: 927, midHeight: 927, mobileHeight: 1476 },
  BoundaryProbe: { height: 1166, midHeight: 1166, mobileHeight: 1500 },
  // The base is section="widths"; the defaults drills are much shorter.
  DataTypeComparisonChart: {
    height: 1354,
    midHeight: 1370,
    mobileHeight: 2189,
    variants: [{ when: propIs("section", "defaults"), height: 523, midHeight: 523, mobileHeight: 809 }],
  },
  // The base is the "hex-ff" preset (also the default); "truncated-hex" opens a longer readout.
  // Re-measured on 2026-11-15 with the slot's full height: both openings are 20 px taller than first recorded.
  LiteralDecoder: {
    height: 1027,
    midHeight: 1027,
    mobileHeight: 1723,
    variants: [{ when: propIs("preset", "truncated-hex"), height: 1161, midHeight: 1161, mobileHeight: 1857 }],
  },
  // Measured on 2026-11-15 at 1440, 1100 and 390 px (F2B, its one instance, no props).
  ArrayMethodExplorer: { height: 883, midHeight: 883, mobileHeight: 1407 },
  // Measured on 2026-11-15 at 1440, 1100 and 390 px on F2D ipc: the base is mode="triage" (also the default); each other mode opens its own lab.
  IpcSmellClinic: {
    height: 864,
    midHeight: 884,
    mobileHeight: 1227,
    variants: [
      { when: propIs("mode", "deadlock"), height: 997, midHeight: 997, mobileHeight: 1298 },
      { when: propIs("mode", "kata"), height: 1065, midHeight: 1065, mobileHeight: 1363 },
    ],
  },
  // Each initial scene opens its own panel; "mem-block" is the base.
  SystemVerilog3DVisualizer: {
    height: 1316,
    midHeight: 1316,
    mobileHeight: 1690,
    variants: [{ when: propIs("initialScene", "queue"), height: 668, midHeight: 668, mobileHeight: 832 }],
  },
  // The base is the UVM scoreboard with no mode (A-UVM-6 and E-RISCV-1, measured on 2026-11-15 as well); debug mode and the plain-SV F2B instances differ.
  ScoreboardMatchingVisualizer: {
    height: 1008,
    midHeight: 1048,
    mobileHeight: 1647,
    variants: [
      { when: propIs("mode", "debug"), height: 1285, midHeight: 1309, mobileHeight: 1897 },
      { when: all(propIs("variant", "plain-sv"), (props) => listLength(props.compare) > 0), height: 2663, midHeight: 2663, mobileHeight: 4183 },
      { when: propIs("variant", "plain-sv"), height: 2527, midHeight: 2647, mobileHeight: 4173 },
    ],
  },
  // The game (no items) opens on a short start card; the "first-read" sorter is the full board.
  EventRegionGame: {
    height: 334,
    midHeight: 334,
    mobileHeight: 370,
    variants: [{ when: propIs("items", "first-read"), height: 1138, midHeight: 1186, mobileHeight: 1122 }],
  },
  // The base is the "f3b-worked-example" preset (also the default).
  RegionTraceExercise: {
    height: 1747,
    midHeight: 1891,
    mobileHeight: 2479,
    variants: [{ when: propIs("preset", "f3b-kata"), height: 1860, midHeight: 1860, mobileHeight: 2760 }],
  },
  // The base is "for-continue-break"; each other preset opens its own program.
  LoopTracer: {
    height: 807,
    midHeight: 807,
    mobileHeight: 1024,
    variants: [
      { when: propIs("preset", "foreach-visit-order"), height: 719, midHeight: 719, mobileHeight: 955 },
      { when: propIs("preset", "repeat-1101"), height: 811, midHeight: 811, mobileHeight: 1099 },
    ],
  },
  EventMemoryMatrix: { height: 1188, midHeight: 1188, mobileHeight: 1498 },
  // The base is mode="format" (also the default); each monitor opening is taller.
  PrintingLab: {
    height: 803,
    midHeight: 803,
    mobileHeight: 1055,
    variants: [
      { when: all(propIs("mode", "monitor"), propIs("preset", "replaced-list")), height: 1192, midHeight: 1192, mobileHeight: 1300 },
      { when: propIs("mode", "monitor"), height: 1765, midHeight: 1765, mobileHeight: 2161 },
    ],
  },
  ReadmemLoader: { height: 776, midHeight: 776, mobileHeight: 1310 },
  // The base is the semaphore game (no mode on ipc, mode="semaphore" in Tier 2, also measured on 2026-11-15); the other openings differ.
  MailboxSemaphoreGame: {
    height: 1496,
    midHeight: 1496,
    mobileHeight: 2162,
    variants: [
      { when: propIs("mode", "mailbox"), height: 1490, midHeight: 1490, mobileHeight: 2110 },
      { when: propIs("mode", "debug"), height: 1072, midHeight: 1072, mobileHeight: 1268 },
      { when: propIs("mode", "bench"), height: 1649, midHeight: 1649, mobileHeight: 2281 },
      { when: all(propIs("mode", "semaphore"), propIs("initialProgram", "same-time")), height: 1480, midHeight: 1480, mobileHeight: 2243 },
    ],
  },
  // Measured on 2026-11-15 at 1440, 1100 and 390 px for every instance in every lesson that embeds them
  // (F1A, F1C, F2A, F2B, F2C and flow-control, F2E, F3B, F4A, F4C, I-SV-4A, I-SV-4B, E-AI-1).
  // DesignGapChart redrawn for the new figure look; re-measured on 2026-11-16 (F1A, its one instance).
  DesignGapChart: { height: 758, midHeight: 754, mobileHeight: 603 },
  ShiftLeftTimeline: { height: 1235, midHeight: 1235, mobileHeight: 2201 },
  StringMethodExplorer: { height: 574, midHeight: 574, mobileHeight: 690 },
  // The game opens on its short start card.
  PacketSorterGame: { height: 380, midHeight: 380, mobileHeight: 568 },
  // The base is mode="decide" with the default case; the custom case and the kata are taller.
  FixPathDecisionLab: {
    height: 635,
    midHeight: 635,
    mobileHeight: 1062,
    variants: [
      { when: propIs("mode", "kata"), height: 1934, midHeight: 1934, mobileHeight: 3138 },
      { when: propIs("preset", "custom"), height: 1221, midHeight: 1221, mobileHeight: 1766 },
    ],
  },
  // Each machine opens its own diagram; "traffic-light" is the base.
  FsmEdgeStepper: {
    height: 2017,
    midHeight: 2017,
    mobileHeight: 2748,
    variants: [{ when: propIs("machine", "seq-detect-101"), height: 1737, midHeight: 1785, mobileHeight: 2429 }],
  },
  // The base is mode="checker" with its default preset (F2E); the debug lab on F2A is much taller.
  XCheckLab: {
    height: 1086,
    midHeight: 1086,
    mobileHeight: 1566,
    variants: [
      { when: propIs("mode", "debug"), height: 1741, midHeight: 1741, mobileHeight: 1993 },
      { when: propIs("preset", "int-copy"), height: 1134, midHeight: 1134, mobileHeight: 1638 },
    ],
  },
  // The base is the default opening (drivers mode, F2A and F4A); each other mode or preset differs.
  NetResolutionSimulator: {
    height: 1295,
    midHeight: 1295,
    mobileHeight: 1809,
    variants: [
      { when: propIs("initialMode", "legality"), height: 1130, midHeight: 1130, mobileHeight: 1449 },
      { when: propIs("initialMode", "trireg"), height: 1071, midHeight: 1071, mobileHeight: 1314 },
      { when: propIs("preset", "open-drain"), height: 1139, midHeight: 1139, mobileHeight: 1597 },
    ],
  },
  // Each preset opens its own declaration; "packed-unpacked" is the base.
  ArraySelectExplorer: {
    height: 752,
    midHeight: 752,
    mobileHeight: 1108,
    variants: [
      { when: propIs("preset", "mixed-dimensions"), height: 1132, midHeight: 1132, mobileHeight: 1398 },
      { when: propIs("preset", "indexed-part-select"), height: 719, midHeight: 719, mobileHeight: 1043 },
      { when: propIs("preset", "query-functions"), height: 1183, midHeight: 1183, mobileHeight: 1737 },
    ],
  },
  // The base is the default opening (no props); each initial preset opens its own structure.
  DynamicStructureVisualizer: {
    height: 744,
    midHeight: 744,
    mobileHeight: 1207,
    variants: [
      { when: propIs("initialPreset", "slices"), height: 964, midHeight: 964, mobileHeight: 1251 },
      { when: propIs("initialPreset", "access-semantics"), height: 947, midHeight: 947, mobileHeight: 1673 },
      { when: propIs("initialPreset", "delete-walk"), height: 721, midHeight: 745, mobileHeight: 1037 },
    ],
  },
  // The base is the default opening (no props, F2A); each other opening differs.
  LogicStateDiagram: {
    height: 953,
    midHeight: 953,
    mobileHeight: 1469,
    variants: [
      { when: propIs("preset", "vector-condition"), height: 1049, midHeight: 1049, mobileHeight: 1494 },
      { when: propIs("initialConstruct", "case"), height: 1029, midHeight: 1029, mobileHeight: 1413 },
      { when: (props) => listLength(props.tabs) === 1, height: 922, midHeight: 922, mobileHeight: 1294 },
    ],
  },
  // The base is "program-reactive" alone (F4C); the next-region tour and "clocking-drive" (F3B) differ.
  SVSchedulerRegionVisualizer: {
    height: 793,
    midHeight: 793,
    mobileHeight: 1134,
    variants: [
      { when: propIs("mode", "next-region"), height: 775, midHeight: 775, mobileHeight: 1232 },
      { when: propIs("scenario", "clocking-drive"), height: 993, midHeight: 1061, mobileHeight: 1640 },
    ],
  },
  // The base is the full lab with no props (I-SV-4A, I-SV-4B, E-AI-1); the learn-only presets in Tier 1 are shorter.
  // Re-measured on 2026-11-16 (every instance) after the figure title strip.
  SvaSequenceWaveformVisualizer: {
    height: 1163,
    midHeight: 1163,
    mobileHeight: 1743,
    variants: [
      { when: propIs("initialPreset", "req-gnt-2"), height: 1097, midHeight: 1097, mobileHeight: 1493 },
      { when: propIs("initialPreset", "flop-output-low"), height: 1087, midHeight: 1087, mobileHeight: 1495 },
    ],
  },
  // Each preset opens its own trace; "reset-nba-flush" (F2C) is the base.
  DeferredReportVisualizer: {
    height: 1076,
    midHeight: 1076,
    mobileHeight: 1478,
    variants: [{ when: propIs("preset", "assert-forms-glitch"), height: 772, midHeight: 772, mobileHeight: 1146 }],
  },

  // Measured on 2026-11-15 at 1440, 1100 and 390 px for every instance in every lesson (the verifier's full run).
  // Where the openings differ, the base is the commonest one (or the one with no props) and each other opening is a
  // variant; an instance whose context changes its height states its own with the placeholder props.
  AhbPipelineBurstVisualizer: { height: 786, midHeight: 826, mobileHeight: 1319 },
  AmbaFamilyExplorer: { height: 1908, midHeight: 1908, mobileHeight: 2842 },
  AnalysisBroadcastVisualizer: {
    height: 911,
    midHeight: 911,
    mobileHeight: 1307,
    variants: [{ when: propIs("section", "slow"), height: 649, midHeight: 649, mobileHeight: 829 }],
  },
  AnimatedUvmTestbenchDiagram: { height: 663, midHeight: 663, mobileHeight: 1019 },
  // Re-measured on 2026-11-16 (every instance) after the figure title strip; B-AMBA-2 states its own mid and phone heights.
  AxiChannelHandshakeVisualizer: {
    height: 1505,
    midHeight: 1505,
    mobileHeight: 2435,
    variants: [{ when: propIs("focus", "handshake"), height: 1071, midHeight: 1071, mobileHeight: 1705 }],
  },
  AxiDeadlockSimulator: { height: 822, midHeight: 857, mobileHeight: 1340 },
  AxiIdOrderingVisualizer: {
    height: 589,
    midHeight: 589,
    mobileHeight: 851,
    variants: [{ when: propIs("initialPreset", "interconnect"), height: 723, midHeight: 723, mobileHeight: 1089 }],
  },
  AxiMemoryMathVisualizer: { height: 787, midHeight: 831, mobileHeight: 1330 },
  BindDirectiveVisualizer: { height: 1046, midHeight: 1066, mobileHeight: 1760 },
  BridgeTranslationExplorer: { height: 838, midHeight: 838, mobileHeight: 1376 },
  CallbackTimingVisualizer: {
    height: 1089,
    midHeight: 1128,
    mobileHeight: 1705,
    variants: [{ when: propIs("mode", "debug"), height: 977, midHeight: 977, mobileHeight: 1489 }],
  },
  ClockingBlockSkewVisualizer: { height: 1242, midHeight: 1290, mobileHeight: 1907 },
  ClosureBudgetLab: { height: 427, midHeight: 427, mobileHeight: 633 },
  ConfigDbExplorer: { height: 1404, midHeight: 1404, mobileHeight: 2293 },
  // The base is initialMode="size"; each other mode opens its own panel.
  ConstraintSolverExplorer: {
    height: 777,
    midHeight: 797,
    mobileHeight: 1079,
    variants: [
      { when: propIs("initialMode", "dist"), height: 800, midHeight: 820, mobileHeight: 1082 },
      { when: propIs("initialMode", "hole"), height: 869, midHeight: 869, mobileHeight: 1218 },
      { when: propIs("initialMode", "order"), height: 793, midHeight: 793, mobileHeight: 1108 },
      { when: propIs("initialMode", "soft"), height: 797, midHeight: 797, mobileHeight: 1127 },
    ],
  },
  // The base is the "debug" scenario (three instances); each other scenario opens its own heatmap.
  ConstraintSolverHeatmapVisualizer: {
    height: 858,
    midHeight: 858,
    mobileHeight: 1077,
    variants: [
      { when: propIs("initialScenario", "coupling"), height: 927, midHeight: 927, mobileHeight: 1173 },
      { when: propIs("initialScenario", "dist"), height: 1019, midHeight: 1019, mobileHeight: 1376 },
      { when: propIs("initialScenario", "implication"), height: 975, midHeight: 975, mobileHeight: 1264 },
      { when: propIs("initialScenario", "soft"), height: 975, midHeight: 975, mobileHeight: 1317 },
    ],
  },
  ConstraintSolverVisualizer: { height: 1261, midHeight: 1261, mobileHeight: 1710 },
  // The base is the "x-blind" mutation; the other mutation, the coverage view and the matrix differ.
  CounterBenchLab: {
    height: 875,
    midHeight: 875,
    mobileHeight: 1475,
    variants: [
      { when: propIs("preset", "self-copy"), height: 899, midHeight: 899, mobileHeight: 1523 },
      { when: propIs("mode", "coverage"), height: 580, midHeight: 580, mobileHeight: 870 },
      { when: propIs("mode", "matrix"), height: 879, midHeight: 899, mobileHeight: 999 },
    ],
  },
  CoverageCrossExplorerVisualizer: {
    height: 2050,
    midHeight: 2050,
    mobileHeight: 2771,
    variants: [
      { when: propIs("mode", "closure"), height: 580, midHeight: 580, mobileHeight: 909 },
      { when: propIs("initialStimulus", "biased"), height: 2122, midHeight: 2122, mobileHeight: 2915 },
    ],
  },
  // The sampling tab re-measured on 2026-11-16 after the figure title strip.
  CovergroupBuilder: {
    height: 1842,
    midHeight: 1842,
    mobileHeight: 2807,
    variants: [{ when: propIs("initialTab", "sampling"), height: 872, midHeight: 1004, mobileHeight: 1435 }],
  },
  CurriculumDataTypeExplorer: { height: 706, midHeight: 722, mobileHeight: 1097 },
  CurriculumDataTypeQuiz: { height: 714, midHeight: 714, mobileHeight: 866 },
  DPIBoundaryInspector: { height: 1326, midHeight: 1326, mobileHeight: 2156 },
  DebuggingSimulator: {
    height: 741,
    midHeight: 785,
    mobileHeight: 1035,
    variants: [{ when: propIs("scenario", "hang"), height: 741, midHeight: 741, mobileHeight: 987 }],
  },
  // Each preset opens its own decoder.
  DecisionLab: {
    height: 1025,
    midHeight: 1025,
    mobileHeight: 1714,
    variants: [
      { when: propIs("preset", "lesson-decoder"), height: 899, midHeight: 899, mobileHeight: 1211 },
      { when: propIs("preset", "casex-vs-inside"), height: 692, midHeight: 692, mobileHeight: 1259 },
    ],
  },
  ExclusiveAccessVisualizer: { height: 1103, midHeight: 1103, mobileHeight: 1927 },
  // The base is mode="precedence" with its default preset.
  ExpressionTreeExplorer: {
    height: 616,
    midHeight: 616,
    mobileHeight: 740,
    variants: [
      { when: propIs("preset", "power-chain"), height: 544, midHeight: 544, mobileHeight: 668 },
      { when: propIs("mode", "width"), height: 691, midHeight: 691, mobileHeight: 1073 },
    ],
  },
  FactoryOverrideExplorerVisualizer: { height: 2199, midHeight: 2199, mobileHeight: 2746 },
  FactoryOverrideVisualizer: { height: 1626, midHeight: 1670, mobileHeight: 2537 },
  // Re-measured on 2026-11-16 (F1B) after its redesign.
  FirstBugHuntGame: { height: 796, midHeight: 796, mobileHeight: 972 },
  FormalVsSimulationVisualizer: { height: 1371, midHeight: 1391, mobileHeight: 1968 },
  GenerateElaborationVisualizer: { height: 859, midHeight: 859, mobileHeight: 1229 },
  InteractiveUvmArchitectureDiagram: { height: 2121, midHeight: 2131, mobileHeight: 3147 },
  InterfaceSignalFlow: { height: 1692, midHeight: 1692, mobileHeight: 2576 },
  KeywordSetExplorer: {
    height: 815,
    midHeight: 815,
    mobileHeight: 1182,
    variants: [
      { when: propIs("mode", "lineage"), height: 514, midHeight: 514, mobileHeight: 740 },
      { when: propIs("mode", "regions"), height: 946, midHeight: 946, mobileHeight: 1280 },
    ],
  },
  MethodologyPhaseVisualizer: { height: 1279, midHeight: 1299, mobileHeight: 2149 },
  ModportExplorer: { height: 1401, midHeight: 1425, mobileHeight: 2153 },
  MultiAgentCoordinationVisualizer: {
    height: 1016,
    midHeight: 1060,
    mobileHeight: 1647,
    variants: [{ when: propIs("mode", "debug"), height: 889, midHeight: 889, mobileHeight: 1313 }],
  },
  PowerDomainVisualizer: { height: 712, midHeight: 712, mobileHeight: 1109 },
  ProtocolAnalogyExplorer: { height: 1122, midHeight: 1142, mobileHeight: 1698 },
  // Each waveform's height follows its spec, so every instance away from this one states its own heights.
  ProtocolWaveform: { height: 438, midHeight: 438, mobileHeight: 558 },
  PssIntentMapVisualizer: { height: 2263, midHeight: 2303, mobileHeight: 3231 },
  QueueOperationLab: {
    height: 768,
    midHeight: 768,
    mobileHeight: 1170,
    variants: [{ when: propIs("initialScenario", "mixed"), height: 763, midHeight: 763, mobileHeight: 1003 }],
  },
  RALPredictorVisualizer: { height: 1339, midHeight: 1355, mobileHeight: 2004 },
  RalRegisterMapVisualizer: { height: 909, midHeight: 909, mobileHeight: 1394 },
  // The base is the "smoke" step-through; the debug lab and the two matrices differ.
  // The base re-measured on 2026-11-16 after the figure title strip.
  SelfCheckBenchLab: {
    height: 2602,
    midHeight: 2595,
    mobileHeight: 1626,
    variants: [
      { when: all(propIs("mode", "matrix"), propIs("scope", "plan")), height: 599, midHeight: 599, mobileHeight: 687 },
      { when: propIs("mode", "matrix"), height: 728, midHeight: 728, mobileHeight: 872 },
      { when: propIs("mode", "debug"), height: 1205, midHeight: 1229, mobileHeight: 1463 },
    ],
  },
  SequencerArbitrationSandbox: { height: 1662, midHeight: 1781, mobileHeight: 2694 },
  // The base is mode="stream" with its default preset.
  StreamPackLab: {
    height: 1098,
    midHeight: 1098,
    mobileHeight: 1444,
    variants: [
      { when: propIs("preset", "whole-vs-field"), height: 1030, midHeight: 1030, mobileHeight: 1380 },
      { when: propIs("mode", "cast"), height: 1058, midHeight: 1058, mobileHeight: 1452 },
    ],
  },
  // Each mode opens its own lab; the base is mode="lifetime" with its default preset.
  SubroutineLab: {
    height: 1007,
    midHeight: 1027,
    mobileHeight: 1319,
    variants: [
      { when: all(propIs("mode", "lifetime"), propIs("preset", "initializers")), height: 2145, midHeight: 2169, mobileHeight: 2912 },
      { when: propIs("mode", "debug"), height: 2485, midHeight: 2485, mobileHeight: 3409 },
      { when: propIs("mode", "directions"), height: 1435, midHeight: 1435, mobileHeight: 2097 },
      { when: propIs("mode", "formals"), height: 810, midHeight: 829, mobileHeight: 1112 },
      { when: propIs("mode", "recursion"), height: 940, midHeight: 940, mobileHeight: 1218 },
    ],
  },
  TLMPortConnector: { height: 1019, midHeight: 1019, mobileHeight: 1452 },
  TelemetryEventBusVisualizer: { height: 1122, midHeight: 1078, mobileHeight: 1676 },
  // TemporalLogicExplorer, TlmConnectionBuilderVisualizer and UvmVirtualSequencerDiagram re-measured on 2026-11-16
  // (every instance) after the figure title and legend strips.
  TemporalLogicExplorer: { height: 1230, midHeight: 1230, mobileHeight: 1810 },
  TlmConnectionBuilderVisualizer: { height: 1291, midHeight: 1282, mobileHeight: 1657 },
  TransactionRecordingVisualizer: { height: 1139, midHeight: 1183, mobileHeight: 1647 },
  UVMTreeExplorer: { height: 621, midHeight: 621, mobileHeight: 1021 },
  UvmContainerVisualizer: { height: 873, midHeight: 873, mobileHeight: 1061 },
  UvmPhaseTimelineVisualizer: { height: 1488, midHeight: 1508, mobileHeight: 2396 },
  UvmPhasingDiagram: { height: 1203, midHeight: 1203, mobileHeight: 2008 },
  UvmPolicyVisualizer: { height: 1382, midHeight: 1498, mobileHeight: 2239 },
  UvmSequenceHierarchyVisualizer: { height: 1117, midHeight: 1117, mobileHeight: 1719 },
  UvmVirtualSequencerDiagram: { height: 1293, midHeight: 1302, mobileHeight: 1516 },
  VIPReuseVisualizer: { height: 540, midHeight: 540, mobileHeight: 756 },
  VerificationMethodologiesDiagram: { height: 1162, midHeight: 1162, mobileHeight: 1803 },
  VerificationMethodsExplorer: {
    height: 1108,
    midHeight: 1108,
    mobileHeight: 1415,
    variants: [{ when: propIs("preset", "f1b-assumptions"), height: 952, midHeight: 952, mobileHeight: 1331 }],
  },
  VerilogVsSystemVerilog: { height: 994, midHeight: 994, mobileHeight: 1698 },
  VirtualSequencerExplorer: { height: 1227, midHeight: 1251, mobileHeight: 1780 },
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
