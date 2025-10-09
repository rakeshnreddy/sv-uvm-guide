import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DataTypeExplorer from '@/components/curriculum/f2/DataTypeExplorer';

describe('Curriculum DataTypeExplorer', () => {
  it('shows logic defaults and cycles bit states', async () => {
    render(<DataTypeExplorer />);

    expect(screen.getByTestId('property-family')).toHaveTextContent('Variable');
    expect(screen.getByTestId('property-value-system')).toHaveTextContent('4-state');
    expect(screen.getByTestId('hardware-label')).toHaveTextContent('Flip-flop');

    const firstBit = screen.getByTestId('bit-0');
    expect(firstBit).toHaveTextContent('X');
    fireEvent.click(firstBit);
    await waitFor(() => expect(screen.getByTestId('bit-0')).toHaveTextContent('Z'));
  });

  it('switches to wire and updates properties and defaults', async () => {
    render(<DataTypeExplorer />);

    fireEvent.click(screen.getByTestId('select-wire'));

    await waitFor(() => expect(screen.getByTestId('property-family')).toHaveTextContent('Net'));
    expect(screen.getByTestId('property-value-system')).toHaveTextContent('4-state');
    expect(screen.getByTestId('hardware-label')).toHaveTextContent('interconnect');
    expect(screen.getByTestId('bit-0')).toHaveTextContent('Z');
    expect(screen.getByTestId('lrm-snippet').textContent).toMatch(/net type/i);
  });

  it('switches to bit type for 2-state arithmetic', async () => {
    render(<DataTypeExplorer />);

    fireEvent.click(screen.getByTestId('select-bit'));

    await waitFor(() => expect(screen.getByTestId('property-value-system')).toHaveTextContent('2-state'));
    expect(screen.getByTestId('property-signedness')).toHaveTextContent('Unsigned packed array');

    const firstBit = screen.getByTestId('bit-0');
    expect(firstBit).toHaveTextContent('0');
    fireEvent.click(firstBit);
    await waitFor(() => expect(screen.getByTestId('bit-0')).toHaveTextContent('1'));
  });
});
