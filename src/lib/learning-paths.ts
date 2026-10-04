/**
 * Learner routes through the curriculum: Junior ("Start here"), Practitioner
 * ("Working DV engineer") and Expert ("Jump in").
 *
 * The routes follow G30's "Routes" section (docs/curriculum-quality/analysis/
 * G30.md; the spine has no learning-path section yet), with the verifier's
 * fix G30-PATH-V10: the Junior route takes I-UVM-4 (policy classes: compare
 * and copy) before A-UVM-6, whose scoreboards rely on it.
 *
 * Every step names manifest module folders, so routes follow
 * content/curriculum/curriculum.manifest.json. `validateRoutes` checks a route
 * against the manifest: modules and lessons exist, steps follow manifest
 * order, every prerequisite is earlier on the route, listed for review or
 * assumed, milestones are fed by the step's modules, and labs are available.
 * tests/lib/learning-paths.test.ts runs it on every route.
 *
 * Resolution takes the generated curriculum data and the lab registry as
 * arguments, so this module never bundles them itself. Client components
 * import only types from here; the chosen route and the position on a route
 * live in src/lib/learning-route-state.ts.
 */

import type { Module as CurriculumTier } from '@/lib/curriculum-data';
import { cleanLessonTitle, lessonHref, lessonKey, moduleCode } from '@/lib/curriculum-overview';
import { isRouteId, type RouteId } from '@/lib/learning-route-state';

export { isRouteId };
export type { RouteId };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MilestoneId = 'M0' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8';

export interface Milestone {
  id: MilestoneId;
  name: string;
  /** The lab that practises the milestone, when one exists (it may still be coming soon). */
  lab?: string;
}

/**
 * Practice linked from a route step. Labs are named by registry id and take
 * their title from the lab registry; "lesson" items are activities inside a
 * lesson; everything else is a site route.
 */
export type RoutePracticeItem =
  | { kind: 'lab'; labId: string }
  | { kind: 'lesson'; module: string; lesson?: string; label: string }
  | { kind: 'exercise' | 'visualizer' | 'tool' | 'quiz' | 'index' | 'interview'; href: string; label: string };

export type PracticeKind = RoutePracticeItem['kind'];

/** Learner-facing name of each practice kind (shown as text, never as colour alone). */
export const PRACTICE_KIND_LABELS: Readonly<Record<PracticeKind, string>> = {
  lab: 'Lab',
  lesson: 'In the lesson',
  exercise: 'Exercise',
  visualizer: 'Interactive',
  tool: 'Tool',
  quiz: 'Quiz',
  index: 'Index',
  interview: 'Interview prep',
};

export interface RouteModuleRef {
  /** Manifest module id (the module folder name). */
  id: string;
  /** Lesson slugs to take, in manifest order. Omit to take every lesson. */
  lessons?: string[];
}

export interface RouteStep {
  id: string;
  title: string;
  /** One sentence: what the learner can do after this step. */
  summary: string;
  /** "review": skim only; "elective": optional. Defaults to "learn". */
  kind?: 'learn' | 'review' | 'elective';
  /** Modules to work through, in manifest order. */
  modules: RouteModuleRef[];
  /** Modules to skim before this step. They count as covered for later prerequisites. */
  review?: string[];
  practice: RoutePracticeItem[];
  /** Milestones this step builds (M0–M8); each must be fed by one of its modules. */
  milestones?: MilestoneId[];
}

export interface LearningRoute {
  id: RouteId;
  name: string;
  tagline: string;
  audience: string;
  /** Which depth layers of each lesson the route asks for. */
  layers: string;
  /** Plain-language version of `assumes`, shown with the route. */
  assumesSummary?: string;
  /** Modules the route treats as already known. */
  assumes: { modules?: string[]; coreOfTiers?: string[] };
  /** Primary call to action. Without an href it opens the route's first lesson. */
  cta: { label: string; href?: string };
  steps: RouteStep[];
}

// ---------------------------------------------------------------------------
// Milestones (docs/audit/2026-10-03-learning-outcomes/tb-mastery-progression.md)
// ---------------------------------------------------------------------------

export const MILESTONES: readonly Milestone[] = [
  { id: 'M0', name: 'Self-checking directed testbench', lab: 'simple-dut-1' },
  { id: 'M1', name: 'Race-aware interface testbench with clocking blocks', lab: 'constructs-1' },
  { id: 'M2', name: 'Reusable UVM agent, active and passive', lab: 'uvm-mini-capstone' },
  { id: 'M3', name: 'Reference-model scoreboard with end-of-test accounting', lab: 'scoreboard-reference-model' },
  { id: 'M4', name: 'Coverage-driven environment with a closure loop', lab: 'coverage-advanced-1' },
  { id: 'M5', name: 'Multi-agent environment with virtual sequences' },
  { id: 'M6', name: 'Out-of-order, ID-aware protocol verification', lab: 'axi-scoreboard-lab' },
  { id: 'M7', name: 'RAL-integrated environment with a predictor', lab: 'ral-mirror-bug' },
  { id: 'M8', name: 'Subsystem or SoC capstone: reset, errors, concurrency, closure', lab: 'soc-strategy-capstone' },
];

