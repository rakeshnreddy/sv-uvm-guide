import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import ScoreboardConnectorExercise from '../../src/components/exercises/ScoreboardConnectorExercise';

describe('ScoreboardConnectorExercise', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('scores 100% when both sinks are wired', async () => {
    const { container } = render(<ScoreboardConnectorExercise />);
    const monitorPort = screen.getByLabelText(/Port trans_ap on UVM Monitor/i);
    const scoreboardPort = screen.getByLabelText(/Port actual_trans_imp on Scoreboard/i);
    const coveragePort = screen.getByLabelText(/Port observed_trans_imp on Coverage Collector/i);
    await userEvent.click(monitorPort);
    await userEvent.click(scoreboardPort);
    await userEvent.click(monitorPort);
    await userEvent.click(coveragePort);
    const checkButton = screen.getByRole('button', { name: /Check Connections/i });
    await userEvent.click(checkButton);
    const lines = container.querySelectorAll('line[stroke="rgb(34 197 94)"]');
    expect(lines.length).toBe(2);
    const status = await screen.findByRole('status');
    expect(within(status).getByText(/Score: 100%/i)).toBeInTheDocument();
    expect(within(status).getByText(/The scoreboard and coverage collector both receive the monitor stream/i)).toBeInTheDocument();
  });

  it('prevents connecting ports of the same type', async () => {
    const { container } = render(<ScoreboardConnectorExercise />);
    const scoreboardPort = screen.getByLabelText(/Port actual_trans_imp on Scoreboard/i);
    const coveragePort = screen.getByLabelText(/Port observed_trans_imp on Coverage Collector/i);
    await userEvent.click(scoreboardPort);
    await userEvent.click(coveragePort);
    expect(await screen.findByText(/analysis_port to an analysis_imp/i)).toBeInTheDocument();
    const lines = container.querySelectorAll('line[stroke="rgb(34 197 94)"]');
    expect(lines.length).toBe(0);
  });

  it('supports keyboard-only connections', async () => {
    render(<ScoreboardConnectorExercise />);
    const monitorPort = screen.getByLabelText(/Port trans_ap on UVM Monitor/i);
    const scoreboardPort = screen.getByLabelText(/Port actual_trans_imp on Scoreboard/i);
    const coveragePort = screen.getByLabelText(/Port observed_trans_imp on Coverage Collector/i);

    monitorPort.focus();
    await userEvent.keyboard('{Enter}');
    scoreboardPort.focus();
    await userEvent.keyboard('{Enter}');
    monitorPort.focus();
    await userEvent.keyboard('{Enter}');
    coveragePort.focus();
    await userEvent.keyboard('{Enter}');

    await userEvent.click(screen.getByRole('button', { name: /Check Connections/i }));
    const statuses = await screen.findAllByRole('status');
    const feedback = statuses.find(node => within(node).queryByText(/Score: 100%/i));
    expect(feedback, 'feedback status region').toBeTruthy();
  });
});
