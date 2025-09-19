import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import UvmPhaseSorterExercise, { uvmPhases, shuffleArray } from '../../src/components/exercises/UvmPhaseSorterExercise';

describe('UvmPhaseSorterExercise', () => {
  it('detects correct sequence', async () => {
    render(<UvmPhaseSorterExercise initialItems={uvmPhases} />);
    const button = screen.getByRole('button', { name: /check order/i });
    await userEvent.click(button);
    const statuses = await screen.findAllByRole('status');
    const feedback = statuses.find(node => within(node).queryByText(/Score:/i));
    expect(feedback, 'feedback status region').toBeTruthy();
    if (!feedback) return;
    expect(within(feedback).getByText(/Score: 100%/i)).toBeInTheDocument();
    expect(within(feedback).getByText(/Every phase falls into place/i)).toBeInTheDocument();
  });

  it('detects incorrect sequence', async () => {
    let shuffled = shuffleArray(uvmPhases);
    while (shuffled.every((p, i) => p.id === uvmPhases[i].id)) {
      shuffled = shuffleArray(uvmPhases);
    }
    render(<UvmPhaseSorterExercise initialItems={shuffled} />);
    const button = screen.getByRole('button', { name: /check order/i });
    await userEvent.click(button);
    const statuses = await screen.findAllByRole('status');
    const feedback = statuses.find(node => within(node).queryByText(/Score:/i));
    expect(feedback, 'feedback status region').toBeTruthy();
    if (!feedback) return;
    expect(within(feedback).getByText(/A few phases are still out of order/i)).toBeInTheDocument();
  });
});