const milestoneById = new Map(MILESTONES.map((m) => [m.id, m]));

export function milestoneName(id: string): string {
  return milestoneById.get(id as MilestoneId)?.name ?? id;
}

// ---------------------------------------------------------------------------
// Practice item shorthands
// ---------------------------------------------------------------------------

const lab = (labId: string): RoutePracticeItem => ({ kind: 'lab', labId });
const interactive = (href: string, label: string): RoutePracticeItem => ({ kind: 'visualizer', href, label });
const exercise = (href: string, label: string): RoutePracticeItem => ({ kind: 'exercise', href, label });
const inLesson = (module: string, label: string, lesson?: string): RoutePracticeItem => ({
  kind: 'lesson',
  module,
  lesson,
  label,
});

export const EXPERT_INDEX_HREF = '/curriculum/expert-index';
export const PLACEMENT_QUIZ_HREF = '/quiz/placement';
export const INTERVIEW_PREP_HREF = '/interview-prep';

// ---------------------------------------------------------------------------
// The routes
// ---------------------------------------------------------------------------

export const LEARNING_ROUTES: readonly LearningRoute[] = [
  {
    id: 'junior',
    name: 'Junior',
    tagline: 'Start here',
    audience:
      'New to verification or to SystemVerilog. Digital logic and one programming language help; no HDL or verification background is assumed.',
    layers: 'Core layers first: Quick Take and Build Your Mental Model. Push Further is optional on this route.',
    assumes: {},
    cta: { label: 'Start here' },
    steps: [
      {
        id: 'why-verify',
        title: 'Why verification',
        summary: 'Explain why verification exists, how a verification engineer thinks, and why SystemVerilog is the language for it.',
        modules: [{ id: 'F1A_The_Cost_of_Bugs' }, { id: 'F1B_The_Verification_Mindset' }, { id: 'F1C_Why_SystemVerilog' }],
        practice: [inLesson('F1B_The_Verification_Mindset', 'First bug-hunt game (in F1B)')],
      },
      {
        id: 'language',
        title: 'The language',
        summary:
          'Declare SystemVerilog data correctly, write procedural code with tasks, functions and threads that behaves predictably, and assemble your first self-checking testbench.',
        modules: [
          { id: 'F2A_Core_Data_Types' },
          { id: 'F2B_Dynamic_Structures' },
          { id: 'F2C_Procedural_Code_and_Flow_Control' },
          { id: 'F2D_Reusable_Code_and_Parallelism' },
          { id: 'F2E_First_Self_Checking_Testbench' },
        ],
        practice: [
          lab('basics-1'),
          interactive('/practice/visualizations/systemverilog-data-types', 'SystemVerilog Data Types'),
          interactive('/visualizations/systemverilog-3d', 'SystemVerilog Array Sandbox'),
          interactive('/practice/visualizations/procedural-blocks', 'Procedural Blocks Simulator'),
          interactive('/practice/visualizations/concurrency', 'Fork/Join Lab'),
        ],
        milestones: ['M0'],
      },
      {
        id: 'time-and-races',
        title: 'Time, races and interfaces',
        summary:
          'Predict what happens inside one time slot, find and fix races, and drive a DUT race-free through interfaces and clocking blocks.',
        modules: [
          { id: 'F3A_Simulation_Semantics' },
          { id: 'F3B_Scheduling_Regions' },
          { id: 'F3C_Delta_Cycles_and_Race_Conditions' },
          { id: 'F4A_Modules_and_Packages' },
          { id: 'F4B_Interfaces_and_Modports' },
          { id: 'F4C_Clocking_Blocks' },
        ],
        practice: [
          inLesson('F3C_Delta_Cycles_and_Race_Conditions', 'Race debug challenge (in F3C)'),
          interactive('/practice/visualizations/interface-signal-flow', 'Interface Signal Flow'),
        ],
        milestones: ['M1'],
      },
      {
        id: 'class-based-tb',
        title: 'A class-based testbench',
        summary:
          'Write transaction classes with correct copy semantics, constrained-random stimulus, functional coverage, assertions, and threads that synchronize through events, mailboxes and semaphores.',
        modules: [
          { id: 'I-SV-1_OOP' },
          { id: 'I-SV-2A_Constrained_Randomization_Fundamentals' },
          { id: 'I-SV-3A_Functional_Coverage_Fundamentals' },
          { id: 'I-SV-4A_SVA_Fundamentals' },
          { id: 'I-SV-5_Synchronization_and_IPC' },
        ],
        practice: [
          interactive('/practice/visualizations/randomization-explorer', 'Constraint Solution Space'),
          interactive('/practice/visualizations/coverage-analyzer', 'Coverage Closure Lab'),
          interactive('/practice/visualizations/assertion-builder', 'SVA Trace Lab'),
          lab('ipc-deadlock'),
        ],
      },
      {
        id: 'first-uvm-tb',
        title: 'Your first UVM testbench',
        summary:
          'Build, configure and run a single-agent UVM environment: objects and components, the factory, phases, TLM, the configuration database and sequences.',
        modules: [
          { id: 'I-SV-6_Compiler_Directives_and_Generates' },
          { id: 'I-SV-9_Why_UVM' },
          { id: 'I-UVM-1A_Components' },
          { id: 'I-UVM-1B_The_UVM_Factory' },
          { id: 'I-UVM-1C_UVM_Phasing' },
          { id: 'I-UVM-2A_Component_Roles' },
          { id: 'I-UVM-2B_TLM_Connections' },
          { id: 'I-UVM-2C_Configuration_and_Resources' },
          { id: 'I-UVM-3A_Fundamentals' },
        ],
        practice: [
          interactive('/practice/visualizations/uvm-architecture', 'Interactive UVM Architecture'),
          exercise('/exercises/uvm-phase-sorter', 'UVM Phase Sorter'),
          exercise('/exercises/uvm-agent-builder', 'UVM Agent Builder'),
          exercise('/exercises/scoreboard-connector', 'Scoreboard Connector'),
          lab('config-debug'),
          lab('scoreboard-decoupling'),
        ],
        milestones: ['M2'],
      },
      {
        // G30-PATH-V10: A-UVM-6 relies on compare()/do_compare() semantics that
        // only I-UVM-4 teaches, so the policy classes come first on this route.
        id: 'self-checking',
        title: 'A self-checking UVM environment',
        summary:
          'Compare and copy transactions with the UVM policy classes, then build a reference-model scoreboard that accounts for every item at the end of the test.',
        modules: [{ id: 'I-UVM-4_UVM_Policy_Classes' }, { id: 'A-UVM-6_Scoreboards_and_Reference_Models' }],
        practice: [lab('scoreboard-reference-model'), lab('uvm-mini-capstone')],
        milestones: ['M3'],
      },
    ],
  },
  {
    id: 'practitioner',
    name: 'Practitioner',
    tagline: 'Working DV engineer',
    audience: 'You already write SystemVerilog testbenches or basic UVM and want the depth that daily verification work needs.',
    layers: 'Core and practitioner layers: Build Your Mental Model and Make It Work in full.',
    assumesSummary:
      'Assumes the Junior route up to your first UVM testbench, or the same experience from work. Not sure? Take the placement quiz.',
    assumes: {
      modules: [
        'F1A_The_Cost_of_Bugs',
        'F1B_The_Verification_Mindset',
        'F1C_Why_SystemVerilog',
        'F2A_Core_Data_Types',
        'F2B_Dynamic_Structures',
        'F2C_Procedural_Code_and_Flow_Control',
        'F2D_Reusable_Code_and_Parallelism',
        'F2E_First_Self_Checking_Testbench',
        'I-SV-1_OOP',
        'I-SV-2A_Constrained_Randomization_Fundamentals',
        'I-SV-3A_Functional_Coverage_Fundamentals',
        'I-SV-4A_SVA_Fundamentals',
        'I-SV-5_Synchronization_and_IPC',
        'I-SV-6_Compiler_Directives_and_Generates',
        'I-SV-9_Why_UVM',
        'I-UVM-1A_Components',
        'I-UVM-1B_The_UVM_Factory',
        'I-UVM-1C_UVM_Phasing',
        'I-UVM-2A_Component_Roles',
        'I-UVM-2B_TLM_Connections',
        'I-UVM-2C_Configuration_and_Resources',
        'I-UVM-3A_Fundamentals',
      ],
    },
    cta: { label: 'Find your level', href: PLACEMENT_QUIZ_HREF },
    steps: [
      {
        id: 'check-level',
        title: 'Check your level',
        kind: 'review',
        summary:
          'Take the placement quiz, then skim the scheduling, race and clocking-block lessons that trip up working engineers.',
        modules: [],
        review: [
          'F3A_Simulation_Semantics',
          'F3B_Scheduling_Regions',
          'F3C_Delta_Cycles_and_Race_Conditions',
          'F4A_Modules_and_Packages',
          'F4B_Interfaces_and_Modports',
          'F4C_Clocking_Blocks',
        ],
        practice: [
          { kind: 'quiz', href: PLACEMENT_QUIZ_HREF, label: 'Placement quiz' },
          interactive('/practice/visualizations/interface-signal-flow', 'Interface Signal Flow'),
        ],
      },
      {
        id: 'deeper-sv',
        title: 'SystemVerilog deep dives',
        summary:
          'Steer and debug the constraint solver, close coverage against a plan, write temporal properties with local variables and several clocks, bind checkers, and call C models through DPI.',
        modules: [
          { id: 'I-SV-2B_Advanced_Constrained_Randomization' },
          { id: 'I-SV-3B_Advanced_Functional_Coverage' },
          { id: 'I-SV-4B_Advanced_Temporal_Logic' },
          { id: 'I-SV-4C_Checkers' },
          { id: 'I-SV-7_DPI_and_Foreign_Language_Interfaces' },
        ],
        practice: [
          lab('randomization-advanced-1'),
          lab('coverage-advanced-1'),
          interactive('/practice/visualizations/randomization-explorer', 'Constraint Solution Space'),
          interactive('/practice/visualizations/coverage-analyzer', 'Coverage Closure Lab'),
          interactive('/practice/visualizations/assertion-builder', 'SVA Trace Lab'),
        ],
        milestones: ['M4'],
      },
      {
        id: 'deeper-uvm',
        title: 'UVM deep dives',
        summary:
          'Coordinate stimulus with virtual and layered sequences, arbitration and interrupts, and use the UVM policy, container and recording classes.',
        modules: [
          { id: 'I-UVM-3B_Advanced_Sequencing_and_Layering' },
          { id: 'I-UVM-4_UVM_Policy_Classes' },
          { id: 'I-UVM-5_UVM_Container_Classes' },
          { id: 'I-UVM-6_UVM_Recording_Classes' },
        ],
        practice: [exercise('/exercises/sequencer-arbitration', 'Sequencer Arbitration Sandbox')],
      },
      {
        id: 'environments',
        title: 'Scoreboards, VIP and multi-agent environments',
        summary:
          'Build a reference-model scoreboard, package a reusable VIP agent, extend it with callbacks, and coordinate several agents with virtual sequences.',
        modules: [
          { id: 'A-UVM-6_Scoreboards_and_Reference_Models' },
          { id: 'A-UVM-7_VIP_Construction' },
          { id: 'A-UVM-5_UVM_Callbacks' },
          { id: 'A-UVM-8_Multi_Agent_Topologies' },
        ],
        practice: [
          lab('scoreboard-reference-model'),
          lab('uvm-mini-capstone'),
          lab('callbacks-driver-behavior'),
          exercise('/exercises/scoreboard-connector', 'Scoreboard Connector'),
        ],
        milestones: ['M2', 'M3', 'M5'],
      },
      {
        id: 'ral',
        title: 'Register models',
        summary:
          'Model registers with RAL, keep the mirror in step with explicit prediction, and choose frontdoor or backdoor access.',
        modules: [{ id: 'A-UVM-4A_RAL_Fundamentals' }, { id: 'A-UVM-4B_Advanced_RAL_Techniques' }],
        practice: [lab('ral-mirror-bug')],
        milestones: ['M7'],
      },
      {
        id: 'amba',
        title: 'AMBA protocols',
        summary:
          'Turn AHB and AXI rules into protocol checkers, coverage and an ID-aware out-of-order scoreboard, then debug a bridge between them.',
        modules: [
          { id: 'B-AMBA-1_Protocol_Families_and_Tradeoffs' },
          { id: 'B-AMBA-2_Protocol_Intuition_and_Memory_Hooks' },
          { id: 'B-AHB-1_AHB_Design_Timing_Mechanics' },
          { id: 'B-AHB-2_AHB_Pitfalls_and_Deadlocks' },
          { id: 'B-AHB-3_AHB_Verification' },
          { id: 'B-AXI-1_AXI_Channel_Architecture' },
          { id: 'B-AXI-2_AXI_Burst_Math' },
          { id: 'B-AXI-3_AXI_Ordering_and_IDs' },
          { id: 'B-AXI-4_AXI_Expert_Features_Cache_Atomics' },
          { id: 'B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks' },
          { id: 'B-AXI-6_AXI_Verification_Performance' },
          { id: 'B-AMBA-F1_Bridges_and_System_Integration' },
          { id: 'B-AMBA-F2_Future_Protocols_ACE_CHI' },
          { id: 'B-AMBA-F3_Interview_Debug_Clinic' },
        ],
        practice: [
          { kind: 'tool', href: '/practice/waveform-studio', label: 'Waveform Studio' },
          lab('ahb-checker-lab'),
          lab('axi-deadlock-hunt-lab'),
          lab('axi-scoreboard-lab'),
          lab('ahb-axi-bridge-debug'),
        ],
        milestones: ['M6'],
      },
    ],
  },
  {
    id: 'expert',
    name: 'Expert',
    tagline: 'Jump in',
    audience: 'Senior and staff engineers, and candidates preparing for staff-level interviews.',
    layers: 'Expert layers: every Push Further section and Expert topic, plus Tier 4.',
    assumesSummary:
      'Assumes Tiers 1 to 3: you can build and debug a multi-agent UVM environment. Each lesson links what it builds on, so gaps are one click away.',
    assumes: { coreOfTiers: ['T1_Foundational', 'T2_Intermediate', 'T3_Advanced'] },
    cta: { label: 'Expert layers', href: EXPERT_INDEX_HREF },
    steps: [
      {
        id: 'debug-methodology',
        title: 'Debug at scale and methodology',
        summary: 'Triage failures at scale, customize UVM for a team, and measure and fix simulation performance.',
        modules: [
          { id: 'E-DBG-1_Advanced_UVM_Debug_Methodologies' },
          { id: 'E-CUST-1_UVM_Methodology_Customization' },
          { id: 'E-PERF-1_UVM_Performance' },
        ],
        practice: [lab('debug-waveform-trigger'), lab('methodology-custom-phase')],
      },
      {
        id: 'formal-pss-power',
        title: 'Formal, portable stimulus and power',
        summary:
          'Combine formal and simulation, write portable test intent with PSS, and verify power intent in a UVM environment.',
        modules: [
          { id: 'E-INT-1_Integrating_UVM_with_Formal_Verification' },
          { id: 'E-PSS-1_Portable_Stimulus_Standard' },
          { id: 'E-PWR-1_Power_Aware_Verification' },
        ],
        review: ['I-SV-8_Power_Intent_and_UPF'],
        practice: [lab('formal-harness'), lab('pss-portable-intent'), lab('power-aware-retention')],
      },
      {
        id: 'soc-capstone',
        title: 'SoC capstone',
        summary: 'Write and defend a subsystem or SoC verification strategy, and reuse block-level VIP at SoC level.',
        modules: [{ id: 'E-SOC-1_SoC-Level_Verification_Strategies' }],
        practice: [lab('soc-vip-reuse'), lab('soc-strategy-capstone')],
        milestones: ['M8'],
      },
      {
        id: 'interview',
        title: 'Interview preparation',
        summary:
          'Rehearse staff-level questions: the interview banks, the AMBA interview and debug clinic, and the expert topics in every lesson.',
        modules: [],
        practice: [
          { kind: 'interview', href: INTERVIEW_PREP_HREF, label: 'Interview question banks' },
          inLesson('B-AMBA-F3_Interview_Debug_Clinic', 'AMBA Interview & Debug Clinic'),
          { kind: 'index', href: EXPERT_INDEX_HREF, label: 'Expert index' },
        ],
      },
      {
        id: 'electives',
        title: 'Electives: the wider ecosystem',
        kind: 'elective',
        summary:
          'Pick what your team needs: emulation, Python with cocotb and pyuvm, multi-language environments, RISC-V and AI-assisted verification.',
        modules: [
          { id: 'E-EMU-1_Emulation_Aware_Verification' },
          { id: 'E-PYUVM-1_Python_Based_Verification' },
          { id: 'E-UVM-ML-1_Multi_Language_Verification' },
          { id: 'E-RISCV-1_RISC_V_Verification_Methodology' },
          { id: 'E-AI-1_AI_Driven_Verification' },
        ],
        practice: [],
      },
    ],
  },
];

