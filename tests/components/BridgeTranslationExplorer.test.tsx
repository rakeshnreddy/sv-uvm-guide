import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { BridgeTranslationExplorer } from '../../src/components/visualizers/BridgeTranslationExplorer';

describe('BridgeTranslationExplorer', () => {
  it('renders without crashing', () => {
    render(<BridgeTranslationExplorer />);
    expect(screen.getByTestId('bridge-translation-explorer')).toBeDefined();
  });

  it('displays the component title', () => {
    render(<BridgeTranslationExplorer />);
    expect(screen.getByText('Bridge Translation Explorer')).toBeDefined();
  });

  it('renders all 6 scenario buttons', () => {
    render(<BridgeTranslationExplorer />);
    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`scenario-btn-${i}`)).toBeDefined();
    }
  });

  it('defaults to the 4KB boundary split scenario with split indicator', () => {
    render(<BridgeTranslationExplorer />);
    // The 4KB boundary scenario should show a split indicator text
    const container = screen.getByTestId('bridge-translation-explorer');
    expect(container.textContent).toContain('SPLIT');
  });

  it('switches to direct translation when clicking Simple Write', () => {
    render(<BridgeTranslationExplorer />);
    // Click the "Simple Write" scenario (index 0)
    fireEvent.click(screen.getByTestId('scenario-btn-0'));
    // Should show "Direct Translation" instead of SPLIT
    const directText = screen.getByText((content) => content.includes('Direct Translation'));
    expect(directText).toBeDefined();
  });

  it('shows two AXI bursts for the 4KB boundary split scenario', () => {
    render(<BridgeTranslationExplorer />);
    // Default scenario (index 1) splits into 2 bursts
    const container = screen.getByTestId('axi-bursts-container');
    expect(container.textContent).toContain('AXI Burst 1');
    expect(container.textContent).toContain('AXI Burst 2');
  });

  it('shows one AXI burst for the simple write scenario', () => {
    render(<BridgeTranslationExplorer />);
    fireEvent.click(screen.getByTestId('scenario-btn-0'));
    // Should have "AXI Burst 1" but NOT "AXI Burst 2"
    const container = screen.getByTestId('axi-bursts-container');
    expect(container.textContent).toContain('AXI Burst 1');
    expect(container.textContent).not.toContain('AXI Burst 2');
  });

  it('renders the animate and reset buttons', () => {
    render(<BridgeTranslationExplorer />);
    expect(screen.getByTestId('animate-btn')).toBeDefined();
    expect(screen.getByTestId('reset-btn')).toBeDefined();
  });

  it('renders animation step log lines', () => {
    render(<BridgeTranslationExplorer />);
    const log = screen.getByTestId('anim-log');
    expect(log.children.length).toBeGreaterThan(0);
  });

  it('shows WRAP burst type for WRAP8 scenario', () => {
    render(<BridgeTranslationExplorer />);
    // Click the WRAP8 scenario (index 3)
    fireEvent.click(screen.getByTestId('scenario-btn-3'));
    // Should show WRAP burst label in the burst container
    const container = screen.getByTestId('axi-bursts-container');
    expect(container.textContent).toContain('WRAP');
  });

  it('shows AHB beat count in summary stats', () => {
    render(<BridgeTranslationExplorer />);
    // The default scenario (4KB split) has 8 beats — summary stat should show it
    // Use getAllByText since "8" may appear multiple places
    const elements = screen.getAllByText('8');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('reset button is clickable without errors', () => {
    render(<BridgeTranslationExplorer />);
    const resetBtn = screen.getByTestId('reset-btn');
    expect(resetBtn).toBeDefined();
    fireEvent.click(resetBtn); // Should not throw
  });

  it('shows correct number of AXI bursts in summary stat', () => {
    render(<BridgeTranslationExplorer />);
    // Default scenario (4KB split) should show 2 bursts
    const burstCountElements = screen.getAllByText('2');
    expect(burstCountElements.length).toBeGreaterThan(0);
  });
});
