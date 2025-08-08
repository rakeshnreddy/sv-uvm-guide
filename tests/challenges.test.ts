import { describe, it, expect } from 'vitest';
import { challenges } from '@/lib/challenges';

function getSolution(id: string) {
  const challenge = challenges.find((c) => c.id === id);
  if (!challenge) throw new Error('Challenge not found');
  return challenge.solution;
}

describe('challenge solutions', () => {
  it('add-two sums numbers correctly', () => {
    const addTwo = getSolution('add-two');
    expect(addTwo(1, 2)).toBe(3);
    expect(addTwo(-1, 1)).toBe(0);
  });

  it('factorial handles non-negative integers and rejects negatives', () => {
    const factorial = getSolution('factorial');
    expect(factorial(0)).toBe(1);
    expect(factorial(5)).toBe(120);
    expect(() => factorial(-1)).toThrow();
  });

  it('fibonacci computes sequence and rejects negatives', () => {
    const fibonacci = getSolution('fibonacci');
    expect(fibonacci(0)).toBe(0);
    expect(fibonacci(10)).toBe(55);
    expect(() => fibonacci(-5)).toThrow();
  });
});
