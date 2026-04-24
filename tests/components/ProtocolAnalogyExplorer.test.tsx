import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProtocolAnalogyExplorer } from '../../src/components/visualizers/ProtocolAnalogyExplorer';

describe('ProtocolAnalogyExplorer', () => {
  it('renders without crashing', () => {
    render(<ProtocolAnalogyExplorer />);
    expect(screen.getByTestId('protocol-analogy-explorer')).toBeInTheDocument();
  });

  it('renders the initial WRITE state correctly', () => {
    render(<ProtocolAnalogyExplorer />);
    
    // Check initial text
    expect(screen.getByText(/Write Transaction:/i)).toBeInTheDocument();
    
    // Step should be 0 of 3
    expect(screen.getByText('Step 0 of 3')).toBeInTheDocument();
  });

  it('progresses through WRITE steps', () => {
    render(<ProtocolAnalogyExplorer />);
    
    const nextButton = screen.getByRole('button', { name: /Next Step/i });
    
    // Step 1
    fireEvent.click(nextButton);
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByText(/1\. AW Channel \(Label\)/i)).toBeInTheDocument();
    
    // Step 2
    fireEvent.click(nextButton);
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByText(/2\. W Channel \(Box\)/i)).toBeInTheDocument();
    
    // Step 3
    fireEvent.click(nextButton);
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.getByText(/3\. B Channel \(Receipt\)/i)).toBeInTheDocument();
    
    // Button should be disabled at the end
    expect(nextButton).toBeDisabled();
  });

  it('switches to READ mode and resets steps', () => {
    render(<ProtocolAnalogyExplorer />);
    
    const readTab = screen.getByRole('button', { name: /Reading Data/i });
    fireEvent.click(readTab);
    
    expect(screen.getByText(/Read Transaction:/i)).toBeInTheDocument();
    expect(screen.getByText('Step 0 of 2')).toBeInTheDocument();
  });

  it('progresses through READ steps', () => {
    render(<ProtocolAnalogyExplorer />);
    
    const readTab = screen.getByRole('button', { name: /Reading Data/i });
    fireEvent.click(readTab);
    
    const nextButton = screen.getByRole('button', { name: /Next Step/i });
    
    // Step 1
    fireEvent.click(nextButton);
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByText(/1\. AR Channel \(Order\)/i)).toBeInTheDocument();
    
    // Step 2
    fireEvent.click(nextButton);
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    expect(screen.getByText(/2\. R Channel \(Box \+ Slip\)/i)).toBeInTheDocument();
    
    // Button should be disabled at the end
    expect(nextButton).toBeDisabled();
  });

  it('resets steps when reset button is clicked', () => {
    render(<ProtocolAnalogyExplorer />);
    
    const nextButton = screen.getByRole('button', { name: /Next Step/i });
    const resetButton = screen.getByRole('button', { name: /Reset/i });
    
    fireEvent.click(nextButton);
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    
    fireEvent.click(resetButton);
    expect(screen.getByText('Step 0 of 3')).toBeInTheDocument();
  });
});
