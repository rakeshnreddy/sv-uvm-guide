import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ScoreboardConnectorExercise from '../../src/components/exercises/ScoreboardConnectorExercise';

describe('ScoreboardConnectorExercise', () => {
  it('scores correct connections', async () => {
    render(<ScoreboardConnectorExercise />);
    const monitorPort = screen.getByLabelText(/Port trans_ap on UVM Monitor/i);
    const scoreboardPort = screen.getByLabelText(/Port actual_trans_imp on Scoreboard/i);
    const coveragePort = screen.getByLabelText(/Port observed_trans_imp on Coverage Collector/i);

    await userEvent.click(monitorPort);
    await userEvent.click(scoreboardPort);
    await userEvent.click(monitorPort);
    await userEvent.click(coveragePort);

    await userEvent.click(screen.getByRole('button', { name: /check connections/i }));
    await screen.findByText(/You got 2 out of 2 connections correct/i);
  });

  it('warns on invalid connections and gives low score', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<ScoreboardConnectorExercise />);
    const scoreboardPort = screen.getByLabelText(/Port actual_trans_imp on Scoreboard/i);
    const coveragePort = screen.getByLabelText(/Port observed_trans_imp on Coverage Collector/i);

    await userEvent.click(scoreboardPort);
    await userEvent.click(coveragePort);
    expect(alertSpy).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /check connections/i }));
    await screen.findByText(/You got 0 out of 2 connections correct/i);

    alertSpy.mockRestore();
  });
});
