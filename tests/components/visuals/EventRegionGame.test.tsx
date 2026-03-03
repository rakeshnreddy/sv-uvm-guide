import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EventRegionGame from '@/components/visuals/EventRegionGame';

describe('EventRegionGame', () => {
  it('starts from the intro state and advances after a correct answer', () => {
    render(<EventRegionGame />);

    expect(screen.getByText('Event Region Scheduler')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /start challenge/i }));

    expect(screen.getByText('Snippet 1/6')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Active Execute Now/i }));

    expect(screen.getByText('Correct!')).toBeInTheDocument();
    expect(screen.getByText(/blocking assignments execute immediately/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Snippet 2/6')).toBeInTheDocument();
  });
});
