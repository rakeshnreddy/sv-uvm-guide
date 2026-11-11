/**
 * Practice linkage: the one map from every practice surface (exercises,
 * practice visualizations, tools, labs and interview questions) to the
 * lesson(s) that teach it.
 *
 * - Lessons are named by `<ModuleFolder>/<lesson>` (the folder names under
 *   content/curriculum/<Tier>/) and resolve to canonical lesson URLs through the
 *   generated curriculum, so order and tiers always follow
 *   content/curriculum/curriculum.manifest.json.
 * - The first lesson of an entry is the one that teaches the item ("Learn this
 *   in"); the others are related lessons that use or revisit it.
 * - Labs need no entry unless they live in a sub-lesson or in several lessons:
 *   by default a lab belongs to its registry `moduleHref`, or else to the index
 *   lesson of its registry `owningModule`.
 *
 * Server-side data: client components may import types from this file, but
 * never values (it pulls in the whole curriculum and lab registry).
 *
 * tests/lib/practice-links.test.ts checks that every target is a canonical
 * lesson URL, that every practice route and lab is mapped, and that every
 * practice page renders its back link.
 */
import { curriculumData } from '@/lib/curriculum-data';
import type { LabManifest } from '@/lib/lab-manifest';
import { getAllLabs, getLabById } from '@/lib/lab-registry';
import {
  FOOTER_NAV,
  PRACTICE_HREF,
  PRACTICE_SECTION_HREF,
  PRACTICE_SECTION_ID,
  PRIMARY_NAV,
  isNavGroup,
  type NavLink,
  type PracticeSection,
} from '@/lib/site-links';

/** `<ModuleFolder>/<lesson>`, for example `I-SV-2B_Advanced_Constrained_Randomization/solver-debug`. */
export type LessonRef = string;

export type PracticeKind = 'lab' | 'exercise' | 'interactive' | 'diagram' | 'chart' | 'tool' | 'interview';

/** Singular, learner-facing names for each kind (shown as text, never as colour alone). */
export const PRACTICE_KIND_LABELS: Readonly<Record<PracticeKind, string>> = {
  lab: 'Lab',
  exercise: 'Exercise',
  interactive: 'Interactive model',
  diagram: 'Diagram',
  chart: 'Chart',
  tool: 'Tool',
  interview: 'Interview bank',
};

/** A lesson resolved from the generated curriculum. Plain data: safe to pass to client components. */
export interface LessonLink {
  ref: LessonRef;
  /** Canonical URL: `/curriculum/<Tier>/<Module>/<lesson>`. */
  href: string;
  /** Module code, for example `I-SV-2B`. */
  code: string;
  moduleSlug: string;
  /** Module title without its code prefix. */
  moduleTitle: string;
  /** The lesson's own title (the module title for an index page), without legacy site suffixes. */
  title: string;
  isModuleIndex: boolean;
  /** `T1` … `T4`. */
  tier: string;
  tierTitle: string;
  track: 'core' | 'elective';
  /** Position in the manifest order, 0-based. */
  order: number;
}

export interface PracticeItem {
  /** Unique id, for example `exercise:uvm-agent-builder`, `lab:basics-1`, `interview:uvm`. */
  id: string;
  kind: PracticeKind;
  title: string;
  description: string;
  /** Route of the item. Undefined when the item cannot be opened yet (coming soon): render it as text. */
  href?: string;
  status: 'available' | 'coming_soon';
  /** Resolved lessons: the teaching lesson first, then the related ones in manifest order. */
  lessons: LessonLink[];
  /** Manifest position of the teaching lesson; items without a lesson sort last. */
  order: number;
}

export interface PracticePageDefinition {
  /** The page's route. Its page.tsx renders `<LearnInLesson item={requirePracticePage(href)} />`. */
  href: string;
  kind: Exclude<PracticeKind, 'lab' | 'interview'>;
  /** The page's H1 and the Practice Hub's link text. */
  title: string;
  /** One sentence on what the learner does there; shown on the hub card and in the page metadata. */
  description: string;
  /** Teaching lesson first, then related lessons. */
  lessons: readonly LessonRef[];
}

