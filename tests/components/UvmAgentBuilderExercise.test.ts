import { describe, it, expect } from 'vitest';
import {
  checkAgentComponents,
  Item,
} from '@/components/exercises/UvmAgentBuilderExercise';

const seq = { id: 'sequencer', name: 'Sequencer' };
const drv = { id: 'driver', name: 'Driver' };
const mon = { id: 'monitor', name: 'Monitor' };

describe('checkAgentComponents (membership + active/passive, never order)', () => {
  it('warns and lowers score when required components are missing', () => {
    const agent: Item[] = [seq];
    const result = checkAgentComponents(agent);
    expect(result.warnings).toContain('Missing components: Driver, Monitor');
    expect(result.score).toBeLessThan(100);
  });

  it('accepts the three active-agent components in any order', () => {
    expect(checkAgentComponents([drv, seq, mon]).score).toBe(100);
    expect(checkAgentComponents([mon, drv, seq]).warnings).toHaveLength(0);
  });

  it('rejects a driver and sequencer inside a passive agent', () => {
    const result = checkAgentComponents([seq, drv, mon], 'UVM_PASSIVE');
    expect(result.warnings).toContain('Does not belong in this agent: Sequencer, Driver');
    expect(checkAgentComponents([mon], 'UVM_PASSIVE').score).toBe(100);
  });

  it('treats a scoreboard as env-level, not an agent child', () => {
    const result = checkAgentComponents([seq, drv, mon, { id: 'scoreboard', name: 'Scoreboard' }]);
    expect(result.warnings).toContain('Does not belong in this agent: Scoreboard');
  });

  it('accepts the optional config object', () => {
    expect(checkAgentComponents([seq, drv, mon, { id: 'config', name: 'Agent config object' }]).score).toBe(100);
  });
});
