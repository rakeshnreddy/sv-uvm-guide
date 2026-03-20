import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UvmContainerVisualizer from '@/components/visuals/UvmContainerVisualizer';

describe('UvmContainerVisualizer', () => {
  it('renders header and default uvm_pool view', () => {
    render(<UvmContainerVisualizer />);

    expect(screen.getByText('UVM vs Native SV Containers')).toBeInTheDocument();
    expect(screen.getAllByText(/uvm_pool/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Global singleton/i).length).toBeGreaterThanOrEqual(1);
  });

  it('switches between all four container tabs', () => {
    render(<UvmContainerVisualizer />);

    // Switch to uvm_queue
    fireEvent.click(screen.getByRole('button', { name: /uvm_queue/i }));
    expect(screen.getByText(/parameterized FIFO/i)).toBeInTheDocument();

    // Switch to SV Associative Array
    fireEvent.click(screen.getByRole('button', { name: /SV Associative Array/i }));
    expect(screen.getByText(/Hash-map semantics/i)).toBeInTheDocument();

    // Switch to SV Queue
    const svQueueBtns = screen.getAllByRole('button', { name: /SV Queue/i });
    fireEvent.click(svQueueBtns[0]);
    expect(screen.getByText(/double-ended/i)).toBeInTheDocument();
  });

  it('shows comparison table when Compare All is clicked', () => {
    render(<UvmContainerVisualizer />);

    fireEvent.click(screen.getByRole('button', { name: /Compare All/i }));

    // Comparison table should show feature rows
    expect(screen.getByText('Global access')).toBeInTheDocument();
    expect(screen.getByText('Factory support')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
  });

  it('interactive demo adds and searches entries', () => {
    render(<UvmContainerVisualizer />);

    // Default entries should be visible
    expect(screen.getByText('status')).toBeInTheDocument();
    expect(screen.getByText('PASS')).toBeInTheDocument();

    // Add a new entry
    const inputs = screen.getAllByRole('textbox');
    const keyInput = inputs.find(i => i.getAttribute('placeholder') === 'key')!;
    const valInput = inputs.find(i => i.getAttribute('placeholder') === 'value')!;

    fireEvent.change(keyInput, { target: { value: 'test_key' } });
    fireEvent.change(valInput, { target: { value: 'test_val' } });
    fireEvent.click(screen.getByTitle('Add entry'));

    expect(screen.getByText('test_key')).toBeInTheDocument();
    expect(screen.getByText('test_val')).toBeInTheDocument();
  });

  it('interactive demo searches for existing and missing keys', () => {
    render(<UvmContainerVisualizer />);

    const searchInput = screen.getByPlaceholderText('search key');

    // Search for existing key — result text appears alongside existing entries
    fireEvent.change(searchInput, { target: { value: 'status' } });
    fireEvent.click(screen.getByTitle('Search'));
    // 'PASS' appears both in the entry list and as search result
    const passTexts = screen.getAllByText('PASS');
    expect(passTexts.length).toBeGreaterThanOrEqual(2); // entry + result

    // Search for missing key
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    fireEvent.click(screen.getByTitle('Search'));
    expect(screen.getByText(/Not found/)).toBeInTheDocument();
  });

  it('interactive demo deletes entries', () => {
    render(<UvmContainerVisualizer />);

    // Verify 'PASS' exists before delete
    expect(screen.getAllByText('PASS').length).toBeGreaterThanOrEqual(1);

    // Delete the first entry via its trash button
    const trashIcons = document.querySelectorAll('.lucide-trash-2');
    expect(trashIcons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(trashIcons[0].closest('button')!);

    // 'PASS' should no longer appear, but 'count' should remain
    expect(screen.queryByText('PASS')).not.toBeInTheDocument();
    expect(screen.getByText('count')).toBeInTheDocument();
  });
});