export function getRoute(id: RouteId): LearningRoute {
  const route = LEARNING_ROUTES.find((r) => r.id === id);
  if (!route) throw new Error(`Unknown learning route ${id}`);
  return route;
}

// ---------------------------------------------------------------------------
// Validation against the manifest
// ---------------------------------------------------------------------------

export interface ManifestModuleLike {
  id: string;
  track: 'core' | 'elective';
  lessons: string[];
  prerequisites: string[];
  milestones: string[];
}

export interface ManifestLike {
  tiers: { id: string; title?: string; audience?: string; modules: ManifestModuleLike[] }[];
}

export interface LabLike {
  id: string;
  title: string;
  status: string;
}

export interface RouteValidationOptions {
  /** The lab registry. When given, every route lab must exist and be available. */
  labs?: readonly LabLike[];
  /** When given, every site href (exercises, interactives, tools, indexes) must resolve. */
  hrefExists?: (href: string) => boolean;
}

/** Module ids a route treats as known: its `assumes` list plus the core modules of `coreOfTiers`. */
export function assumedModuleIds(route: LearningRoute, manifest: ManifestLike): string[] {
  const ids = [...(route.assumes.modules ?? [])];
  for (const tierId of route.assumes.coreOfTiers ?? []) {
    const tier = manifest.tiers.find((t) => t.id === tierId);
    for (const m of tier?.modules ?? []) if (m.track === 'core') ids.push(m.id);
  }
  return ids;
}

