import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UvmPolicyVisualizer from '@/components/visuals/UvmPolicyVisualizer';

describe('UvmPolicyVisualizer', () => {
  it('renders the header and default Print tab', () => {
    render(<UvmPolicyVisualizer />);

    expect(screen.getByText('UVM Policy Classes')).toBeInTheDocument();
    // Print tab should be active by default and show printer content
    expect(screen.getByText('Print')).toBeInTheDocument();
    expect(screen.getByText(/uvm_printer/)).toBeInTheDocument();
  });

  it('switches between all five tabs', () => {
    render(<UvmPolicyVisualizer />);

    // Click the Compare tab (first button matching /Compare/)
    const compareBtns = screen.getAllByRole('button', { name: /Compare/i });
    fireEvent.click(compareBtns[0]);
    expect(screen.getByText(/uvm_comparer/)).toBeInTheDocument();

    // Switch to Pack
    fireEvent.click(screen.getByRole('button', { name: /Pack/i }));
    expect(screen.getByText(/uvm_packer/)).toBeInTheDocument();

    // Switch to Record
    fireEvent.click(screen.getByRole('button', { name: /Record/i }));
    expect(screen.getByText(/uvm_recorder/)).toBeInTheDocument();

    // Switch to Copy (first button matching /Copy/)
    const copyBtns = screen.getAllByRole('button', { name: /Copy/i });
    fireEvent.click(copyBtns[0]);
    expect(screen.getByText(/uvm_copier/)).toBeInTheDocument();
  });

  it('Compare tab shows diff highlighting after clicking Compare button', () => {
    render(<UvmPolicyVisualizer />);

    // Navigate to Compare tab, then click the action button
    const compareBtns = screen.getAllByRole('button', { name: /Compare/i });
    fireEvent.click(compareBtns[0]); // tab button

    // The action button is the second "Compare" button
    const actionBtns = screen.getAllByRole('button', { name: /Compare/i });
    fireEvent.click(actionBtns[actionBtns.length - 1]); // action button

    expect(screen.getByText(/MISMATCH/)).toBeInTheDocument();
    expect(screen.getByText(/2 field/)).toBeInTheDocument();
  });

  it('Print tab switches between table, tree, and line formats', () => {
    render(<UvmPolicyVisualizer />);

    // Default is table format — shows a table header
    expect(screen.getByText('Field')).toBeInTheDocument();

    // Switch to tree
    fireEvent.click(screen.getByRole('button', { name: /^tree$/i }));
    const treeMatches = screen.getAllByText(/my_packet/);
    expect(treeMatches.length).toBeGreaterThanOrEqual(1);

    // Switch to line
    fireEvent.click(screen.getByRole('button', { name: /^line$/i }));
    expect(screen.getByText(/my_packet:/)).toBeInTheDocument();
  });

  it('Copy tab shows deep copy result with new handle after clicking copy', () => {
    render(<UvmPolicyVisualizer />);

    // Navigate to Copy tab
    const copyBtns = screen.getAllByRole('button', { name: /Copy/i });
    fireEvent.click(copyBtns[0]); // tab button

    // Click the action button
    fireEvent.click(screen.getByRole('button', { name: /pkt_copy\.copy/i }));

    expect(screen.getByText(/Deep Copy/)).toBeInTheDocument();
    // Use getAllByText since "new clone" appears in both the handle and tooltip
    const cloneTexts = screen.getAllByText(/new clone/);
    expect(cloneTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('Pack tab shows bitstream layout with total bits', () => {
    render(<UvmPolicyVisualizer />);

    fireEvent.click(screen.getByRole('button', { name: /Pack/i }));

    // Should show total bits (32+32+1+8 = 73)
    expect(screen.getByText(/73 bits/)).toBeInTheDocument();
  });
});