/** Every exercise, practice visualization and tool page. */
export const PRACTICE_PAGES: readonly PracticePageDefinition[] = [
  {
    href: '/exercises/uvm-phase-sorter',
    kind: 'exercise',
    title: 'UVM phase sorter',
    description:
      'Place each phase in its lane, with run_phase beside the twelve run-time phases, and mark each function phase top-down or bottom-up.',
    lessons: ['I-UVM-1C_UVM_Phasing/index'],
  },
  {
    href: '/exercises/uvm-agent-builder',
    kind: 'exercise',
    title: 'UVM agent builder',
    description:
      'Choose active or passive, then build the agent: sequencer, driver and monitor, or the monitor alone.',
    lessons: ['I-UVM-2A_Component_Roles/index', 'A-UVM-7_VIP_Construction/index'],
  },
  {
    href: '/exercises/scoreboard-connector',
    kind: 'exercise',
    title: 'Scoreboard connector',
    description:
      "Wire a monitor, predictor, scoreboard FIFOs and coverage in an env's connect_phase, graded by uvm-core's connection rules.",
    lessons: ['I-UVM-2B_TLM_Connections/index', 'A-UVM-6_Scoreboards_and_Reference_Models/index'],
  },
  {
    href: '/exercises/sequencer-arbitration',
    kind: 'exercise',
    title: 'Sequencer arbitration sandbox',
    description:
      'Predict which sequence the sequencer grants: arbitration modes, priorities, lock() and grab(), checked against a model of uvm-core 2020.3.1.',
    lessons: [
      'I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-arbitration',
      'I-UVM-3B_Advanced_Sequencing_and_Layering/index',
    ],
  },
  {
    href: '/practice/visualizations/systemverilog-data-types',
    kind: 'interactive',
    title: 'SystemVerilog data types',
    description:
      'Cycle 2-state and 4-state values, watch X and Z propagate, and run dynamic-array, queue and associative-array operations, including what new[N] really does.',
    lessons: ['F2A_Core_Data_Types/index', 'F2B_Dynamic_Structures/index'],
  },
  {
    href: '/visualizations/systemverilog-3d',
    kind: 'interactive',
    title: 'SystemVerilog array sandbox',
    description:
      'Run dynamic-array, queue and associative-array operations and see the resulting state in 3D or as text.',
    lessons: ['F2B_Dynamic_Structures/index'],
  },
  {
    href: '/practice/visualizations/procedural-blocks',
    kind: 'interactive',
    title: 'Procedural blocks simulator',
    description:
      'Predict when initial, always and final blocks run, and where <= updates land, on a tested process model.',
    lessons: ['F2C_Procedural_Code_and_Flow_Control/index'],
  },
  {
    href: '/practice/visualizations/concurrency',
    kind: 'interactive',
    title: 'Fork/join lab',
    description:
      'One lane per process for join, join_any, join_none, disable fork and wait fork. Predict when the parent resumes.',
    lessons: [
      'F2C_Procedural_Code_and_Flow_Control/index',
      'I-SV-5_Synchronization_and_IPC/index',
      'I-SV-5_Synchronization_and_IPC/events',
    ],
  },
  {
    href: '/practice/visualizations/state-machine-designer',
    kind: 'interactive',
    title: 'State machine designer',
    description:
      'Build a small finite state machine, choose its state encoding and reset style, and step through its transitions.',
    lessons: [
      'F2C_Procedural_Code_and_Flow_Control/index',
      'F2A_Core_Data_Types/index',
      'F2C_Procedural_Code_and_Flow_Control/flow-control',
    ],
  },
  {
    href: '/practice/visualizations/interface-signal-flow',
    kind: 'interactive',
    title: 'Interface signal flow',
    description:
      'Follow a signal from a class to the pins through an interface, a modport, a virtual interface and a clocking block, and predict which accesses compile and run.',
    lessons: [
      'F4B_Interfaces_and_Modports/index',
      'F4C_Clocking_Blocks/index',
      'I-UVM-2C_Configuration_and_Resources/index',
    ],
  },
  {
    href: '/practice/visualizations/randomization-explorer',
    kind: 'interactive',
    title: 'Constraint solution space',
    description:
      'Exact probabilities for dist, soft and solve…before, plus the minimal conflicting set when randomize() fails.',
    lessons: [
      'I-SV-2A_Constrained_Randomization_Fundamentals/index',
      'I-SV-2B_Advanced_Constrained_Randomization/solver-debug',
    ],
  },
  {
    href: '/practice/visualizations/coverage-analyzer',
    kind: 'interactive',
    title: 'Coverage closure lab',
    description:
      'Build bins and crosses with ignore and illegal bins, predict samples to closure, and hunt the holes.',
    lessons: [
      'I-SV-3A_Functional_Coverage_Fundamentals/index',
      'I-SV-3A_Functional_Coverage_Fundamentals/coverage-options',
      'I-SV-3B_Advanced_Functional_Coverage/closure-workflow',
    ],
  },
  {
    href: '/practice/visualizations/assertion-builder',
    kind: 'interactive',
    title: 'SVA trace lab',
    description:
      'Edit a trace, predict each attempt (pass, fail, vacuous), then evaluate with Preponed sampling.',
    lessons: ['I-SV-4A_SVA_Fundamentals/index', 'I-SV-4B_Advanced_Temporal_Logic/index'],
  },
  {
    href: '/practice/visualizations/uvm-architecture',
    kind: 'diagram',
    title: 'Interactive UVM architecture',
    description:
      'Explore how tests, environments, agents, drivers, monitors and scoreboards fit together, then jump to the lesson for each layer.',
    lessons: ['I-SV-9_Why_UVM/index', 'I-UVM-1A_Components/index', 'I-UVM-2A_Component_Roles/index'],
  },
  {
    href: '/practice/visualizations/uvm-phasing',
    kind: 'diagram',
    title: 'UVM phasing and objections',
    description:
      'Map every UVM phase (function or task, top-down or bottom-up) and watch objections keep run_phase alive.',
    lessons: ['I-UVM-1C_UVM_Phasing/index'],
  },
  {
    href: '/practice/visualizations/uvm-component-relationships',
    kind: 'diagram',
    title: 'UVM component relationships',
    description:
      'Predict what an agent builds in active and passive mode, then inject the two classic agent bugs and watch the build log.',
    lessons: ['I-UVM-2A_Component_Roles/index'],
  },
  {
    href: '/practice/visualizations/data-type-comparison',
    kind: 'chart',
    title: 'Data type comparison',
    description:
      'Compare 2-state and 4-state types, widths, signedness and default values, then predict what each declaration holds.',
    lessons: ['F2A_Core_Data_Types/index'],
  },
  {
    href: '/practice/waveform-studio',
    kind: 'tool',
    title: 'Waveform studio',
    description:
      'Edit AXI and AHB timing diagrams and get AXI handshake violations, with spec clauses, as you type. Includes two debug samples.',
    lessons: ['B-AXI-1_AXI_Channel_Architecture/index', 'B-AHB-1_AHB_Design_Timing_Mechanics/index'],
  },
];

