import { describe, it, expect } from 'vitest';
import {
  checkAgentComponents,
  Item,
} from '@/components/exercises/UvmAgentBuilderExercise';

describe('checkAgentComponents', () => {
  it('warns and lowers score when required components are missing', () => {
    const agent: Item[] = [{ id: 'sequencer', name: 'Sequencer' }];
    const result = checkAgentComponents(agent);
    expect(result.warnings).toContain('Missing components: Driver, Monitor');
    expect(result.score).toBe(33);
  });

  it('warns and lowers score when components are out of order', () => {
    const agent: Item[] = [
      { id: 'driver', name: 'Driver' },
      { id: 'sequencer', name: 'Sequencer' },
      { id: 'monitor', name: 'Monitor' },
    ];
    const result = checkAgentComponents(agent);
    expect(result.warnings).toContain('Components are not in the correct order.');
    expect(result.score).toBe(33);
  });

  it('returns full score with no warnings when agent is correct', () => {
    const agent: Item[] = [
      { id: 'sequencer', name: 'Sequencer' },
      { id: 'driver', name: 'Driver' },
      { id: 'monitor', name: 'Monitor' },
    ];
    const result = checkAgentComponents(agent);
    expect(result.warnings).toHaveLength(0);
    expect(result.score).toBe(100);
  });
});
