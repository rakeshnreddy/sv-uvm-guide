import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ScoreboardConnectorExercise from '../../src/components/exercises/ScoreboardConnectorExercise';

describe('ScoreboardConnectorExercise component', () => {
  it('renders ports with hover accent fill class', () => {
    const { getAllByLabelText, asFragment } = render(<ScoreboardConnectorExercise />);
    const ports = getAllByLabelText(/Port .* on .*/);
    for (const port of ports) {
      expect(port).toHaveClass('hover:fill-[hsl(var(--accent))]');
    }
    expect(asFragment()).toMatchSnapshot();
  });
});