/**
 * Labs whose lessons differ from their registry default: labs launched from a
 * sub-lesson, and labs that other lessons also link (capstone checkpoints,
 * revisits). The first lesson is the one that launches the lab; it must sit
 * in the lab's owningModule.
 */
export const LAB_LESSON_OVERRIDES: Readonly<Record<string, readonly LessonRef[]>> = {
  'basics-1': ['F2D_Reusable_Code_and_Parallelism/tasks-functions'],
  'randomization-advanced-1': ['I-SV-2B_Advanced_Constrained_Randomization/solver-debug'],
  'coverage-advanced-1': ['I-SV-3B_Advanced_Functional_Coverage/closure-workflow'],
  'uvm-mini-capstone': ['I-UVM-3C_First_Complete_Testbench/index'],
  'axi-scoreboard-lab': [
    'B-AXI-6_AXI_Verification_Performance/index',
    'A-UVM-6_Scoreboards_and_Reference_Models/index',
  ],
  // F3C is the pre-lab gate for the M1 clocking-block lab.
  'constructs-1': ['F4C_Clocking_Blocks/index', 'F3C_Delta_Cycles_and_Race_Conditions/index'],
  'common-1': ['F2A_Core_Data_Types/structs-unions-enums', 'F2B_Dynamic_Structures/index'],
  'fifo-1': ['I-SV-1_OOP/copying-and-cloning'],
  'arbiter-1': ['I-UVM-3C_First_Complete_Testbench/index', 'I-UVM-2A_Component_Roles/index'],
  'dma-1': [
    'I-UVM-3B_Advanced_Sequencing_and_Layering/coordinated-attack-lab',
    'I-UVM-3B_Advanced_Sequencing_and_Layering/layered-sequences',
    'I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences',
  ],
  'multi-agent-vseq': [
    'A-UVM-8_Multi_Agent_Topologies/index',
    'I-UVM-3B_Advanced_Sequencing_and_Layering/coordinated-attack-lab',
  ],
};

/** Related lessons for each interview bank, keyed by the bank's `topic`. The first one is the bank's home lesson. */
export const INTERVIEW_BANK_LESSONS: Readonly<Record<string, readonly LessonRef[]>> = {
  sv: [
    'F2A_Core_Data_Types/index',
    'F2B_Dynamic_Structures/index',
    'F2C_Procedural_Code_and_Flow_Control/index',
    'F3B_Scheduling_Regions/index',
    'F4C_Clocking_Blocks/index',
    'I-SV-1_OOP/index',
    'I-SV-2A_Constrained_Randomization_Fundamentals/index',
  ],
  sva: [
    'I-SV-4A_SVA_Fundamentals/index',
    'I-SV-4B_Advanced_Temporal_Logic/index',
    'E-INT-1_Integrating_UVM_with_Formal_Verification/index',
  ],
  uvm: [
    'I-UVM-1A_Components/index',
    'I-UVM-1B_The_UVM_Factory/index',
    'I-UVM-1C_UVM_Phasing/index',
    'I-UVM-2B_TLM_Connections/index',
    'I-UVM-2C_Configuration_and_Resources/index',
    'I-UVM-3A_Fundamentals/index',
    'I-UVM-3B_Advanced_Sequencing_and_Layering/index',
  ],
  amba: [
    'B-AMBA-F3_Interview_Debug_Clinic/index',
    'B-AMBA-1_Protocol_Families_and_Tradeoffs/index',
    'B-AHB-1_AHB_Design_Timing_Mechanics/index',
    'B-AXI-1_AXI_Channel_Architecture/index',
    'B-AMBA-F2_Future_Protocols_ACE_CHI/index',
  ],
  debug: [
    'E-DBG-1_Advanced_UVM_Debug_Methodologies/index',
    'E-DBG-1_Advanced_UVM_Debug_Methodologies/hang-lab',
    'I-SV-3B_Advanced_Functional_Coverage/closure-workflow',
  ],
  soc: [
    'E-SOC-1_SoC-Level_Verification_Strategies/index',
    'A-UVM-8_Multi_Agent_Topologies/index',
    'B-AMBA-F2_Future_Protocols_ACE_CHI/index',
    'E-PWR-1_Power_Aware_Verification/index',
  ],
};

/**
 * The lesson(s) that teach each interview question, keyed by question id.
 * Questions without an entry show only their bank's related lessons.
 */
