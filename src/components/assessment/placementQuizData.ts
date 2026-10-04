import type { PlacementRouteTarget } from '@/lib/learning-paths';

export type PlacementCategory = 'foundations' | 'methodology' | 'debug';

export type PlacementDifficulty = 'intro' | 'intermediate' | 'advanced';

export interface PlacementOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

export interface PlacementQuestion {
  id: string;
  prompt: string;
  category: PlacementCategory;
  difficulty: PlacementDifficulty;
  rationale: string;
  options: PlacementOption[];
}

export interface PlacementAnswer {
  questionId: string;
  optionId: string;
}

export interface CategoryScore {
  correct: number;
  total: number;
}

export interface PlacementResults {
  assessmentVersion: string;
  scoringVersion: string;
  answeredCount: number;
  invalidResponseCount: number;
  isComplete: boolean;
  totalQuestions: number;
  totalCorrect: number;
  categoryScores: Record<PlacementCategory, CategoryScore>;
  overallPercent: number;
  recommendedTier: PlacementTierRecommendation;
}

export const PLACEMENT_ASSESSMENT_VERSION = 'placement-v2';
export const PLACEMENT_SCORING_VERSION = 'placement-scoring-v2';

export interface PlacementTierRecommendation {
  /** The curriculum tier the learner is ready for (1–4). */
  tier: number;
  /** The manifest title of that tier, for example "Tier 2: Intermediate". */
  label: string;
  summary: string;
  focus: string;
  /** Where to start: a learning route, its start step and the steps to skim first (src/lib/learning-paths.ts). */
  route: PlacementRouteTarget;
}

export interface PlacementResource {
  label: string;
  href: string;
}

export interface PlacementCategoryFocus {
  title: string;
  summary: string;
  resources: PlacementResource[];
}