/**
 * Checks routes against the manifest and returns one message per problem.
 * An empty array means every route is valid.
 */
export function validateRoutes(
  manifest: ManifestLike,
  routes: readonly LearningRoute[] = LEARNING_ROUTES,
  options: RouteValidationOptions = {},
): string[] {
  const problems: string[] = [];
  const modules = manifest.tiers.flatMap((t) => t.modules);
  const byId = new Map(modules.map((m) => [m.id, m]));
  const position = new Map(modules.map((m, i) => [m.id, i]));
  const tierIds = new Set(manifest.tiers.map((t) => t.id));
  const labsById = options.labs ? new Map(options.labs.map((l) => [l.id, l])) : null;

  const routeIds = new Set<string>();
  for (const route of routes) {
    if (routeIds.has(route.id)) problems.push(`route ${route.id} is defined twice`);
    routeIds.add(route.id);

    for (const tierId of route.assumes.coreOfTiers ?? []) {
      if (!tierIds.has(tierId)) problems.push(`${route.id}: assumes unknown tier ${tierId}`);
    }
    for (const id of route.assumes.modules ?? []) {
      if (!byId.has(id)) problems.push(`${route.id}: assumes unknown module ${id}`);
    }
    if (route.cta.href && options.hrefExists && !options.hrefExists(route.cta.href)) {
      problems.push(`${route.id}: call to action ${route.cta.href} does not resolve`);
    }

    const covered = new Set(assumedModuleIds(route, manifest));
    const onRoute = new Set<string>();
    const stepIds = new Set<string>();
    let lastPosition = -1;
    let workModules = 0;

    for (const step of route.steps) {
      const where = `${route.id}/${step.id}`;
      if (stepIds.has(step.id)) problems.push(`${where}: step id is used twice`);
      stepIds.add(step.id);

      for (const id of step.review ?? []) {
        if (!byId.has(id)) problems.push(`${where}: review module ${id} is not in the manifest`);
        else covered.add(id);
      }

      for (const ref of step.modules) {
        const mod = byId.get(ref.id);
        if (!mod) {
          problems.push(`${where}: module ${ref.id} is not in the manifest`);
          continue;
        }
        workModules += 1;
        if (onRoute.has(ref.id)) problems.push(`${where}: module ${ref.id} appears twice on the route`);
        onRoute.add(ref.id);

        const pos = position.get(ref.id)!;
        if (pos < lastPosition) problems.push(`${where}: module ${ref.id} is out of manifest order on the route`);
        lastPosition = Math.max(lastPosition, pos);

        if (ref.lessons) {
          if (ref.lessons.length === 0) problems.push(`${where}: module ${ref.id} lists no lessons`);
          let lastLesson = -1;
          for (const lesson of ref.lessons) {
            const idx = mod.lessons.indexOf(lesson);
            if (idx < 0) problems.push(`${where}: lesson ${ref.id}/${lesson} is not in the manifest`);
            else if (idx < lastLesson) problems.push(`${where}: lesson ${ref.id}/${lesson} is out of manifest order`);
            lastLesson = Math.max(lastLesson, idx);
          }
        }

        for (const prerequisite of mod.prerequisites) {
          if (!covered.has(prerequisite)) {
            problems.push(
              `${where}: ${ref.id} needs ${prerequisite}, which is neither earlier on the route, listed for review, nor assumed`,
            );
          }
        }
        covered.add(ref.id);
      }

      for (const ms of step.milestones ?? []) {
        if (!milestoneById.has(ms)) problems.push(`${where}: unknown milestone ${ms}`);
        const fed = step.modules.some((ref) => byId.get(ref.id)?.milestones.includes(ms));
        if (!fed) problems.push(`${where}: milestone ${ms} is not fed by any of the step's modules`);
      }

      for (const item of step.practice) {
        if (item.kind === 'lesson') {
          const mod = byId.get(item.module);
          if (!mod) problems.push(`${where}: practice "${item.label}" points to unknown module ${item.module}`);
          else if (item.lesson && !mod.lessons.includes(item.lesson)) {
            problems.push(`${where}: practice "${item.label}" points to unknown lesson ${item.module}/${item.lesson}`);
          }
        } else if (item.kind === 'lab') {
          if (!/^[a-z0-9-]+$/.test(item.labId)) problems.push(`${where}: lab id "${item.labId}" is malformed`);
          const registered = labsById?.get(item.labId);
          if (labsById && !registered) problems.push(`${where}: lab ${item.labId} is not in the lab registry`);
          else if (registered && registered.status !== 'available') {
            problems.push(`${where}: lab ${item.labId} is ${registered.status}, so it cannot be linked`);
          }
        } else if (!item.href.startsWith('/')) {
          problems.push(`${where}: practice "${item.label}" has a non-site href ${item.href}`);
        } else if (options.hrefExists && !options.hrefExists(item.href)) {
          problems.push(`${where}: practice "${item.label}" links ${item.href}, which does not resolve`);
        }
      }

      if (step.modules.length === 0 && step.practice.length === 0 && (step.review ?? []).length === 0) {
        problems.push(`${where}: step has nothing to do`);
      }
    }

    if (workModules === 0) problems.push(`${route.id}: route has no modules to work through`);
  }

  for (const milestone of MILESTONES) {
    if (milestone.lab && labsById && !labsById.has(milestone.lab)) {
      problems.push(`milestone ${milestone.id}: lab ${milestone.lab} is not in the lab registry`);
    }
  }

  return problems;
}