export const INTERVIEW_QUESTION_LESSONS: Readonly<Record<string, readonly LessonRef[]>> = {
  // systemverilog.json
  'sv-blocking-vs-nonblocking': ['F2C_Procedural_Code_and_Flow_Control/index', 'F3B_Scheduling_Regions/index'],
  'sv-class-vs-module': ['I-SV-1_OOP/index', 'F4A_Modules_and_Packages/index'],
  'sv-scheduling-regions': ['F3B_Scheduling_Regions/index', 'I-SV-4A_SVA_Fundamentals/index'],
  'sv-clocking-block-race': ['F4C_Clocking_Blocks/index', 'F3C_Delta_Cycles_and_Race_Conditions/index'],
  'sv-constraint-bidirectional': [
    'I-SV-2A_Constrained_Randomization_Fundamentals/constraint-blocks',
    'I-SV-2B_Advanced_Constrained_Randomization/advanced-constraints',
  ],
  'sv-virtual-interface': ['F4B_Interfaces_and_Modports/index', 'I-UVM-2C_Configuration_and_Resources/index'],
  'sv-randomize-failure': ['I-SV-2B_Advanced_Constrained_Randomization/solver-debug'],
  'sv-fork-join-variants': ['F2C_Procedural_Code_and_Flow_Control/index', 'I-SV-5_Synchronization_and_IPC/index'],
  'sv-staff-methodology-reuse': ['F4A_Modules_and_Packages/index', 'E-CUST-1_UVM_Methodology_Customization/index'],
  'sv-senior-staff-constraint-perf': [
    'I-SV-2B_Advanced_Constrained_Randomization/advanced-constraints',
    'I-SV-2B_Advanced_Constrained_Randomization/solver-debug',
  ],
  'sv-logic-wire-reg': ['F2A_Core_Data_Types/index'],
  'sv-x-propagation': ['F2A_Core_Data_Types/index'],
  'sv-packed-unpacked': ['F2A_Core_Data_Types/index', 'F2B_Dynamic_Structures/index'],
  'sv-array-types-comparison': ['F2B_Dynamic_Structures/index'],
  'sv-queue-performance': ['F2B_Dynamic_Structures/index'],
  'sv-associative-array-leak': ['F2B_Dynamic_Structures/index', 'A-UVM-6_Scoreboards_and_Reference_Models/index'],
  'sv-array-manipulation-methods': ['F2B_Dynamic_Structures/index'],
  // uvm.json
  'uvm-factory-purpose': ['I-UVM-1B_The_UVM_Factory/index'],
  'uvm-objection-mechanism': ['I-UVM-1C_UVM_Phasing/index'],
  'uvm-config-db-vs-resource-db': ['I-UVM-2C_Configuration_and_Resources/index'],
  'uvm-sequence-vs-sequence-item': ['I-UVM-3A_Fundamentals/index'],
  'uvm-phase-concurrency-trap': ['I-UVM-1C_UVM_Phasing/index'],
  'uvm-tlm-analysis-port': ['I-UVM-2B_TLM_Connections/index'],
  'uvm-virtual-sequencer': [
    'I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences',
    'I-UVM-3B_Advanced_Sequencing_and_Layering/uvm-virtual-sequencer',
    'A-UVM-8_Multi_Agent_Topologies/index',
  ],
  'uvm-staff-env-architecture': [
    'A-UVM-8_Multi_Agent_Topologies/index',
    'A-UVM-4A_RAL_Fundamentals/index',
    'I-UVM-3B_Advanced_Sequencing_and_Layering/interrupt-handling',
  ],
  'uvm-staff-debug-hanging-sim': ['E-DBG-1_Advanced_UVM_Debug_Methodologies/hang-lab', 'I-UVM-1C_UVM_Phasing/index'],
  'uvm-senior-staff-methodology': ['E-EMU-1_Emulation_Aware_Verification/index'],
  // sva-formal.json
  'sva-concurrent-vs-immediate': ['I-SV-4A_SVA_Fundamentals/immediate-vs-concurrent'],
  'sva-implication-operators': ['I-SV-4A_SVA_Fundamentals/index'],
  'sva-past-sampling': ['I-SV-4A_SVA_Fundamentals/index', 'F3B_Scheduling_Regions/index'],
  'sva-formal-overconstraint': ['E-INT-1_Integrating_UVM_with_Formal_Verification/index'],
  'sva-repetition-operators': ['I-SV-4B_Advanced_Temporal_Logic/index', 'I-SV-4A_SVA_Fundamentals/index'],
  'sva-staff-formal-strategy': [
    'E-INT-1_Integrating_UVM_with_Formal_Verification/index',
    'B-AXI-1_AXI_Channel_Architecture/index',
  ],
  // debug.json
  'debug-methodology-first-steps': [
    'E-DBG-1_Advanced_UVM_Debug_Methodologies/index',
    'A-UVM-6_Scoreboards_and_Reference_Models/index',
  ],
  'debug-waveform-protocol-hang': ['E-DBG-1_Advanced_UVM_Debug_Methodologies/hang-lab'],
  'debug-x-propagation': ['F2A_Core_Data_Types/index', 'F2C_Procedural_Code_and_Flow_Control/flow-control'],
  'debug-coverage-hole-triage': ['I-SV-3B_Advanced_Functional_Coverage/closure-workflow'],
  'debug-staff-regression-triage': ['E-DBG-1_Advanced_UVM_Debug_Methodologies/index'],
  'debug-senior-staff-signoff': [
    'E-SOC-1_SoC-Level_Verification_Strategies/index',
    'I-SV-3B_Advanced_Functional_Coverage/linking-coverage',
  ],
  // soc-system-design.json
  'soc-address-map-decode': ['B-AMBA-1_Protocol_Families_and_Tradeoffs/index', 'A-UVM-4A_RAL_Fundamentals/index'],
  'soc-block-to-system': ['E-SOC-1_SoC-Level_Verification_Strategies/index', 'A-UVM-7_VIP_Construction/index'],
  'soc-coherency-verification': ['B-AMBA-F2_Future_Protocols_ACE_CHI/index'],
  'soc-staff-dma-system-design': ['A-UVM-8_Multi_Agent_Topologies/index', 'A-UVM-4A_RAL_Fundamentals/index'],
  'soc-senior-staff-interconnect': [
    'B-AXI-4_AXI_Expert_Features_Cache_Atomics/index',
    'B-AXI-6_AXI_Verification_Performance/index',
    'E-SOC-1_SoC-Level_Verification_Strategies/index',
  ],
  'soc-power-verification': ['I-SV-8_Power_Intent_and_UPF/index', 'E-PWR-1_Power_Aware_Verification/index'],
  'soc-signoff-strategy-review': [
    'E-SOC-1_SoC-Level_Verification_Strategies/index',
    'I-SV-3B_Advanced_Functional_Coverage/linking-coverage',
  ],
  // amba-protocols.json
  'amba-family-choose-bus': ['B-AMBA-1_Protocol_Families_and_Tradeoffs/index'],
  'amba-ahb-hready-hreadyout': ['B-AHB-1_AHB_Design_Timing_Mechanics/index'],
  'amba-axi-valid-ready-rule': ['B-AXI-1_AXI_Channel_Architecture/index'],
  'amba-axi-4kb-boundary': ['B-AXI-2_AXI_Burst_Math/index'],
  'amba-axi-deadlock-channels': ['B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks/index'],
  'amba-bridge-4kb-split': ['B-AMBA-F1_Bridges_and_System_Integration/index'],
  'amba-ace-snoop-flow': ['B-AMBA-F2_Future_Protocols_ACE_CHI/index'],
  'amba-chi-node-roles': ['B-AMBA-F2_Future_Protocols_ACE_CHI/index'],
  'amba-staff-interconnect-design': ['B-AXI-3_AXI_Ordering_and_IDs/index', 'B-AXI-6_AXI_Verification_Performance/index'],
  'amba-ace-state-transition-debug': ['B-AMBA-F2_Future_Protocols_ACE_CHI/index'],
  'amba-chi-credit-deadlock': ['B-AMBA-F2_Future_Protocols_ACE_CHI/index'],
  'amba-coherency-scoreboard-design': [
    'B-AMBA-F2_Future_Protocols_ACE_CHI/index',
    'A-UVM-6_Scoreboards_and_Reference_Models/index',
  ],
  'amba-chi-retry-verification': ['B-AMBA-F2_Future_Protocols_ACE_CHI/index'],
};

