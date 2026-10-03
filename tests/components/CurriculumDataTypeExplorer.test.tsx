import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import DataTypeExplorer from '@/components/curriculum/f2/DataTypeExplorer';

const selectType = (label: string) => fireEvent.click(screen.getByRole('radio', { name: label }));

describe('Curriculum DataTypeExplorer', () => {
  it('shows logic as a 4-state variable that starts at x and does not claim to be a flip-flop', () => {
    render(<DataTypeExplorer />);
    expect(screen.getByTestId('property-family')).toHaveTextContent('Variable');
    expect(screen.getByTestId('property-value-system')).toHaveTextContent('4-state');
    expect(screen.getByTestId('property-default-value')).toHaveTextContent("4'bxxxx");
    expect(screen.getByTestId('hardware-label')).toHaveTextContent(/None implied/);
    expect(screen.getByTestId('hardware-label')).not.toHaveTextContent(/Flip-flop/i);
    expect(screen.queryByText(/From the LRM/i)).not.toBeInTheDocument();
  });

  it('cycles a bit through 0/1/x/z without losing keyboard focus (buttons are keyed by position)', () => {
    render(<DataTypeExplorer />);
    const bit = screen.getByTestId('bit-0');
    bit.focus();
    expect(bit).toHaveTextContent('x');
    fireEvent.click(bit);
    expect(screen.getByTestId('bit-0')).toHaveTextContent('z');
    expect(screen.getByTestId('bit-0')).toBe(bit);
    expect(document.activeElement).toBe(bit);
  });

  it('draws int as a 32-bit, signed, 2-state type that starts at 0', () => {
    render(<DataTypeExplorer />);
    selectType('int');
    expect(screen.getByTestId('property-width')).toHaveTextContent('32 bits');
    expect(screen.getByTestId('property-signedness')).toHaveTextContent('signed');
    expect(screen.getByTestId('property-value-system')).toHaveTextContent('2-state');
    const bits = within(screen.getByTestId('bit-visualizer')).getAllByRole('button');
    expect(bits).toHaveLength(32);
    expect(screen.getByTestId('type-rule')).not.toHaveTextContent(/promot/i);
  });

  it('2-state bits only cycle between 0 and 1', () => {
    render(<DataTypeExplorer />);
    selectType('bit [3:0]');
    const bit = screen.getByTestId('bit-0');
    expect(bit).toHaveTextContent('0');
    fireEvent.click(bit);
    expect(bit).toHaveTextContent('1');
    fireEvent.click(bit);
    expect(bit).toHaveTextContent('0');
  });

  it("writing 4'b1x0z into bit [3:0] stores 4'b1000 and explains why", () => {
    render(<DataTypeExplorer />);
    selectType('bit [3:0]');
    fireEvent.click(screen.getByRole('button', { name: /Write 4'b1x0z/ }));
    expect(screen.getByTestId('value-readout')).toHaveTextContent("4'b1000");
    expect(screen.getByTestId('last-action-why')).toHaveTextContent(/became 0/);
    expect(screen.getByTestId('last-action-why')).toHaveTextContent(/§6.11.2/);
  });

  it('switches to wire: a net that reads z when undriven and is never written procedurally', () => {
    render(<DataTypeExplorer />);
    selectType('wire [3:0]');
    expect(screen.getByTestId('property-family')).toHaveTextContent('Net');
    expect(screen.getByTestId('bit-0')).toHaveTextContent('z');
    expect(screen.getByText(/never procedural assignments/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Drive 4'b1x0z/ }));
    expect(screen.getByTestId('value-readout')).toHaveTextContent("4'b1x0z");
  });
});
