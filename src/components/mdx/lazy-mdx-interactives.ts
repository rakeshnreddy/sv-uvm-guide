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
  mobileHeight?: number;
}

/**
 * What the placeholder needs before an interactive's code arrives: its title
 * and the height to reserve, so the page does not move when it swaps in.
 */
export interface LazyMdxInteractiveMeta {
  /** Sentence-case title; defaults to one derived from the component name. */
  title?: string;
  /** Rendered height in px from 640 px up, margins excluded. */
  height?: number;
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
export const PLACEHOLDER_MOBILE_HEIGHT_PROP = "placeholderMobileHeight";

const propIs = (key: string, value: unknown) => (props: Readonly<Record<string, unknown>>) => props[key] === value;
const listLength = (value: unknown) => (Array.isArray(value) ? value.length : 0);

/**
 * Measured in the browser on 2026-11-10 (lesson column at 1440 px and at
 * 390 px, the interactive's first state, margins excluded). Where one
 * interactive opens different presets, each preset is a variant; otherwise the
 * value is the median of its instances (InterviewQuestionPlayground grows with
 * its question, from 565 to 652 px wide and 623 to 975 px on phones).
 * Re-measure when one of them changes its layout.
 */
export const lazyMdxInteractiveMeta: Partial<Record<LazyMdxInteractiveName, LazyMdxInteractiveMeta>> = {
  InterviewQuestionPlayground: { height: 594, mobileHeight: 839 },
  // Bug mode (8 of 13 instances) is the base; trace mode varies with its scenario and tab list.
  ObjectHandleVisualizer: {
    height: 731,
    mobileHeight: 878,
    variants: [
      { when: propIs("mode", "bug"), height: 731, mobileHeight: 878 },
      { when: (props) => listLength(props.scenarios) > 2, height: 1050, mobileHeight: 1369 },
      { when: (props) => listLength(props.scenarios) === 2, height: 1050, mobileHeight: 1325 },
      { when: propIs("scenario", "aliasing"), height: 900, mobileHeight: 1152 },
      { when: propIs("scenario", "static-count"), height: 1107, mobileHeight: 1367 },
      { when: propIs("scenario", "null-and-garbage"), height: 930, mobileHeight: 1210 },
    ],
  },
  // Every instance opens one section; "dispatch" is the taller one and the base value.
  PolymorphismDispatchVisualizer: {
    height: 1719,
    mobileHeight: 2482,
    variants: [{ when: propIs("section", "cast"), height: 990, mobileHeight: 1377 }],
  },
  ProceduralBlocksSimulator: { height: 951, mobileHeight: 1233 },
  AnimatedUvmSequenceDriverHandshakeDiagram: { height: 1228, mobileHeight: 2211 },
  OperatorExplorer: { height: 771, mobileHeight: 987 },
  SignednessVisualizer: { height: 900, mobileHeight: 1256 },
  ForkJoinVisualizer: { height: 1154, mobileHeight: 1510 },
  TimescaleLab: { height: 1082, mobileHeight: 1496 },
  TimeSlotTraceVisualizer: { height: 789, mobileHeight: 1032 },
  ScenarioSorter: { height: 506, mobileHeight: 814 },
  PackedLayoutExplorer: { height: 1096, mobileHeight: 1400 },
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
  height: number;
  mobileHeight: number;
}

/**
 * Title and reserved heights for one interactive instance. In order of
 * precedence: the instance's own `placeholderHeight` / `placeholderMobileHeight`
 * props, the first variant its props match, the interactive's measured height,
 * then the default. An MDX `title` prop wins over the derived title.
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
  return { title, height, mobileHeight };
}

/** The props to hand the interactive itself: everything except the placeholder's own height props. */
export function interactiveComponentProps<Props extends Record<string, unknown>>(props: Props): Props {
  if (!(PLACEHOLDER_HEIGHT_PROP in props) && !(PLACEHOLDER_MOBILE_HEIGHT_PROP in props)) return props;
  const { [PLACEHOLDER_HEIGHT_PROP]: _height, [PLACEHOLDER_MOBILE_HEIGHT_PROP]: _mobileHeight, ...rest } = props;
  return rest as Props;
}