// ---------------------------------------------------------------------------
// Lesson resolution (generated curriculum, manifest order)
// ---------------------------------------------------------------------------

/** Module code from a module folder name: `I-SV-2B_Advanced_Constrained_Randomization` → `I-SV-2B`. */
export function moduleCodeOf(moduleSlug: string): string {
  return moduleSlug.split('_')[0];
}

function stripCodePrefix(title: string, code: string): string {
  const prefix = `${code}: `;
  return title.startsWith(prefix) ? title.slice(prefix.length).trim() : title.trim();
}

/** Drops legacy " | Site section" suffixes and the module-code prefix from lesson titles. */
function cleanTopicTitle(title: string, code: string): string {
  return stripCodePrefix(title.split(' | ')[0], code);
}

let lessonIndexCache: Map<LessonRef, LessonLink> | null = null;

function lessonIndex(): Map<LessonRef, LessonLink> {
  if (lessonIndexCache) return lessonIndexCache;
  const index = new Map<LessonRef, LessonLink>();
  let order = 0;
  for (const tier of curriculumData) {
    for (const section of tier.sections) {
      const code = moduleCodeOf(section.slug);
      const moduleTitle = stripCodePrefix(section.title, code);
      for (const topic of section.topics) {
        const ref = `${section.slug}/${topic.slug}`;
        const isModuleIndex = topic.slug === 'index';
        index.set(ref, {
          ref,
          href: `/curriculum/${tier.slug}/${section.slug}/${topic.slug}`,
          code,
          moduleSlug: section.slug,
          moduleTitle,
          title: isModuleIndex ? moduleTitle : cleanTopicTitle(topic.title, code),
          isModuleIndex,
          tier: tier.tier,
          tierTitle: tier.title,
          track: section.track ?? 'core',
          order,
        });
        order += 1;
      }
    }
  }
  lessonIndexCache = index;
  return index;
}

/** Every lesson in manifest order. */
export function allLessons(): LessonLink[] {
  return Array.from(lessonIndex().values());
}

/** The index lesson of the module with this code (`I-UVM-2C`), if the code names a real module. */
export function findModuleIndexByCode(code: string): LessonLink | undefined {
  for (const lesson of lessonIndex().values()) {
    if (lesson.isModuleIndex && lesson.code === code) return lesson;
  }
  return undefined;
}

/**
 * Resolves `<ModuleFolder>/<lesson>` to a lesson. A bare module folder
 * (`I-UVM-1B_The_UVM_Factory`) or module code (`I-UVM-1B`) means that module's
 * index lesson.
 */
export function resolveLessonRef(ref: LessonRef): LessonLink | undefined {
  const index = lessonIndex();
  if (ref.includes('/')) return index.get(ref);
  return index.get(`${ref}/index`) ?? findModuleIndexByCode(ref);
}

/** Resolves refs, drops duplicates and unknown refs, keeps the first one first and sorts the rest by manifest order. */
function resolveLessonRefs(refs: readonly LessonRef[]): LessonLink[] {
  const seen = new Set<string>();
  const resolved: LessonLink[] = [];
  for (const ref of refs) {
    const lesson = resolveLessonRef(ref);
    if (!lesson || seen.has(lesson.ref)) continue;
    seen.add(lesson.ref);
    resolved.push(lesson);
  }
  const [first, ...rest] = resolved;
  return first ? [first, ...rest.sort((a, b) => a.order - b.order)] : [];
}

const UNORDERED = Number.MAX_SAFE_INTEGER;

/** Sorts practice items by the manifest position of their teaching lesson (stable for ties). */
export function sortByCurriculumOrder<T extends { order: number }>(items: readonly T[]): T[] {
  return items
    .map((item, position) => ({ item, position }))
    .sort((a, b) => a.item.order - b.item.order || a.position - b.position)
    .map(({ item }) => item);
}

