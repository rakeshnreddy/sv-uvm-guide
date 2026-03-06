import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import VirtualSequencerExplorer from '@/components/curriculum/interactives/VirtualSequencerExplorer';

describe('VirtualSequencerExplorer', () => {
  it('starts idle and advances through coordination steps', () => {
    render(<VirtualSequencerExplorer />);

    expect(screen.getByRole('heading', { name: 'Virtual Sequencer Explorer' })).toBeVisible();
    expect(screen.getByText(/Step 1 of 5:/)).toBeVisible();
    expect(screen.getByText('Step 1 of 5:')).toHaveTextContent('Idle');
    expect(screen.queryByText('Running pci_seq')).not.toBeInTheDocument();
    expect(screen.queryByText('Running eth_seq')).not.toBeInTheDocument();

    const nextButton = screen.getByRole('button', { name: 'Next Step' });

    fireEvent.click(nextButton);
    expect(screen.getByText(/Step 2 of 5:/)).toBeVisible();
    expect(screen.getByText('Step 2 of 5:')).toHaveTextContent('Start Virtual Sequence');
    expect(screen.getByText('Running body()')).toBeVisible();

    fireEvent.click(nextButton);
    expect(screen.getByText(/Step 3 of 5:/)).toBeVisible();
    expect(screen.getByText('Step 3 of 5:')).toHaveTextContent('Dispatch PCIe');
    expect(screen.getByText('Running pci_seq')).toBeVisible();
    expect(screen.queryByText('Running eth_seq')).not.toBeInTheDocument();

    fireEvent.click(nextButton);
    expect(screen.getByText(/Step 4 of 5:/)).toBeVisible();
    expect(screen.getByText('Step 4 of 5:')).toHaveTextContent('Dispatch Ethernet');
    expect(screen.getByText('Running eth_seq')).toBeVisible();
  });

  it('switches the CTA to Restart at the final step and loops back to idle', () => {
    render(<VirtualSequencerExplorer />);

    const nextButton = screen.getByRole('button', { name: 'Next Step' });

    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    const restartButton = screen.getByRole('button', { name: 'Restart' });
    expect(screen.getByText(/Step 5 of 5:/)).toBeVisible();
    expect(screen.getByText('Step 5 of 5:')).toHaveTextContent('Coordination Complete');

    fireEvent.click(restartButton);
    expect(screen.getByText(/Step 1 of 5:/)).toBeVisible();
    expect(screen.getByText('Step 1 of 5:')).toHaveTextContent('Idle');
    expect(screen.queryByText('Running pci_seq')).not.toBeInTheDocument();
    expect(screen.queryByText('Running eth_seq')).not.toBeInTheDocument();
  });
});
