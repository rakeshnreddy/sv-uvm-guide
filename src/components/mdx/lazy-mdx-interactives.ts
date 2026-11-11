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

/**
 * Measured in the browser on 2026-11-10 (lesson column at 1440 px and at
 * 390 px, the interactive's first state, margins excluded). Where one
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
  InterviewQuestionPlayground: { height: 594, midHeight: 551, mobileHeight: 839 },
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
    height: 1719,
    midHeight: 1719,
    mobileHeight: 2482,
    variants: [{ when: propIs("section", "cast"), height: 990, midHeight: 1010, mobileHeight: 1377 }],
  },
  // One instance (F1C, "decl-init-ready") is far shorter than the rest; its own mid height keeps the others' value close.
  ProceduralBlocksSimulator: {
    height: 951,
    midHeight: 915,
    mobileHeight: 1233,
    variants: [{ when: propIs("scenario", "decl-init-ready"), height: 951, midHeight: 644, mobileHeight: 1233 }],
  },
  AnimatedUvmSequenceDriverHandshakeDiagram: { height: 1228, midHeight: 1210, mobileHeight: 2211 },
  OperatorExplorer: { height: 771, midHeight: 771, mobileHeight: 987 },
  SignednessVisualizer: { height: 900, midHeight: 801, mobileHeight: 1256 },
  ForkJoinVisualizer: { height: 1154, midHeight: 971, mobileHeight: 1510 },
  TimescaleLab: { height: 1082, midHeight: 1144, mobileHeight: 1496 },
  TimeSlotTraceVisualizer: { height: 789, midHeight: 913, mobileHeight: 1032 },
  ScenarioSorter: { height: 506, midHeight: 458, mobileHeight: 814 },
  PackedLayoutExplorer: { height: 1096, midHeight: 1098, mobileHeight: 1400 },
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
  const variant = meta.variants?.find((candidate) => candidate.when(props));
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