// ---------------------------------------------------------------------------
// Resolution against the generated curriculum data
// ---------------------------------------------------------------------------

export interface ResolvedModuleRef {
  id: string;
  code: string;
  title: string;
  href: string;
  lessonCount: number;
}

export interface ResolvedPracticeItem {
  kind: PracticeKind;
  /** Learner-facing kind ("Lab", "Exercise", …). */
  kindLabel: string;
  label: string;
  /** Absent when the item cannot be opened yet: render it as text, never as a link. */
  href?: string;
  note?: string;
}

export interface ResolvedLesson {
  /** "<ModuleFolder>/<lesson>". */
  key: string;
  href: string;
  title: string;
  moduleId: string;
  moduleCode: string;
  lessonSlug: string;
  /** Zero-based index of the step that contains the lesson. */
  stepIndex: number;
}

export interface ResolvedMilestone {
  id: MilestoneId;
  name: string;
  /** The practice lab for the milestone; `href` is absent while the lab is coming soon. */
  lab?: { id: string; title: string; href?: string };
  /** Routes with a step that builds this milestone. */
  routes: RouteId[];
}

export interface ResolvedStep {
  id: string;
  number: number;
  title: string;
  summary: string;
  kind: 'learn' | 'review' | 'elective';
  modules: ResolvedModuleRef[];
  review: ResolvedModuleRef[];
  practice: ResolvedPracticeItem[];
  milestones: { id: MilestoneId; name: string }[];
}

