"use client";

import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react";

import type { LazyMdxInteractiveName } from "./lazy-mdx-interactives";

type MdxInteractiveProps = Record<string, unknown> & { children?: ReactNode };
type MdxInteractiveComponent = ComponentType<MdxInteractiveProps>;
type MdxInteractiveModule = { default: MdxInteractiveComponent };
type MdxInteractiveLoader = () => Promise<MdxInteractiveModule>;

const asMdxModule = (component: unknown): MdxInteractiveModule => ({
  default: component as MdxInteractiveComponent,
});

const loaders = {
  AnimatedUvmSequenceDriverHandshakeDiagram: () => import("@/components/diagrams/AnimatedUvmSequenceDriverHandshakeDiagram").then(module => asMdxModule(module.AnimatedUvmSequenceDriverHandshakeDiagram)),
  DataTypeComparisonChart: () => import("@/components/charts/DataTypeComparisonChart").then(module => asMdxModule(module.default)),
  UvmHierarchySunburstChart: () => import("@/components/charts/UvmHierarchySunburstChart").then(module => asMdxModule(module.default)),
  UvmPhasingDiagram: () => import("@/components/diagrams/UvmPhasingDiagram").then(module => asMdxModule(module.default)),
  AnimatedUvmTestbenchDiagram: () => import("@/components/diagrams/AnimatedUvmTestbenchDiagram").then(module => asMdxModule(module.default)),
  UvmVirtualSequencerDiagram: () => import("@/components/diagrams/UvmVirtualSequencerDiagram").then(module => asMdxModule(module.default)),
  UvmTestbenchVisualizer: () => import("@/components/diagrams/UvmTestbenchVisualizer").then(module => asMdxModule(module.default)),
  InteractiveUvmArchitectureDiagram: () => import("@/components/diagrams/InteractiveUvmArchitectureDiagram").then(module => asMdxModule(module.default)),
  UvmComponentRelationshipVisualizer: () => import("@/components/diagrams/UvmComponentRelationshipVisualizer").then(module => asMdxModule(module.default)),
  UvmPhasingInteractiveTimeline: () => import("@/components/diagrams/UvmPhasingInteractiveTimeline").then(module => asMdxModule(module.default)),
  UvmFactoryWorkflowVisualizer: () => import("@/components/diagrams/UvmFactoryWorkflowVisualizer").then(module => asMdxModule(module.default)),
  SystemVerilogDataTypesAnimation: () => import("@/components/animations/SystemVerilogDataTypesAnimation").then(module => asMdxModule(module.default)),
  CoverageAnalyzer: () => import("@/components/animations/CoverageAnalyzer").then(module => asMdxModule(module.default)),
  RandomizationExplorer: () => import("@/components/animations/RandomizationExplorer").then(module => asMdxModule(module.default)),
  InterfaceSignalFlow: () => import("@/components/animations/InterfaceSignalFlow").then(module => asMdxModule(module.default)),
  ProceduralBlocksSimulator: () => import("@/components/animations/ProceduralBlocksSimulator").then(module => asMdxModule(module.default)),
  AssertionBuilder: () => import("@/components/animations/AssertionBuilder").then(module => asMdxModule(module.default)),
  DebuggingSimulator: () => import("@/components/ui/DebuggingSimulator").then(module => asMdxModule(module.default)),
  InteractiveCode: () => import("@/components/ui/InteractiveCode").then(module => asMdxModule(module.InteractiveCode)),
  DataTypeExplorer: () => import("@/components/animations/DataTypeExplorer").then(module => asMdxModule(module.default)),
  CurriculumDataTypeExplorer: () => import("@/components/curriculum/f2/DataTypeExplorer").then(module => asMdxModule(module.default)),
  BlockingSimulator: () => import("@/components/animations/BlockingSimulator").then(module => asMdxModule(module.default)),
  InteractiveCostOfBugGraph: () => import("@/components/curriculum/f1/InteractiveCostOfBugGraph").then(module => asMdxModule(module.default)),
  HallOfShameCarousel: () => import("@/components/curriculum/f1/HallOfShameCarousel").then(module => asMdxModule(module.default)),
  VerificationMethodologiesDiagram: () => import("@/components/curriculum/f1/VerificationMethodologiesDiagram").then(module => asMdxModule(module.default)),
  FirstBugHuntGame: () => import("@/components/curriculum/f1/FirstBugHuntGame").then(module => asMdxModule(module.default)),
  CurriculumDataTypeQuiz: () => import("@/components/curriculum/f2/CurriculumDataTypeQuiz").then(module => asMdxModule(module.default)),
  DynamicStructureVisualizer: () => import("@/components/curriculum/f2/DynamicStructureVisualizer").then(module => asMdxModule(module.default)),
  QueueOperationLab: () => import("@/components/curriculum/f2/QueueOperationLab").then(module => asMdxModule(module.default)),
  ConfigDbExplorer: () => import("@/components/curriculum/interactives/ConfigDbExplorer").then(module => asMdxModule(module.default)),
  PackedUnpackedPlayground: () => import("@/components/curriculum/f2/PackedUnpackedPlayground").then(module => asMdxModule(module.default)),
  OperatorDrill: () => import("@/components/curriculum/f2/OperatorDrill").then(module => asMdxModule(module.default)),
  PacketSorterGame: () => import("@/components/curriculum/f2/PacketSorterGame").then(module => asMdxModule(module.default)),
  SystemVerilog3DVisualizer: () => import("@/components/curriculum/f2/SystemVerilog3DVisualizer").then(module => asMdxModule(module.default)),
  VirtualSequencerExplorer: () => import("@/components/curriculum/interactives/VirtualSequencerExplorer").then(module => asMdxModule(module.default)),
  TelemetryEventBusVisualizer: () => import("@/components/visuals/TelemetryEventBusVisualizer").then(module => asMdxModule(module.default)),
  FormalVsSimulationVisualizer: () => import("@/components/visuals/FormalVsSimulationVisualizer").then(module => asMdxModule(module.default)),
  ModportExplorer: () => import("@/components/visuals/ModportExplorer").then(module => asMdxModule(module.ModportExplorer)),
  EventRegionGame: () => import("@/components/visuals/EventRegionGame").then(module => asMdxModule(module.default)),
  SignednessVisualizer: () => import("@/components/visuals/SignednessVisualizer").then(module => asMdxModule(module.default)),
  DesignGapChart: () => import("@/components/visuals/DesignGapChart").then(module => asMdxModule(module.default)),
  LogicStateDiagram: () => import("@/components/visuals/LogicStateDiagram").then(module => asMdxModule(module.default)),
  StringMethodExplorer: () => import("@/components/visuals/StringMethodExplorer").then(module => asMdxModule(module.default)),
  EnumMethodVisualizer: () => import("@/components/visuals/EnumMethodVisualizer").then(module => asMdxModule(module.default)),
  OperatorVisualizer: () => import("@/components/visuals/OperatorVisualizer").then(module => asMdxModule(module.default)),
  ArrayMethodExplorer: () => import("@/components/visuals/ArrayMethodExplorer").then(module => asMdxModule(module.default)),
  MailboxSemaphoreGame: () => import("@/components/visuals/MailboxSemaphoreGame").then(module => asMdxModule(module.default)),
  VerilogVsSystemVerilog: () => import("@/components/visuals/VerilogVsSystemVerilog").then(module => asMdxModule(module.default)),
  Analysis3D: () => import("@/components/curriculum/interactives/3d/Analysis3D").then(module => asMdxModule(module.default)),
  Constraint3D: () => import("@/components/curriculum/interactives/3d/Constraint3D").then(module => asMdxModule(module.default)),
  ConstraintSolverExplorer: () => import("@/components/visuals/ConstraintSolverExplorer").then(module => asMdxModule(module.ConstraintSolverExplorer)),
  ConstraintSolverVisualizer: () => import("@/components/curriculum/interactives/ConstraintSolverVisualizer").then(module => asMdxModule(module.default)),
  Coverage3D: () => import("@/components/curriculum/interactives/3d/Coverage3D").then(module => asMdxModule(module.default)),
  CovergroupBuilder: () => import("@/components/visuals/CovergroupBuilder").then(module => asMdxModule(module.CovergroupBuilder)),
  DPIBoundaryInspector: () => import("@/components/visuals/DPIBoundaryInspector").then(module => asMdxModule(module.default)),
  Dataflow3D: () => import("@/components/curriculum/interactives/3d/Dataflow3D").then(module => asMdxModule(module.default)),
  EventSchedulerVisualizer: () => import("@/components/visualizers/EventSchedulerVisualizer").then(module => asMdxModule(module.SVEventScheduler)),
  FactoryOverrideVisualizer: () => import("@/components/curriculum/interactives/FactoryOverrideVisualizer").then(module => asMdxModule(module.default)),
  InterviewQuestionPlayground: () => import("@/components/curriculum/interactives/InterviewQuestionPlayground").then(module => asMdxModule(module.default)),
  Mailbox3D: () => import("@/components/curriculum/interactives/3d/Mailbox3D").then(module => asMdxModule(module.default)),
  PhaseTimeline3D: () => import("@/components/curriculum/interactives/3d/PhaseTimeline3D").then(module => asMdxModule(module.default)),
  RALHierarchy: () => import("@/components/visuals/RALHierarchy").then(module => asMdxModule(module.default)),
  RALPredictorVisualizer: () => import("@/components/visuals/RALPredictorVisualizer").then(module => asMdxModule(module.default)),
  TemporalLogicExplorer: () => import("@/components/curriculum/interactives/TemporalLogicExplorer").then(module => asMdxModule(module.default)),
  TLMPortConnector: () => import("@/components/curriculum/interactives/TLMPortConnector").then(module => asMdxModule(module.default)),
  UVMTreeExplorer: () => import("@/components/curriculum/interactives/UVMTreeExplorer").then(module => asMdxModule(module.default)),
  MethodologyPhaseVisualizer: () => import("@/components/visuals/MethodologyPhaseVisualizer").then(module => asMdxModule(module.default)),
  VIPReuseVisualizer: () => import("@/components/visuals/VIPReuseVisualizer").then(module => asMdxModule(module.default)),
  BindDirectiveVisualizer: () => import("@/components/visuals/BindDirectiveVisualizer").then(module => asMdxModule(module.default)),
  GenerateElaborationVisualizer: () => import("@/components/visuals/GenerateElaborationVisualizer").then(module => asMdxModule(module.default)),
  UvmPolicyVisualizer: () => import("@/components/visuals/UvmPolicyVisualizer").then(module => asMdxModule(module.default)),
  UvmContainerVisualizer: () => import("@/components/visuals/UvmContainerVisualizer").then(module => asMdxModule(module.default)),
  TransactionRecordingVisualizer: () => import("@/components/visuals/TransactionRecordingVisualizer").then(module => asMdxModule(module.default)),
  PowerDomainVisualizer: () => import("@/components/curriculum/interactives/visuals/PowerDomainVisualizer").then(module => asMdxModule(module.default)),
  SVSchedulerRegionVisualizer: () => import("@/components/visualizers/SVSchedulerRegionVisualizer").then(module => asMdxModule(module.SVSchedulerRegionVisualizer)),
  TlmConnectionBuilderVisualizer: () => import("@/components/visualizers/TlmConnectionBuilderVisualizer").then(module => asMdxModule(module.TlmConnectionBuilderVisualizer)),
  FactoryOverrideExplorerVisualizer: () => import("@/components/visualizers/FactoryOverrideExplorerVisualizer").then(module => asMdxModule(module.FactoryOverrideExplorerVisualizer)),
  ConstraintSolverHeatmapVisualizer: () => import("@/components/visualizers/ConstraintSolverHeatmapVisualizer").then(module => asMdxModule(module.ConstraintSolverHeatmapVisualizer)),
  SvaSequenceWaveformVisualizer: () => import("@/components/visualizers/SvaSequenceWaveformVisualizer").then(module => asMdxModule(module.SvaSequenceWaveformVisualizer)),
  CoverageCrossExplorerVisualizer: () => import("@/components/visualizers/CoverageCrossExplorerVisualizer").then(module => asMdxModule(module.CoverageCrossExplorerVisualizer)),
  RalRegisterMapVisualizer: () => import("@/components/visualizers/RalRegisterMapVisualizer").then(module => asMdxModule(module.RalRegisterMapVisualizer)),
  UvmPhaseTimelineVisualizer: () => import("@/components/visualizers/UvmPhaseTimelineVisualizer").then(module => asMdxModule(module.UvmPhaseTimelineVisualizer)),
  UvmSequenceHierarchyVisualizer: () => import("@/components/visualizers/UvmSequenceHierarchyVisualizer").then(module => asMdxModule(module.UvmSequenceHierarchyVisualizer)),
  PssIntentMapVisualizer: () => import("@/components/visualizers/PssIntentMapVisualizer").then(module => asMdxModule(module.PssIntentMapVisualizer)),
  ProtocolWaveform: () => import("@/components/mdx/ProtocolWaveform").then(module => asMdxModule(module.ProtocolWaveform)),
  AmbaFamilyExplorer: () => import("@/components/visualizers/AmbaFamilyExplorer").then(module => asMdxModule(module.AmbaFamilyExplorer)),
  ProtocolAnalogyExplorer: () => import("@/components/visualizers/ProtocolAnalogyExplorer").then(module => asMdxModule(module.ProtocolAnalogyExplorer)),
  AhbPipelineBurstVisualizer: () => import("@/components/visualizers/AhbPipelineBurstVisualizer").then(module => asMdxModule(module.default)),
  AxiChannelHandshakeVisualizer: () => import("@/components/visualizers/AxiChannelHandshakeVisualizer").then(module => asMdxModule(module.default)),
  AxiMemoryMathVisualizer: () => import("@/components/visualizers/AxiMemoryMathVisualizer").then(module => asMdxModule(module.default)),
  AxiIdOrderingVisualizer: () => import("@/components/visualizers/AxiIdOrderingVisualizer").then(module => asMdxModule(module.default)),
  ExclusiveAccessVisualizer: () => import("@/components/visualizers/ExclusiveAccessVisualizer").then(module => asMdxModule(module.default)),
  AxiDeadlockSimulator: () => import("@/components/visualizers/AxiDeadlockSimulator").then(module => asMdxModule(module.default)),
  BridgeTranslationExplorer: () => import("@/components/visualizers/BridgeTranslationExplorer").then(module => asMdxModule(module.default)),
} satisfies Record<LazyMdxInteractiveName, MdxInteractiveLoader>;

const componentCache = new Map<
  LazyMdxInteractiveName,
  LazyExoticComponent<MdxInteractiveComponent>
>();

function getLazyComponent(name: LazyMdxInteractiveName) {
  const cached = componentCache.get(name);
  if (cached) return cached;

  const component = lazy(loaders[name]);
  componentCache.set(name, component);
  return component;
}

function LoadingVisualization() {
  return (
    <div
      className="flex h-48 items-center justify-center"
      role="status"
      aria-live="polite"
    >
      Loading interactive…
    </div>
  );
}

export function LazyMdxInteractive({
  name,
  ...props
}: MdxInteractiveProps & { name: LazyMdxInteractiveName }) {
  const Component = getLazyComponent(name);

  return (
    <Suspense fallback={<LoadingVisualization />}>
      <Component {...props} />
    </Suspense>
  );
}
