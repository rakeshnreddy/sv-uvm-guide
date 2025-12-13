import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OperatorDrill from '@/components/curriculum/f2/OperatorDrill';

describe('OperatorDrill', () => {
  it('cycles through operator scenarios and updates evaluation text', () => {
    render(<OperatorDrill />);

    expect(screen.getByTestId('drill-expression').textContent).toMatch(/Bitwise vs Logical/);
    expect(screen.getByTestId('drill-result').textContent).toContain('a & b');

    fireEvent.click(screen.getByRole('tab', { name: /Case Equality/i }));
    expect(screen.getByTestId('drill-expression').textContent).toMatch(/Case Equality/);
    expect(screen.getByTestId('drill-result').textContent).toContain('a === b');

    fireEvent.click(screen.getByRole('tab', { name: /Streaming Concatenation/i }));
    expect(screen.getByTestId('drill-result').textContent).toContain('16\'hA55A');
  });
});