export interface ResolvedRoute {
  id: RouteId;
  name: string;
  tagline: string;
  audience: string;
  layers: string;
  assumesSummary?: string;
  cta: { label: string; href: string };
  steps: ResolvedStep[];
  /** Every lesson to work through, in route order (review modules excluded). */
  sequence: ResolvedLesson[];
  milestones: { id: MilestoneId; name: string }[];
  /** Core modules between the route's first and last module that the route leaves for later. */
  skipped: ResolvedModuleRef[];
}

export interface RouteResolutionOptions {
  routes?: readonly LearningRoute[];
  /** The lab registry: lab titles come from here, and labs that are not available are not linked. */
  labs?: readonly LabLike[];
}

interface DataModule {
  tierId: string;
  section: CurriculumTier['sections'][number];
  position: number;
}

function indexCurriculum(data: readonly CurriculumTier[]): Map<string, DataModule> {
  const map = new Map<string, DataModule>();
  let position = 0;
  for (const tier of data) {
    for (const section of tier.sections) {
      map.set(section.slug, { tierId: tier.slug, section, position: position++ });
    }
  }
  return map;
}

function moduleRef(entry: DataModule): ResolvedModuleRef {
  const first = entry.section.topics.find((t) => t.slug === 'index') ?? entry.section.topics[0];
  return {
    id: entry.section.slug,
    code: moduleCode(entry.section.slug),
    title: cleanLessonTitle(entry.section.title),
    href: lessonHref(entry.tierId, entry.section.slug, first?.slug ?? 'index'),
    lessonCount: entry.section.topics.length,
  };
}