// ---------------------------------------------------------------------------
// Practice pages
// ---------------------------------------------------------------------------

function toPageItem(page: PracticePageDefinition): PracticeItem {
  const lessons = resolveLessonRefs(page.lessons);
  return {
    id: `${page.kind}:${page.href.split('/').pop()}`,
    kind: page.kind,
    title: page.title,
    description: page.description,
    href: page.href,
    status: 'available',
    lessons,
    order: lessons[0]?.order ?? UNORDERED,
  };
}

/** All exercise, visualization and tool pages, in manifest order. */
export function getPracticePages(): PracticeItem[] {
  return sortByCurriculumOrder(PRACTICE_PAGES.map(toPageItem));
}

/** The practice page served at `href`, if it is mapped. */
export function getPracticePage(href: string): PracticeItem | undefined {
  const page = PRACTICE_PAGES.find((entry) => entry.href === href);
  return page ? toPageItem(page) : undefined;
}

/** Like getPracticePage, but throws for an unmapped route so a practice page cannot ship without its lessons. */
export function requirePracticePage(href: string): PracticeItem {
  const page = getPracticePage(href);
  if (!page) throw new Error(`Practice page ${href} is missing from PRACTICE_PAGES in src/lib/practice-links.ts`);
  return page;
}

/** The lessons that teach the practice page at `href` (teaching lesson first). */
export function getLessonsForPractice(href: string): LessonLink[] {
  return getPracticePage(href)?.lessons ?? [];
}

// ---------------------------------------------------------------------------
// Labs
// ---------------------------------------------------------------------------

type LabLike = Pick<LabManifest, 'id' | 'owningModule'> & Partial<Pick<LabManifest, 'moduleHref'>>;

/** Lesson ref from a registry `moduleHref` such as `/curriculum/T3_Advanced/B-AHB-3_AHB_Verification/index`. */
function refFromModuleHref(moduleHref: string | undefined): LessonRef | undefined {
  if (!moduleHref) return undefined;
  const [, root, , moduleSlug, lessonSlug] = moduleHref.split('/');
  if (root !== 'curriculum' || !moduleSlug) return undefined;
  return `${moduleSlug}/${lessonSlug || 'index'}`;
}

/**
 * The lessons a lab belongs to, launching lesson first: the override if there
 * is one, otherwise the registry `moduleHref`, otherwise the index lesson of
 * its `owningModule`. Empty when none of these resolves (for example
 * `owningModule: "F4"`, which is not a module).
 */
export function getLabLessons(lab: LabLike): LessonLink[] {
  const override = LAB_LESSON_OVERRIDES[lab.id];
  if (override) return resolveLessonRefs(override);
  const fromHref = refFromModuleHref(lab.moduleHref);
  const lesson = (fromHref && resolveLessonRef(fromHref)) || findModuleIndexByCode(lab.owningModule);
  return lesson ? [lesson] : [];
}

export interface LabBackLink {
  href: string;
  /** Visible start of the link text: "Back to module" (index lesson), "Back to lesson" (sub-lesson) or "Back to the Practice hub". */
  label: string;
  /** The lesson the link returns to; absent only when the lab names no real module. */
  lesson?: LessonLink;
}

/** Where a lab page's back link goes: the lesson that launches the lab, never the bare catalogue when a lesson exists. */
export function getLabBackLink(lab: LabLike): LabBackLink {
  const [lesson] = getLabLessons(lab);
  if (lesson) return { href: lesson.href, label: lesson.isModuleIndex ? 'Back to module' : 'Back to lesson', lesson };
  return { href: PRACTICE_SECTION_HREF.labs, label: 'Back to the Practice hub' };
}

export interface LabPrerequisite {
  kind: 'lab' | 'lesson';
  /** Lab id or module code, as written in the lab manifest. */
  id: string;
  title: string;
  /** Lab page or lesson URL. Undefined for a lab that is not available yet. */
  href?: string;
  /** `lesson` for a module prerequisite; for a lab, whether it can be opened today. */
  status: 'available' | 'coming_soon' | 'lesson';
  /** The lesson that teaches the prerequisite (for a lab: the lesson that launches it). */
  lesson?: LessonLink;
  /** True when that lesson comes after the lab's own lesson in the manifest order. */
  forward: boolean;
}

export interface LabPrerequisites {
  items: LabPrerequisite[];
  /** The latest lesson among forward prerequisites: "do this lab after …". */
  doAfter?: LessonLink;
  /** Manifest entries that name neither a listed lab nor a module (shown nowhere; listed for maintainers). */
  unresolved: string[];
}

/**
 * A lab's prerequisites from both manifest lists. `modulePrerequisites` mixes
 * module codes and lab ids, so each id is tried as a lab first, then as a
 * module code. The lab's own module and archived labs are skipped.
 */