export const placementQuestions: PlacementQuestion[] = [
  {
    id: 'foundations-logic-range',
    prompt:
      "When modelling a register file entry that must track X/Z values during reset, which SystemVerilog data type keeps four-state behaviour without falling back to legacy reg declarations?",
    category: 'foundations',
    difficulty: 'intro',
    rationale: 'Use `logic` for single-driver variables that still need X/Z tracking; `bit` collapses to two states.',
    options: [
      { id: 'logic', label: '`logic [7:0] data_q;`', isCorrect: true },
      { id: 'bit', label: '`bit [7:0] data_q;`', isCorrect: false },
      { id: 'byte', label: '`byte data_q;`', isCorrect: false },
      { id: 'reg', label: '`reg [7:0] data_q;`', isCorrect: false },
    ],
  },
  {
    id: 'foundations-always-block',
    prompt: 'Which procedural block guarantees a combinational sensitivity list without accidentally inferring latches?',
    category: 'foundations',
    difficulty: 'intro',
    rationale: '`always_comb` automatically tracks RHS signals and emits errors when latches sneak in.',
    options: [
      { id: 'always_comb', label: '`always_comb`', isCorrect: true },
      { id: 'always_ff', label: '`always_ff`', isCorrect: false },
      { id: 'always', label: '`always @(posedge clk)`', isCorrect: false },
      { id: 'initial', label: '`initial begin ... end`', isCorrect: false },
    ],
  },
  {
    id: 'foundations-interface',
    prompt:
      'You are connecting a synthesizable interface between a driver and monitor. How do you expose the correct directions to each component without duplicating declarations?',
    category: 'foundations',
    difficulty: 'intermediate',
    rationale: 'Define modports on the interface so each component sees only the signals and directions it needs.',
    options: [
      { id: 'modport', label: 'Declare modports on the interface and import them in each component', isCorrect: true },
      { id: 'typedef', label: 'Wrap the interface signals in a typedef struct', isCorrect: false },
      { id: 'virtual', label: 'Use a virtual interface but pass it without modports', isCorrect: false },
      { id: 'alias', label: 'Create alias wires inside every component', isCorrect: false },
    ],
  },
  {
    id: 'foundations-constraint',
    prompt:
      "A randomize call needs to bias transaction IDs toward the range 8'h80–8'hFF while still touching the lower half occasionally. Which construct best captures that intent?",
    category: 'foundations',
    difficulty: 'advanced',
    rationale: 'Use a `dist` constraint so the upper range carries higher weight but lower values remain legal.',
    options: [
      { id: 'dist', label: "`constraint { id dist { [8'h80:8'hFF] := 4, [8'h00:8'h7F] := 1 }; }`", isCorrect: true },
      { id: 'randc', label: 'Change the field to `randc`', isCorrect: false },
      { id: 'foreach', label: 'Iterate with `foreach` to push preferred values', isCorrect: false },
      { id: 'constraint_mode', label: 'Toggle `constraint_mode(0)` on disfavoured constraints', isCorrect: false },
    ],
  },
  {
    id: 'methodology-driver',
    prompt:
      'During a sequence-driver handshake you notice the driver keeps pulling the same item even after `item_done`. Which fix aligns with the UVM handshake contract?',
    category: 'methodology',
    difficulty: 'intermediate',
    rationale: 'Drivers must call `seq_item_port.item_done()` after completing a transaction so the sequencer releases it.',
    options: [
      { id: 'item_done', label: 'Call `seq_item_port.item_done()` once the response is ready', isCorrect: true },
      { id: 'grab', label: 'Use `seq_item_port.grab()` before every item', isCorrect: false },
      { id: 'disable', label: 'Disable the sequencer arbitration by forcing mode to lock', isCorrect: false },
      { id: 'raise_objection', label: 'Raise an objection before pulling the next item', isCorrect: false },
    ],
  },
  {
    id: 'methodology-config',
    prompt:
      'A passive monitor still observes default configuration values even after your test calls `uvm_config_db#(my_cfg)::set(this, "*.env.monitor", "cfg", cfg)`. What did you likely miss?',
    category: 'methodology',
    difficulty: 'advanced',
    rationale: 'Components must grab config in `build_phase` via `uvm_config_db::get()` using a matching field path.',
    options: [
      { id: 'get_build', label: 'Calling `uvm_config_db::get()` in the monitor `build_phase`', isCorrect: true },
      { id: 'set_time', label: 'Moving the `set` call into `end_of_elaboration_phase`', isCorrect: false },
      { id: 'factory', label: 'Registering the config type with the factory', isCorrect: false },
      { id: 'analysis', label: 'Publishing the config on an analysis port', isCorrect: false },
    ],
  },
  {
    id: 'methodology-passive',
    prompt: 'You need a passive UVM agent for scoreboarding only. Which component state keeps the driver from driving pins?',
    category: 'methodology',
    difficulty: 'intro',
    rationale: 'Setting `is_active` to `UVM_PASSIVE` skips driver+sequencer construction while keeping the monitor.',
    options: [
      { id: 'passive', label: 'Set the agent `is_active` field to `UVM_PASSIVE`', isCorrect: true },
      { id: 'disable_run', label: 'Disable the driver `run_phase` using objections', isCorrect: false },
      { id: 'build_phase', label: 'Avoid constructing the driver inside `build_phase` manually', isCorrect: false },
      { id: 'factory_override', label: 'Factory override the driver with `uvm_null_component`', isCorrect: false },
    ],
  },
  {
    id: 'debug-coverage',
    prompt:
      'Functional coverage shows a gap on cross bins that only trigger when errors occur. How do you close coverage without faking successes?',
    category: 'debug',
    difficulty: 'advanced',
    rationale: 'Author targeted negative tests or targeted sequences that legitimately exercise the error scenarios.',
    options: [
      { id: 'targeted_test', label: 'Write targeted negative tests that hit the error paths intentionally', isCorrect: true },
      { id: 'ignore_bins', label: 'Mark the cross bins as `ignore_bins`', isCorrect: false },
      { id: 'force_coverage', label: 'Use `$set_coverage_db_name` to merge with older runs', isCorrect: false },
      { id: 'weight_zero', label: 'Set the bin weight to zero and call coverage done', isCorrect: false },
    ],
  },
  {
    id: 'debug-objections',
    prompt:
      'A passive scoreboard still has pending comparisons when the stimulus sequence finishes. Which ownership model keeps phase completion predictable?',
    category: 'debug',
    difficulty: 'intermediate',
    rationale: 'The test or virtual sequence owns the objection. The scoreboard exposes pending work and coordinates through phase_ready_to_end, a completion event, or an agreed drain policy.',
    options: [
      { id: 'test_owned', label: 'Let the test or virtual sequence own the objection and wait on scoreboard completion state', isCorrect: true },
      { id: 'scoreboard_owned', label: 'Give the passive scoreboard a permanent run-phase objection', isCorrect: false },
      { id: 'global', label: 'Force-clear all objections when stimulus ends', isCorrect: false },
      { id: 'fixed_delay', label: 'Add a fixed delay before dropping the test objection', isCorrect: false },
    ],
  },
  {
    id: 'debug-waveform',
    prompt:
      'A regression failure only shows up with back-pressure enabled and disappears when randomization is rerun. Which debug tactic narrows root cause fastest?',
    category: 'debug',
    difficulty: 'intro',
    rationale: 'Use the saved seed together with focused waveform captures around the failing handshake.',
    options: [
      { id: 'seed_waveform', label: 'Re-run with the captured seed and take focused waveform dumps', isCorrect: true },
      { id: 'disable_backpressure', label: 'Disable back-pressure permanently', isCorrect: false },
      { id: 'increase_timeout', label: 'Increase timeout to mask the failure', isCorrect: false },
      { id: 'random_seed', label: 'Keep randomizing until the failure goes away', isCorrect: false },
    ],
  },
];

