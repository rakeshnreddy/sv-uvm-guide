import { describe, it, expect } from 'vitest';
import { movePhase, evaluatePhaseOrder } from '../../src/components/exercises/UvmPhaseSorterExercise';

describe('UvmPhaseSorterExercise helpers', () => {
  it('moves phases to new positions', () => {
    const items = [
      { id: 'a', name: 'a', correctOrder: 0 },
      { id: 'b', name: 'b', correctOrder: 1 },
      { id: 'c', name: 'c', correctOrder: 2 },
    ];
    const moved = movePhase(items, 'c', 'a');
    expect(moved[0].id).toBe('c');
    expect(moved[1].id).toBe('a');
  });

  it('evaluates whether phases are sorted', () => {
    const ordered = [
      { id: 'a', name: 'a', correctOrder: 0 },
      { id: 'b', name: 'b', correctOrder: 1 },
      { id: 'c', name: 'c', correctOrder: 2 },
    ];
    expect(evaluatePhaseOrder(ordered)).toBe(true);
    const unordered = movePhase(ordered, 'c', 'a');
    expect(evaluatePhaseOrder(unordered)).toBe(false);
  });
});