export function getLabPrerequisites(
  lab: LabLike & Partial<Pick<LabManifest, 'labPrerequisites' | 'modulePrerequisites'>>,
): LabPrerequisites {
  const [ownLesson] = getLabLessons(lab);
  const ownOrder = ownLesson?.order ?? UNORDERED;
  const items: LabPrerequisite[] = [];
  const unresolved: string[] = [];
  const seen = new Set<string>();

  const addLab = (id: string): boolean => {
    const prerequisite = getLabById(id);
    if (!prerequisite || prerequisite.status === 'archived') return false;
    if (seen.has(`lab:${id}`) || id === lab.id) return true;
    seen.add(`lab:${id}`);
    const [lesson] = getLabLessons(prerequisite);
    const available = prerequisite.status === 'available';
    items.push({
      kind: 'lab',
      id,
      title: prerequisite.title,
      href: available ? `/practice/lab/${prerequisite.id}` : undefined,
      status: available ? 'available' : 'coming_soon',
      lesson,
      forward: Boolean(lesson && ownLesson && lesson.order > ownOrder),
    });
    return true;
  };

  const addModule = (code: string): boolean => {
    const lesson = findModuleIndexByCode(code);
    if (!lesson) return false;
    if (seen.has(`module:${code}`) || lesson.moduleSlug === ownLesson?.moduleSlug) return true;
    seen.add(`module:${code}`);
    items.push({
      kind: 'lesson',
      id: code,
      title: lesson.title,
      href: lesson.href,
      status: 'lesson',
      lesson,
      forward: Boolean(ownLesson && lesson.order > ownOrder),
    });
    return true;
  };

  for (const id of lab.labPrerequisites ?? []) {
    if (!addLab(id)) unresolved.push(id);
  }
  for (const id of lab.modulePrerequisites ?? []) {
    if (!addLab(id) && !addModule(id)) unresolved.push(id);
  }

  const doAfter = items
    .filter((item) => item.forward && item.lesson)
    .map((item) => item.lesson as LessonLink)
    .sort((a, b) => b.order - a.order)[0];

  return { items, doAfter, unresolved };
}

/** A lab as a practice item: a link only when it is available. */
export function toLabPracticeItem(lab: LabManifest): PracticeItem {
  const lessons = getLabLessons(lab);
  const available = lab.status === 'available';
  return {
    id: `lab:${lab.id}`,
    kind: 'lab',
    title: lab.title,
    description: lab.description,
    href: available ? `/practice/lab/${lab.id}` : undefined,
    status: available ? 'available' : 'coming_soon',
    lessons,
    order: lessons[0]?.order ?? UNORDERED,
  };
}

/** Labs to list in the Practice Hub: archived labs dropped, the rest in manifest order. */
export function getPracticeLabItems(labs: readonly LabManifest[]): PracticeItem[] {
  return sortByCurriculumOrder(labs.filter((lab) => lab.status !== 'archived').map(toLabPracticeItem));
}

// ---------------------------------------------------------------------------
// Interview questions
// ---------------------------------------------------------------------------

/** Related lessons for an interview bank (by `topic`), home lesson first. */
export function getInterviewBankLessons(topic: string): LessonLink[] {
  return resolveLessonRefs(INTERVIEW_BANK_LESSONS[topic] ?? []);
}

/**
 * Lessons that teach one interview question. A `modules` list in the bank JSON
 * (module codes, module folders or `<ModuleFolder>/<lesson>`, as proposed in
 * G29) wins; otherwise INTERVIEW_QUESTION_LESSONS; otherwise none, and the
 * page falls back to the bank's related lessons.
 */
export function getInterviewQuestionLessons(questionId: string, modules: readonly string[] = []): LessonLink[] {
  const fromBank = resolveLessonRefs(modules);
  return fromBank.length > 0 ? fromBank : resolveLessonRefs(INTERVIEW_QUESTION_LESSONS[questionId] ?? []);
}

// ---------------------------------------------------------------------------
// Reverse lookup, for a lesson's practice panel
// ---------------------------------------------------------------------------

export interface LessonPracticeEntry {
  item: PracticeItem;
  /** True when this lesson is the one that teaches (or launches) the item. */
  teaches: boolean;
  /** Set when the item is taught later than this lesson: "after <lesson>". */
  after?: LessonLink;
}

/**
 * Practice pages and labs that list this lesson, in manifest order. `lessonRef`
 * is `<ModuleFolder>/<lesson>`. Pass `labs` (for example `getAllLabs()`) to
 * include labs; archived labs are skipped.
 */
export function getPracticeForLesson(lessonRef: LessonRef, labs: readonly LabManifest[] = []): LessonPracticeEntry[] {
  const lesson = resolveLessonRef(lessonRef);
  if (!lesson) return [];
  return practiceEntriesFor(lesson, (entry) => entry.ref === lesson.ref, labs);
}

/**
 * Practice for a whole module (any of its lessons), as seen from `lessonRef`:
 * a sub-lesson can then offer its module's lab or exercise, and "after" still
 * marks items taught later than that lesson. `moduleSlug` is the module folder.
 */
export function getPracticeForModule(
  moduleSlug: string,
  lessonRef: LessonRef = `${moduleSlug}/index`,
  labs: readonly LabManifest[] = [],
): LessonPracticeEntry[] {
  const lesson = resolveLessonRef(lessonRef);
  if (!lesson) return [];
  return practiceEntriesFor(lesson, (entry) => entry.moduleSlug === moduleSlug, labs);
}

function practiceEntriesFor(
  lesson: LessonLink,
  matches: (entry: LessonLink) => boolean,
  labs: readonly LabManifest[],
): LessonPracticeEntry[] {
  const items = [...PRACTICE_PAGES.map(toPageItem), ...getPracticeLabItems(labs)];
  return sortByCurriculumOrder(items)
    .filter((item) => item.lessons.some(matches))
    .map((item) => {
      const teacher = item.lessons[0];
      return {
        item,
        teaches: teacher?.ref === lesson.ref,
        after: teacher && teacher.order > lesson.order ? teacher : undefined,
      };
    });
}

// ---------------------------------------------------------------------------
// Sections of /practice, breadcrumbs and the practice pager
// ---------------------------------------------------------------------------

