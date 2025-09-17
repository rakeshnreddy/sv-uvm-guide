import React from 'react';
import { render, screen } from '@testing-library/react';
import PracticeHub from '@/components/practice/PracticeHub';

describe('PracticeHub', () => {
  it('renders hero section with title and description', () => {
    render(<PracticeHub />);

    expect(
      screen.getByRole('heading', { level: 1, name: /practice hub/i }),
    ).toBeTruthy();
    expect(screen.getByText(/sharpen your systemverilog/i)).toBeTruthy();
  });

  it('groups items by category and renders cards', () => {
    render(<PracticeHub />);

    const exerciseHeading = screen.getByRole('heading', {
      level: 2,
      name: /exercise/i,
    });
    expect(exerciseHeading).toBeTruthy();

    const cardTitles = screen.getAllByRole('heading', { level: 3 });
    expect(cardTitles.length).toBeGreaterThan(0);
  });
});
