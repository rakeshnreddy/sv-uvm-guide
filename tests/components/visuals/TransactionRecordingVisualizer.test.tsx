import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TransactionRecordingVisualizer from '@/components/visuals/TransactionRecordingVisualizer';

describe('TransactionRecordingVisualizer', () => {
  it('renders correctly and has interactive elements', () => {
    render(<TransactionRecordingVisualizer />);
    
    // Title
    expect(screen.getByText('Transaction Recording Flow')).toBeInTheDocument();
    
    // Buttons
    const writeBtn = screen.getByText('Send WRITE');
    const readBtn = screen.getByText('Send READ');
    expect(writeBtn).toBeInTheDocument();
    expect(readBtn).toBeInTheDocument();
    
    // Start a transaction
    fireEvent.click(writeBtn);
    
    // Check that uvm_driver and uvm_recorder are visible
    expect(screen.getByText('uvm_driver #(axi_transfer)')).toBeInTheDocument();
    expect(screen.getByText('uvm_recorder / uvm_tr_stream')).toBeInTheDocument();
  });
});
