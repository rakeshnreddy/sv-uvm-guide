import { resolveComponentLink } from './uvm-link-map';

export type VerificationStackLink = {
  id: string;
  title: string;
  description: string;
  href: string;
  componentId?: string;
  stage?: string;
  focusAreas?: string[];
  next?: string[];
  insight?: string;
  tip?: string;
};

export type VerificationStackLinkSeed = {
  id: string;
  title: string;
  description: string;
  componentId?: string;
  href?: string;
  stage?: string;
  focusAreas?: string[];
  next?: string[];
  insight?: string;
  tip?: string;
};

export const verificationStackLinkSeeds: VerificationStackLinkSeed[] = [
  {
    id: 'test',
    componentId: 'test',
    title: 'UVM Test & Component Basics',
    description: 'How tests configure environments and orchestrate the verification flow.',
    stage: 'Test layer',
    focusAreas: [
      'Bootstraps configuration before build/connect phases run',
      'Chooses the top-level sequence or virtual sequencer to launch',
      'Sets factory overrides and analysis connections for downstream components',
    ],
    next: ['env'],
    insight: 'Every scenario originates in a test class that wires overrides, configuration, and starting sequences.',
    tip: 'Keep test constructors lean—push heavy setup into build/connect and reuse shared config objects.',
  },
  {
    id: 'env',
    componentId: 'env',
    title: 'Building UVM Environments',
    description: 'Structure environments, connect agents, and funnel configuration.',
    stage: 'Environment layer',
    focusAreas: [
      'Aggregates agents, scoreboards, and monitors into reusable containers',
      'Propagates configuration objects down the component hierarchy',
      'Exposes virtual sequencers or analysis exports for multi-agent coordination',
    ],
    next: ['agent', 'analysis'],
    insight: 'The environment orchestrates agents and analysis components so tests stay declarative.',
    tip: 'Parameterize environments and hide plumbing details—tests should only toggle config, not wiring.',
  },
  {
    id: 'agent',
    componentId: 'uvm_agent',
    title: 'Agents, Sequencers & Drivers',
    description: 'Generate stimulus, arbitrate sequences, and drive DUT transactions.',
    stage: 'Agent layer',
    focusAreas: [
      'Sequencers arbitrate between test, virtual, and layered sequences',
      'Drivers translate sequence items into interface-level activity',
      'Monitors observe bus activity and publish transactions through analysis ports',
    ],
    next: ['analysis', 'coverage'],
    insight: 'Agents bridge stimulus generation and DUT interaction—active agents drive, passive agents observe.',
    tip: 'Expose monitor analysis ports so scoreboards and coverage collectors subscribe without tight coupling.',
  },
  {
    id: 'analysis',
    componentId: 'scoreboard',
    title: 'Scoreboards & Analysis',
    description: 'Compare expected versus observed behaviour and broadcast analysis data.',
    stage: 'Analysis layer',
    focusAreas: [
      'Scoreboards align expected transactions against monitor outputs',
      'Analysis components fan out data via TLM FIFOs and exports',
      'Subscribers track checks, coverage, and diagnostic metrics',
    ],
    next: ['coverage'],
    insight: 'Analysis nodes transform monitor traffic into pass/fail results and insights for coverage closure.',
    tip: 'Keep subscribers focused so you can mix-and-match them per verification objective.',
  },
  {
    id: 'coverage',
    componentId: 'coverage_collector',
    title: 'Functional Coverage',
    description: 'Track scenario coverage and close verification gaps with intent-driven metrics.',
    stage: 'Closure layer',
    focusAreas: [
      'Covergroups sample transactions from monitors and scoreboards',
      'Cross coverage exposes interaction scenarios and corner cases',
      'Feeds coverage goals back into planning dashboards to steer regressions',
    ],
    insight: 'Coverage shows whether scenarios from the verification plan actually ran—tie bins to plan items.',
    tip: 'Automate sampling through analysis exports so coverage evolves alongside scoreboard checks.',
  },
  {
    id: 'interactive',
    title: 'See the full visualization',
    description: 'Open the interactive diagram when you want a deeper, node-by-node exploration.',
    href: '/practice/visualizations/uvm-architecture',
    stage: 'Interactive diagram',
    insight: 'The interactive view lets you drill into responsibilities without loading heavy animations.',
  },
];

export const verificationStackLinks: VerificationStackLink[] = verificationStackLinkSeeds.map(seed => {
  const resolvedHref =
    seed.href ?? (seed.componentId ? resolveComponentLink(seed.componentId) ?? undefined : undefined);

  if (!resolvedHref && process.env.NODE_ENV !== 'production') {
    console.warn(`[verificationStackLinks] Missing href for ${seed.id}`);
  }

  return {
    id: seed.id,
    title: seed.title,
    description: seed.description,
    href: resolvedHref ?? '#',
    componentId: seed.componentId,
    stage: seed.stage,
    focusAreas: seed.focusAreas,
    next: seed.next,
    insight: seed.insight,
    tip: seed.tip,
  };
});
