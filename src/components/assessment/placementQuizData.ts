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
  totalQuestions: number;
  totalCorrect: number;
  categoryScores: Record<PlacementCategory, CategoryScore>;
  overallPercent: number;
  recommendedTier: PlacementTierRecommendation;
}

export interface PlacementTierRecommendation {
  tier: number;
  label: string;
  summary: string;
  focus: string;
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
      'The scoreboard raises an objection in `run_phase` but never drops it, leaving the test hanging. What is the correct lifecycle for objections in long-running components?',
    category: 'debug',
    difficulty: 'intermediate',
    rationale: 'Pair every `raise_objection` with a matching `drop_objection` once work completes, ideally in a `finally` block.',
    options: [
      { id: 'paired', label: 'Wrap work in raise/drop objection pairs so completion always drops', isCorrect: true },
      { id: 'global', label: 'Escalate to the global phase controller to clear objections', isCorrect: false },
      { id: 'kill', label: 'Use `phase.kill()` on timeout', isCorrect: false },
      { id: 'none', label: 'Avoid objections in scoreboards altogether', isCorrect: false },
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

const tierThresholds: PlacementTierRecommendation[] = [
  {
    tier: 4,
    label: 'Tier 4 • Optimization and Leadership',
    summary: 'You are ready for advanced coverage closure, methodology customization, and mentoring peers.',
    focus: 'Dive into lab series that stress performance tuning and scenario synthesis.',
  },
  {
    tier: 3,
    label: 'Tier 3 • Systems Integration',
    summary: 'Solid fundamentals with room to sharpen complex debug and UVM configuration patterns.',
    focus: 'Prioritize intermediate labs on phasing, factory overrides, and layered sequences.',
  },
  {
    tier: 2,
    label: 'Tier 2 • Guided Ramp-Up',
    summary: 'Core concepts are forming; targeted practice on interfaces, sequences, and coverage will accelerate growth.',
    focus: 'Work through foundational curriculum modules and guided scoreboarding labs.',
  },
  {
    tier: 1,
    label: 'Tier 1 • Foundations First',
    summary: 'Start with the baseline SystemVerilog path to cement syntax, scheduling, and reset-safe patterns.',
    focus: 'Follow the Tier 1 curriculum track before tackling UVM-heavy content.',
  },
];

const categoryFocus: Record<PlacementCategory, { title: string; summary: string; resources: { label: string; href: string }[] }> = {
  foundations: {
    title: 'SystemVerilog Foundations',
    summary: 'Reinforce scheduling semantics, interfaces, and constraint techniques so RTL corner cases stay controlled.',
    resources: [
      { label: 'T1 • SystemVerilog Basics', href: '/curriculum/T1_Foundational/F2_SystemVerilog_Basics/index' },
      { label: 'Interactive • Data Type Explorer', href: '/practice/visualizations/systemverilog-data-types' },
    ],
  },
  methodology: {
    title: 'Verification Methodology',
    summary: 'Deepen your UVM fluency across handshakes, configuration, and agent roles to keep testbenches scalable.',
    resources: [
      { label: 'T2 • UVM Building Blocks', href: '/curriculum/T2_Intermediate/I-UVM-2_Agents_and_Sequences/index' },
      { label: 'Practice • UVM Sequencer Arbitration', href: '/exercises/sequencer-arbitration' },
    ],
  },
  debug: {
    title: 'Debug & Coverage Habits',
    summary: 'Sharpen coverage-driven strategies and failure triage so regressions converge faster.',
    resources: [
      { label: 'T3 • Coverage Closure Playbook', href: '/curriculum/T3_Advanced/A-COV-1_Coverage_Strategies/index' },
      { label: 'Lab • Functional Coverage Analyzer', href: '/practice/visualizations/coverage-analyzer' },
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

  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.optionId]));

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

  const recommendedTier = tierThresholds.find((tier) => overallPercent >= tierCutoff(tier.tier)) ?? tierThresholds[tierThresholds.length - 1];

  return {
    totalQuestions: questions.length,
    totalCorrect: answers.reduce((acc, answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) return acc;
      const option = question.options.find((opt) => opt.id === answer.optionId);
      return option?.isCorrect ? acc + 1 : acc;
    }, 0),
    categoryScores,
    overallPercent,
    recommendedTier,
  };
};

const tierCutoff = (tier: number) => {
  switch (tier) {
    case 4:
      return 0.85;
    case 3:
      return 0.65;
    case 2:
      return 0.4;
    default:
      return 0;
  }
};

export const placementCategoryFocus = categoryFocus;