const difficultyWeight: Record<PlacementDifficulty, number> = {
  intro: 1,
  intermediate: 1.2,
  advanced: 1.4,
};

/**
 * One entry per curriculum tier, highest first. Labels are the manifest tier
 * titles (tests/placement-links.spec.ts checks them), and each tier maps to a
 * route step whose first lesson is the recommended start.
 */
const tierThresholds: PlacementTierRecommendation[] = [
  {
    tier: 4,
    label: 'Tier 4: Expert',
    summary:
      'You apply UVM, coverage and debug patterns reliably. Go straight to the expert material: debug at scale, methodology, formal, portable stimulus, power and SoC strategy.',
    focus: 'When a Tier 4 lesson assumes something you have not met, the expert index and each lesson’s prerequisites point back to it.',
    route: { tier: 4, routeId: 'expert', startStepId: 'debug-methodology', skimStepIds: [] },
  },
  {
    tier: 3,
    label: 'Tier 3: Advanced',
    summary:
      'Your SystemVerilog and UVM fundamentals are solid. Next come complete environments: scoreboards, VIP, callbacks, multi-agent topologies, register models and the AMBA protocols.',
    focus: 'Skim the Tier 2 deep dives you have not met at work, then build environments on the Practitioner route.',
    route: { tier: 3, routeId: 'practitioner', startStepId: 'environments', skimStepIds: ['deeper-sv', 'deeper-uvm'] },
  },
  {
    tier: 2,
    label: 'Tier 2: Intermediate',
    summary:
      'The SystemVerilog basics are in place. Next come class-based testbenches, constrained random stimulus, coverage and assertions, then your first UVM testbench.',
    focus: 'If a foundations answer surprised you, skim the Tier 1 language and timing lessons before you start.',
    route: { tier: 2, routeId: 'junior', startStepId: 'class-based-tb', skimStepIds: ['language', 'time-and-races'] },
  },
  {
    tier: 1,
    label: 'Tier 1: Foundations',
    summary:
      'Start at the beginning: why verification exists, SystemVerilog data and procedural code, then time, races and interfaces.',
    focus: 'Follow the Junior route from its first lesson; every step ends with practice.',
    route: { tier: 1, routeId: 'junior', startStepId: 'why-verify', skimStepIds: [] },
  },
];

/** The four tier recommendations, highest tier first. The placement page resolves each to a starting lesson. */
export const placementTierRecommendations: readonly PlacementTierRecommendation[] = tierThresholds;

const categoryFocus: Record<PlacementCategory, PlacementCategoryFocus> = {
  foundations: {
    title: 'SystemVerilog Foundations',
    summary: 'Reinforce data types, procedural blocks, interfaces and constraints so RTL corner cases stay controlled.',
    resources: [
      { label: 'F2A: Core Data Types', href: '/curriculum/T1_Foundational/F2A_Core_Data_Types/index' },
      {
        label: 'F2C: Procedural Code and Flow Control',
        href: '/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index',
      },
      {
        label: 'F4B: Bundling Signals with Interfaces and Modports',
        href: '/curriculum/T1_Foundational/F4B_Interfaces_and_Modports/index',
      },
      {
        label: 'I-SV-2A: Constrained Randomization Fundamentals',
        href: '/curriculum/T2_Intermediate/I-SV-2A_Constrained_Randomization_Fundamentals/index',
      },
      { label: 'Interactive: SystemVerilog Data Types', href: '/practice/visualizations/systemverilog-data-types' },
    ],
  },
  methodology: {
    title: 'Verification Methodology',
    summary: 'Deepen your UVM fluency across agent roles, configuration and the sequencer-driver handshake.',
    resources: [
      {
        label: 'I-UVM-2A: Component Roles and the Testbench Hierarchy',
        href: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index',
      },
      {
        label: 'I-UVM-2C: Configuration and Resources',
        href: '/curriculum/T2_Intermediate/I-UVM-2C_Configuration_and_Resources/index',
      },
      { label: 'I-UVM-3A: Basic UVM Sequences and Items', href: '/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index' },
      { label: 'Exercise: Sequencer Arbitration Sandbox', href: '/exercises/sequencer-arbitration' },
    ],
  },
  debug: {
    title: 'Debug & Coverage Habits',
    summary: 'Sharpen coverage closure, end-of-test control and failure triage so regressions converge faster.',
    resources: [
      {
        label: 'I-SV-3B: The Coverage Closure Loop',
        href: '/curriculum/T2_Intermediate/I-SV-3B_Advanced_Functional_Coverage/closure-workflow',
      },
      { label: 'I-UVM-1C: UVM Phasing and Synchronization', href: '/curriculum/T2_Intermediate/I-UVM-1C_UVM_Phasing/index' },
      {
        label: 'E-DBG-1: Advanced UVM Debug Methodologies',
        href: '/curriculum/T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/index',
      },
      { label: 'Interactive: Coverage Closure Lab', href: '/practice/visualizations/coverage-analyzer' },
    ],
  },
};