/** The section of /practice that lists each kind of item. */
export const PRACTICE_KIND_SECTION: Readonly<Record<PracticeKind, PracticeSection>> = {
  lab: 'labs',
  exercise: 'exercises',
  interactive: 'interactiveModels',
  diagram: 'diagrams',
  chart: 'charts',
  tool: 'tools',
  interview: 'interviewPrep',
};

/**
 * Section titles for the sections the navigation config does not list. Labs,
 * Exercises and Interactive models take their label from the Practice menu in
 * src/lib/site-links.ts, so they are not repeated here.
 */
export const SECTION_TITLES_OUTSIDE_NAV: Readonly<Partial<Record<PracticeSection, string>>> = {
  diagrams: 'Diagrams',
  charts: 'Charts',
  tools: 'Tools',
  interviewPrep: 'Interview prep',
};

const NAV_LINKS: readonly NavLink[] = [
  ...PRIMARY_NAV.flatMap((item) => (isNavGroup(item) ? item.children : [item])),
  ...FOOTER_NAV.flatMap((group) => group.children),
];

export interface PracticeSectionLink {
  section: PracticeSection;
  /** The section's id on /practice (PRACTICE_SECTION_ID). */
  id: string;
  /** The section's title: its nav label when the navigation lists it. */
  label: string;
  /** `/practice#<id>`. */
  href: string;
}

/**
 * One section of /practice: its id, its label (from the nav config where
 * listed, else SECTION_TITLES_OUTSIDE_NAV) and its link. Throws when neither
 * names the section, so a section cannot ship without a title.
 */
export function practiceSectionLink(
  section: PracticeSection,
  navLinks: readonly NavLink[] = NAV_LINKS,
  fallbacks: Readonly<Partial<Record<PracticeSection, string>>> = SECTION_TITLES_OUTSIDE_NAV,
): PracticeSectionLink {
  const href = PRACTICE_SECTION_HREF[section];
  const label = navLinks.find((link) => link.href === href)?.label ?? fallbacks[section];
  if (!label) throw new Error(`The practice section ${section} (${href}) has no label: add it to the nav config in src/lib/site-links.ts or to SECTION_TITLES_OUTSIDE_NAV`);
  return { section, id: PRACTICE_SECTION_ID[section], label, href };
}

/** The first crumb of every practice trail: the "Practice" menu, linking to /practice. */
export function practiceRootLink(): NavLink {
  const group = PRIMARY_NAV.find((item) => isNavGroup(item) && item.children.some((child) => child.href === PRACTICE_HREF));
  if (!group) throw new Error('The Practice menu is missing from PRIMARY_NAV in src/lib/site-links.ts');
  return { label: group.label, href: PRACTICE_HREF };
}

/** Practice › <section> › <item>: the item is the current page and carries no link. */
export function practiceBreadcrumbs(item: Pick<PracticeItem, 'title' | 'kind'>): { label: string; href?: string }[] {
  const section = practiceSectionLink(PRACTICE_KIND_SECTION[item.kind]);
  return [practiceRootLink(), { label: section.label, href: section.href }, { label: item.title }];
}

/** A neighbour in the pager: plain data, safe to pass to any component. */
export interface PracticePagerLink {
  title: string;
  href: string;
  /** The teaching lesson's module code and title, for the card's second line. */
  lesson?: { code: string; title: string };
}

export interface PracticePagerData {
  kind: PracticeKind;
  section: PracticeSectionLink;
  prev?: PracticePagerLink;
  next?: PracticePagerLink;
}

function toPagerLink(item: PracticeItem): PracticePagerLink | undefined {
  if (!item.href) return undefined;
  const [lesson] = item.lessons;
  return { title: item.title, href: item.href, lesson: lesson ? { code: lesson.code, title: lesson.title } : undefined };
}

/**
 * The previous and next items around `id` in `items` (already in curriculum
 * order), skipping items that cannot be opened. Undefined ends at the first
 * and last item; both undefined when `id` is not in the list.
 */
export function pagerNeighbours(
  items: readonly PracticeItem[],
  id: string,
): { prev?: PracticePagerLink; next?: PracticePagerLink } {
  const openable = items.filter((item) => item.href);
  const index = openable.findIndex((item) => item.id === id);
  if (index < 0) return {};
  return { prev: openable[index - 1] && toPagerLink(openable[index - 1]), next: openable[index + 1] && toPagerLink(openable[index + 1]) };
}

/**
 * The pager for the practice page or lab at `href`: back to its section of
 * /practice, and the previous and next item of the same kind in curriculum
 * order. Undefined for an href that is not a practice page or an available lab.
 */
export function getPracticePager(href: string, labs: readonly LabManifest[] = getAllLabs()): PracticePagerData | undefined {
  const labMatch = /^\/practice\/lab\/([^/?#]+)$/.exec(href);
  let kind: PracticeKind;
  let items: PracticeItem[];
  let id: string;
  if (labMatch) {
    kind = 'lab';
    items = getPracticeLabItems(labs);
    id = `lab:${decodeURIComponent(labMatch[1])}`;
  } else {
    const page = getPracticePage(href);
    if (!page) return undefined;
    kind = page.kind;
    items = getPracticePages().filter((item) => item.kind === page.kind);
    id = page.id;
  }
  if (!items.some((item) => item.id === id && item.href)) return undefined;
  return { kind, section: practiceSectionLink(PRACTICE_KIND_SECTION[kind]), ...pagerNeighbours(items, id) };
}

/** Like getPracticePager, but throws for an unmapped route. */
export function requirePracticePager(href: string): PracticePagerData {
  const pager = getPracticePager(href);
  if (!pager) throw new Error(`No practice pager for ${href}: add it to PRACTICE_PAGES or the lab registry`);
  return pager;
}
