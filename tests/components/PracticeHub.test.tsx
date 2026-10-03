import React from 'react';
import { render, screen } from '@testing-library/react';
import PracticeHub from '@/components/practice/PracticeHub';

describe('PracticeHub', () => {
  it('renders hero section with title and description', () => {
    render(<PracticeHub />);

    expect(
      screen.getByRole('heading', { level: 1, name: /practice hub/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/sharpen your systemverilog/i)).toBeInTheDocument();
  });

  it('groups items by category and renders cards', () => {
    render(<PracticeHub />);

    const exerciseHeading = screen.getByRole('heading', {
      level: 2,
      name: /exercise/i,
    });
    expect(exerciseHeading).toBeInTheDocument();

    const cardTitles = screen.getAllByRole('heading', { level: 3 });
    expect(cardTitles.length).toBeGreaterThan(0);
  });

  it('never links coming-soon labs (their routes 404) and lists available labs first', () => {
    render(<PracticeHub />);
    const comingSoon = screen.getAllByText(/coming soon/i);
    expect(comingSoon.length).toBeGreaterThan(0);
    comingSoon.forEach((badge) => expect(badge.closest('a')).toBeNull());
    const labLinks = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/practice/lab/'));
    expect(labLinks.length).toBeGreaterThan(0);
    labLinks.forEach((a) => expect(a).toHaveTextContent(/available/i));
  });
});
