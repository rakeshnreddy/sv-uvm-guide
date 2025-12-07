import { curriculumData, Module, Topic } from './curriculum-data';

export type TopicStatus = 'complete' | 'in-review' | 'draft';

export interface StatusMetadata {
  status: TopicStatus;
  owner: string;
  lastUpdated: string;
  notes?: string;
}

export interface CurriculumTopicStatus extends StatusMetadata {
  tier: Module['tier'];
  moduleSlug: Module['slug'];
  moduleTitle: Module['title'];
  sectionSlug: string;
  sectionTitle: string;
  topicSlug: Topic['slug'];
  topicTitle: Topic['title'];
  path: string;
}

const tierDefaults: Record<Module['tier'], StatusMetadata> = {
  T1: {
    status: 'in-review',
    owner: 'Content Ops',
    lastUpdated: '2025-09-22',
    notes: 'F2/F3 refreshed—route SME accuracy + accessibility sign-off.',
  },
  T2: {
    status: 'complete',
    owner: 'Content Ops',
    lastUpdated: '2025-09-22',
    notes: 'Template + interactive alignment verified; Tier-1 refresh folded in where relevant.',
  },
  T3: {
    status: 'draft',
    owner: 'Advanced Curriculum',
    lastUpdated: '2025-09-24',
    notes: 'Structure locked; arbitration + factory accuracy toolkits in review awaiting SME scoring sign-off.',
  },
  T4: {
    status: 'draft',
    owner: 'Advanced Curriculum',
    lastUpdated: '2025-08-20',
    notes: 'Requires SME sourcing and performance case studies.',
  },
};

const overrides: Record<string, Partial<StatusMetadata>> = {
  'T1_Foundational/F1A_The_Cost_of_Bugs/index': {
    status: 'complete',
    lastUpdated: '2025-11-23',
    notes: 'Revamped with interactive cost-of-bug graph and carousel.',
  },
  'T1_Foundational/F1B_The_Verification_Mindset/index': {
    status: 'complete',
    lastUpdated: '2025-11-23',
    notes: 'Added verification methodologies diagram and bug hunt game.',
  },
  'T1_Foundational/F1C_Why_SystemVerilog/index': {
    status: 'complete',
    lastUpdated: '2025-11-23',
    notes: 'Includes interactive Verilog vs SV comparison.',
  },
  'T1_Foundational/F2_SystemVerilog_Basics/index': {
    status: 'in-review',
    lastUpdated: '2025-09-23',
    notes: 'Synth vs. verification reference, datatype drill, and digital logic primer folded in; await SME review.',
  },
  'T1_Foundational/F3_Procedural_Constructs/index': {
    status: 'in-review',
    lastUpdated: '2025-09-22',
    notes: 'Event-region timeline + accessibility notes ready for SME pass.',
  },
  'T2_Intermediate/I-UVM-2_Building_TB/index': {
    notes: 'Confirm UVM testbench visualizer embed after cleanup.',
  },
  'T2_Intermediate/I-UVM-3_Sequences/index': {
    notes: 'New arbitration sandbox live—collect learner telemetry.',
  },
  'T2_Intermediate/I-SV-1_OOP/index': {
    status: 'complete',
    lastUpdated: '2025-09-22',
    notes: 'Foundation refresh merged from Tier-1; ready for SME review sign-off.',
  },
  'T3_Advanced/A-UVM-1_Advanced_Sequencing/index': {
    status: 'in-review',
    lastUpdated: '2025-09-23',
    notes: 'Arbitration toolkit + sandbox reference added; log fairness coverage expectations for SME pass.',
  },
  'T3_Advanced/A-UVM-1_Advanced_Sequencing/sequence-arbitration': {
    status: 'in-review',
    lastUpdated: '2025-09-22',
    notes: 'Sandbox links and debugging checklist refreshed.',
  },
  'T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-monitor': {
    status: 'in-review',
    lastUpdated: '2025-09-22',
    notes: 'Monitor best practices now reference Scoreboard Connector exercise.',
  },
  'T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-scoreboard': {
    status: 'in-review',
    lastUpdated: '2025-09-22',
    notes: 'Design checklist tied to interactive wiring drill; SME to confirm patterns.',
  },
  'T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-subscriber': {
    status: 'in-review',
    lastUpdated: '2025-09-22',
    notes: 'Coverage guidance cross-links to Tier-2 refresh.',
  },
  'T3_Advanced/A-UVM-2_The_UVM_Factory_In-Depth/index': {
    status: 'in-review',
    lastUpdated: '2025-09-24',
    notes: 'Accuracy toolkit + override evidence pack drafted; await SME validation of metrics.',
  },
  'T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/hang-lab': {
    status: 'in-review',
    owner: 'Experiences',
    lastUpdated: '2025-09-18',
    notes: 'Interactive hang lab playable; document instrumentation.',
  },
};

export function buildCurriculumStatus(): CurriculumTopicStatus[] {
  const entries: CurriculumTopicStatus[] = [];

  curriculumData.forEach(module => {
    const defaultMeta = tierDefaults[module.tier] ?? {
      status: 'draft' as TopicStatus,
      owner: 'Unassigned',
      lastUpdated: '2025-07-01',
    };

    module.sections.forEach(section => {
      section.topics.forEach(topic => {
        const path = `${module.slug}/${section.slug}/${topic.slug}`;
        const override = overrides[path] ?? {};

        entries.push({
          tier: module.tier,
          moduleSlug: module.slug,
          moduleTitle: module.title,
          sectionSlug: section.slug,
          sectionTitle: section.title,
          topicSlug: topic.slug,
          topicTitle: topic.title,
          path,
          status: override.status ?? defaultMeta.status,
          owner: override.owner ?? defaultMeta.owner,
          lastUpdated: override.lastUpdated ?? defaultMeta.lastUpdated,
          notes: override.notes ?? defaultMeta.notes,
        });
      });
    });
  });

  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

export function summarizeByTier(statusEntries: CurriculumTopicStatus[]) {
  const summary: Record<Module['tier'], { total: number; complete: number; review: number; draft: number }> = {} as any;

  statusEntries.forEach(entry => {
    if (!summary[entry.tier]) {
      summary[entry.tier] = { total: 0, complete: 0, review: 0, draft: 0 };
    }
    summary[entry.tier].total += 1;
    if (entry.status === 'complete') summary[entry.tier].complete += 1;
    if (entry.status === 'in-review') summary[entry.tier].review += 1;
    if (entry.status === 'draft') summary[entry.tier].draft += 1;
  });

  return summary;
}
