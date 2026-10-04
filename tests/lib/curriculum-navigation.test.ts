import { describe, expect, it } from 'vitest';
import { curriculumData, findPrevNextTopics, findSectionBySlug, moduleHref } from '@/lib/curriculum-data';

const at = (tier: string, module: string, lesson = 'index') => [tier, module, lesson];
const nextOf = (tier: string, module: string, lesson = 'index') => findPrevNextTopics(at(tier, module, lesson)).next?.slug;
const prevOf = (tier: string, module: string, lesson = 'index') => findPrevNextTopics(at(tier, module, lesson)).prev?.slug;

describe('navigation order follows the curriculum manifest', () => {
  it('orders tiers T1 to T4 and modules pedagogically, not alphabetically', () => {
    expect(curriculumData.map((t) => t.slug)).toEqual(['T1_Foundational', 'T2_Intermediate', 'T3_Advanced', 'T4_Expert']);
    const t3 = curriculumData[2].sections.map((s) => s.slug.split('_')[0]);
    // AMBA intro before AHB and AXI; bridges and coherency after AXI.
    expect(t3.indexOf('B-AMBA-1')).toBeLessThan(t3.indexOf('B-AHB-1'));
    expect(t3.indexOf('B-AXI-6')).toBeLessThan(t3.indexOf('B-AMBA-F1'));
    // Scoreboards come first in the T3 UVM block; RAL follows the environment block.
    expect(t3[0]).toBe('A-UVM-6');
    expect(t3.indexOf('A-UVM-8')).toBeLessThan(t3.indexOf('A-UVM-4A'));
    const t4 = curriculumData[3].sections.map((s) => s.slug.split('_')[0]);
    expect(t4[0]).toBe('E-DBG-1');
  });

  it('orders sub-lessons by the manifest (I-UVM-3B handshake first, its lab last)', () => {
    const m = curriculumData[1].sections.find((s) => s.slug.startsWith('I-UVM-3B'))!;
    expect(m.topics.map((t) => t.slug)).toEqual([
      'index', 'sequencer-driver-handshake', 'sequence-arbitration', 'sequence-libraries', 'layered-sequences',
      'virtual-sequences', 'uvm-virtual-sequencer', 'interrupt-handling', 'coordinated-attack-lab',
    ]);
  });

  it('keeps the release-pinned adjacencies', () => {
    expect(nextOf('T2_Intermediate', 'I-UVM-3B_Advanced_Sequencing_and_Layering', 'sequence-arbitration')).toBe(
      'T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-libraries',
    );
    expect(nextOf('T4_Expert', 'E-PSS-1_Portable_Stimulus_Standard')).toBe('T4_Expert/E-PWR-1_Power_Aware_Verification/index');
    expect(prevOf('T4_Expert', 'E-PWR-1_Power_Aware_Verification')).toBe('T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index');
  });

  it('skips electives on the core path, while electives return to it', () => {
    // I-UVM-6 is the last core T2 lesson; I-SV-8 (UPF) is a T2 elective.
    expect(nextOf('T2_Intermediate', 'I-UVM-6_UVM_Recording_Classes')).toBe('T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index');
    expect(nextOf('T2_Intermediate', 'I-SV-8_Power_Intent_and_UPF')).toBe('T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index');
    expect(prevOf('T3_Advanced', 'A-UVM-6_Scoreboards_and_Reference_Models')).toBe('T2_Intermediate/I-UVM-6_UVM_Recording_Classes/index');
    // Inside a module every sub-lesson is visited.
    expect(nextOf('T2_Intermediate', 'I-SV-1_OOP')).toBe('T2_Intermediate/I-SV-1_OOP/constructors');
  });

  it('exposes manifest metadata and canonical module links', () => {
    const pwr = findSectionBySlug(at('T4_Expert', 'E-PWR-1_Power_Aware_Verification'));
    expect(pwr?.track).toBe('core');
    expect(pwr?.prerequisites).toContain('I-SV-8_Power_Intent_and_UPF');
    expect(findSectionBySlug(at('T2_Intermediate', 'I-SV-8_Power_Intent_and_UPF'))?.track).toBe('elective');
    expect(moduleHref('F2B_Dynamic_Structures')).toBe('/curriculum/T1_Foundational/F2B_Dynamic_Structures/index');
    expect(moduleHref('nope')).toBeUndefined();
  });
});