export const calculatePlacementResults = (
  questions: PlacementQuestion[],
  answers: PlacementAnswer[],
): PlacementResults => {
  const categoryScores: Record<PlacementCategory, CategoryScore> = {
    foundations: { correct: 0, total: 0 },
    methodology: { correct: 0, total: 0 },
    debug: { correct: 0, total: 0 },
  };

  let weightedCorrect = 0;
  let weightedTotal = 0;
  let invalidResponseCount = 0;
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const answerMap = new Map<string, string>();
  const duplicateQuestionIds = new Set<string>();

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    if (!question || !question.options.some((option) => option.id === answer.optionId)) {
      invalidResponseCount += 1;
      continue;
    }
    if (answerMap.has(answer.questionId) || duplicateQuestionIds.has(answer.questionId)) {
      invalidResponseCount += 1;
      answerMap.delete(answer.questionId);
      duplicateQuestionIds.add(answer.questionId);
      continue;
    }
    answerMap.set(answer.questionId, answer.optionId);
  }

  questions.forEach((question) => {
    const response = answerMap.get(question.id);
    const correctOption = question.options.find((option) => option.isCorrect);
    const weight = difficultyWeight[question.difficulty];
    weightedTotal += weight;
    categoryScores[question.category].total += 1;

    if (response && correctOption && response === correctOption.id) {
      weightedCorrect += weight;
      categoryScores[question.category].correct += 1;
    }
  });

  const overallPercent = weightedTotal > 0 ? weightedCorrect / weightedTotal : 0;
  const answeredCount = answerMap.size;
  const categoryPercents = Object.fromEntries(
    Object.entries(categoryScores).map(([category, score]) => [
      category,
      score.total > 0 ? score.correct / score.total : 0,
    ]),
  ) as Record<PlacementCategory, number>;
  const tier4Eligible =
    overallPercent >= 0.85 &&
    categoryPercents.foundations >= 0.75 &&
    categoryPercents.methodology >= 0.75 &&
    categoryPercents.debug >= 0.75 &&
    answeredCount >= 9;
  const tier3Eligible =
    overallPercent >= 0.65 &&
    Object.values(categoryPercents).every((percent) => percent >= 0.5) &&
    answeredCount >= 7;
  const recommendedTierNumber = tier4Eligible ? 4 : tier3Eligible ? 3 : overallPercent >= 0.4 ? 2 : 1;
  const recommendedTier = tierThresholds.find((tier) => tier.tier === recommendedTierNumber) ?? tierThresholds[tierThresholds.length - 1];

  return {
    assessmentVersion: PLACEMENT_ASSESSMENT_VERSION,
    scoringVersion: PLACEMENT_SCORING_VERSION,
    answeredCount,
    invalidResponseCount,
    isComplete: answeredCount === questions.length && invalidResponseCount === 0,
    totalQuestions: questions.length,
    totalCorrect: [...answerMap].reduce((total, [questionId, optionId]) => {
      const question = questionMap.get(questionId);
      return total + (question?.options.some((option) => option.id === optionId && option.isCorrect) ? 1 : 0);
    }, 0),
    categoryScores,
    overallPercent,
    recommendedTier,
  };
};

export const placementCategoryFocus: Readonly<Record<PlacementCategory, PlacementCategoryFocus>> = categoryFocus;
