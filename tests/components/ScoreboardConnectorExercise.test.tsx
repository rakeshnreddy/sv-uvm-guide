import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ScoreboardConnectorExercise from '../../src/components/exercises/ScoreboardConnectorExercise';

describe('ScoreboardConnectorExercise', () => {
  beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    (window.alert as any).mockRestore();
  });

  it('creates a connection between compatible ports', async () => {
    const { container } = render(<ScoreboardConnectorExercise />);
    const monitorPort = screen.getByLabelText(/Port trans_ap on UVM Monitor/i);
    const scoreboardPort = screen.getByLabelText(/Port actual_trans_imp on Scoreboard/i);
    await userEvent.click(monitorPort);
    await userEvent.click(scoreboardPort);
    const lines = container.querySelectorAll('line[stroke="hsl(var(--accent))"]');
    expect(lines.length).toBe(1);
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('prevents connecting ports of the same type', async () => {
    const { container } = render(<ScoreboardConnectorExercise />);
    const scoreboardPort = screen.getByLabelText(/Port actual_trans_imp on Scoreboard/i);
    const coveragePort = screen.getByLabelText(/Port observed_trans_imp on Coverage Collector/i);
    await userEvent.click(scoreboardPort);
    await userEvent.click(coveragePort);
    expect(window.alert).toHaveBeenCalled();
    const lines = container.querySelectorAll('line[stroke="hsl(var(--accent))"]');
    expect(lines.length).toBe(0);
  });
});