function requireModule(index: Map<string, DataModule>, id: string, where: string): DataModule {
  const entry = index.get(id);
  if (!entry) throw new Error(`learning-paths: ${where} names module ${id}, which is not in the curriculum data`);
  return entry;
}

function labTitle(id: string, labs: readonly LabLike[] | undefined): string {
  return labs?.find((l) => l.id === id)?.title.replace(/\s+/g, ' ').trim() ?? id;
}

function resolveLab(id: string, labs: readonly LabLike[] | undefined): { title: string; href?: string } {
  const registered = labs?.find((l) => l.id === id);
  const available = labs ? registered?.status === 'available' : true;
  return { title: labTitle(id, labs), ...(available ? { href: `/practice/lab/${id}` } : {}) };
}

function resolvePractice(
  item: RoutePracticeItem,
  index: Map<string, DataModule>,
  labs: readonly LabLike[] | undefined,
  where: string,
): ResolvedPracticeItem {
  const kindLabel = PRACTICE_KIND_LABELS[item.kind];
  if (item.kind === 'lab') {
    const resolved = resolveLab(item.labId, labs);
    return {
      kind: 'lab',
      kindLabel,
      label: resolved.title,
      ...(resolved.href ? { href: resolved.href, note: 'sign-in required' } : { note: 'coming soon' }),
    };
  }
  if (item.kind === 'lesson') {
    const entry = requireModule(index, item.module, where);
    const lesson = item.lesson ?? (entry.section.topics.find((t) => t.slug === 'index') ?? entry.section.topics[0])?.slug;
    if (!lesson || !entry.section.topics.some((t) => t.slug === lesson)) {
      throw new Error(`learning-paths: ${where} names lesson ${item.module}/${item.lesson}, which does not exist`);
    }
    return { kind: 'lesson', kindLabel, label: item.label, href: lessonHref(entry.tierId, item.module, lesson) };
  }
  return { kind: item.kind, kindLabel, label: item.label, href: item.href };
}

/** The milestone ladder with practice labs and the routes that build each milestone. */
export function resolveMilestones(
  labs?: readonly LabLike[],
  routes: readonly LearningRoute[] = LEARNING_ROUTES,
): ResolvedMilestone[] {
  return MILESTONES.map((milestone) => ({
    id: milestone.id,
    name: milestone.name,
    ...(milestone.lab ? { lab: { id: milestone.lab, ...resolveLab(milestone.lab, labs) } } : {}),
    routes: routes.filter((r) => r.steps.some((s) => s.milestones?.includes(milestone.id))).map((r) => r.id),
  }));
}

