import { describe, it, expect } from 'vitest';
import { checkAgentComponents, Item } from '@/components/exercises/UvmAgentBuilderExercise';

describe('checkAgentComponents', () => {
  it('warns when required components are missing', () => {
    const agent: Item[] = [{ id: 'sequencer', name: 'Sequencer' }];
    const result = checkAgentComponents(agent);
    expect(result.warnings).toContain('Missing components: Driver, Monitor');
  });

  it('warns when components are out of order', () => {
    const agent: Item[] = [
      { id: 'driver', name: 'Driver' },
      { id: 'sequencer', name: 'Sequencer' },
      { id: 'monitor', name: 'Monitor' },
    ];
    const result = checkAgentComponents(agent);
    expect(result.warnings).toContain('Components are not in the correct order.');
  });
});
