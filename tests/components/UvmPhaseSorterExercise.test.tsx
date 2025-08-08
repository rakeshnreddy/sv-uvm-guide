import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import UvmPhaseSorterExercise, { uvmPhases, shuffleArray } from '../../src/components/exercises/UvmPhaseSorterExercise';

describe('UvmPhaseSorterExercise', () => {
  it('detects correct sequence', async () => {
    render(<UvmPhaseSorterExercise initialItems={uvmPhases} />);
    const button = screen.getByRole('button', { name: /check order/i });
    await userEvent.click(button);
    expect(await screen.findByText(/correct order/i)).toBeInTheDocument();
  });

  it('detects incorrect sequence', async () => {
    let shuffled = shuffleArray(uvmPhases);
    while (shuffled.every((p, i) => p.id === uvmPhases[i].id)) {
      shuffled = shuffleArray(uvmPhases);
    }
    render(<UvmPhaseSorterExercise initialItems={shuffled} />);
    const button = screen.getByRole('button', { name: /check order/i });
    await userEvent.click(button);
    expect(await screen.findByText(/incorrect order/i)).toBeInTheDocument();
  });
});