/** Resolves every route to titles and canonical lesson URLs. Throws on a name that does not resolve. */
export function resolveRoutes(data: readonly CurriculumTier[], options: RouteResolutionOptions = {}): ResolvedRoute[] {
  const routes = options.routes ?? LEARNING_ROUTES;
  const index = indexCurriculum(data);

  return routes.map((route) => {
    const sequence: ResolvedLesson[] = [];
    const onRoute = new Set<string>();
    const reviewed = new Set<string>();

    const steps: ResolvedStep[] = route.steps.map((step, stepIndex) => {
      const where = `${route.id}/${step.id}`;
      const modules = step.modules.map((ref) => {
        const entry = requireModule(index, ref.id, where);
        onRoute.add(ref.id);
        const lessons = ref.lessons ?? entry.section.topics.map((t) => t.slug);
        for (const slug of lessons) {
          const topic = entry.section.topics.find((t) => t.slug === slug);
          if (!topic) throw new Error(`learning-paths: ${where} names lesson ${ref.id}/${slug}, which does not exist`);
          sequence.push({
            key: lessonKey(ref.id, slug),
            href: lessonHref(entry.tierId, ref.id, slug),
            title: cleanLessonTitle(topic.title),
            moduleId: ref.id,
            moduleCode: moduleCode(ref.id),
            lessonSlug: slug,
            stepIndex,
          });
        }
        return { ...moduleRef(entry), lessonCount: lessons.length };
      });
      const review = (step.review ?? []).map((id) => {
        reviewed.add(id);
        return moduleRef(requireModule(index, id, where));
      });
      return {
        id: step.id,
        number: stepIndex + 1,
        title: step.title,
        summary: step.summary,
        kind: step.kind ?? 'learn',
        modules,
        review,
        practice: step.practice.map((item) => resolvePractice(item, index, options.labs, where)),
        milestones: (step.milestones ?? []).map((id) => ({ id, name: milestoneName(id) })),
      };
    });

    const assumed = new Set(route.assumes.modules ?? []);
    for (const tier of data) {
      if ((route.assumes.coreOfTiers ?? []).includes(tier.slug)) {
        for (const s of tier.sections) if ((s.track ?? 'core') === 'core') assumed.add(s.slug);
      }
    }

    const positions = [...onRoute].map((id) => index.get(id)!.position);
    const first = Math.min(...positions);
    const last = Math.max(...positions);
    const skipped = [...index.values()]
      .filter(
        (entry) =>
          entry.position > first &&
          entry.position < last &&
          (entry.section.track ?? 'core') === 'core' &&
          !onRoute.has(entry.section.slug) &&
          !reviewed.has(entry.section.slug) &&
          !assumed.has(entry.section.slug),
      )
      .map(moduleRef);

    const milestoneIds = new Set(steps.flatMap((s) => s.milestones.map((m) => m.id)));
    const firstLesson = sequence[0];
    if (!firstLesson) throw new Error(`learning-paths: route ${route.id} has no lessons`);

    return {
      id: route.id,
      name: route.name,
      tagline: route.tagline,
      audience: route.audience,
      layers: route.layers,
      ...(route.assumesSummary ? { assumesSummary: route.assumesSummary } : {}),
      cta: { label: route.cta.label, href: route.cta.href ?? firstLesson.href },
      steps,
      sequence,
      milestones: MILESTONES.filter((m) => milestoneIds.has(m.id)).map(({ id, name }) => ({ id, name })),
      skipped,
    };
  });
}

// ---------------------------------------------------------------------------
// Placement: recommended tier -> route, starting lesson and skim list
// ---------------------------------------------------------------------------

export interface PlacementRouteTarget {
  tier: number;
  routeId: RouteId;
  /** The step the learner starts at. */
  startStepId: string;
  /** Steps whose modules to skim first, if any answer surprised the learner. */
  skimStepIds: string[];
}

export interface PlacementPlan {
  tier: number;
  routeId: RouteId;
  routeName: string;
  startHref: string;
  startTitle: string;
  startModuleCode: string;
  startStepNumber: number;
  startStepTitle: string;
  stepCount: number;
  skim: { code: string; title: string; href: string }[];
}

export function resolvePlacementPlan(target: PlacementRouteTarget, routes: readonly ResolvedRoute[]): PlacementPlan {
  const route = routes.find((r) => r.id === target.routeId);
  if (!route) throw new Error(`placement: unknown route ${target.routeId}`);
  const step = route.steps.find((s) => s.id === target.startStepId);
  if (!step) throw new Error(`placement: route ${route.id} has no step ${target.startStepId}`);
  const first = route.sequence.find((l) => l.stepIndex === step.number - 1);
  if (!first) throw new Error(`placement: step ${route.id}/${step.id} has no lessons to start at`);
  const skim = target.skimStepIds.flatMap((id) => {
    const s = route.steps.find((x) => x.id === id);
    if (!s) throw new Error(`placement: route ${route.id} has no step ${id}`);
    if (s.number >= step.number) throw new Error(`placement: skim step ${route.id}/${id} does not come before the start step`);
    return [...s.review, ...s.modules].map(({ code, title, href }) => ({ code, title, href }));
  });
  return {
    tier: target.tier,
    routeId: route.id,
    routeName: route.name,
    startHref: first.href,
    startTitle: first.title,
    startModuleCode: first.moduleCode,
    startStepNumber: step.number,
    startStepTitle: step.title,
    stepCount: route.steps.length,
    skim,
  };
}
