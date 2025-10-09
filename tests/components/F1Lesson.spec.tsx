import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as React from 'react';
vi.stubGlobal('React', React);

vi.mock('next/image', () => ({ __esModule: true, default: (props: any) => {
  const { src, alt, fill: _fill, priority: _priority, ...rest } = props;
  return <img src={src} alt={alt} {...rest} />;
}}));

vi.mock('embla-carousel-react', () => {
  const mockApi = {
    on: vi.fn(),
    off: vi.fn(),
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
    scrollTo: vi.fn(),
    selectedScrollSnap: () => 0,
  };
  const viewportRef = (_node: HTMLElement | null) => {};
  return {
    __esModule: true,
    default: () => [viewportRef, mockApi],
  };
});

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    useInView: () => true,
  };
});

afterEach(() => {
  cleanup();
});

import InteractiveCostOfBugGraph from '@/components/curriculum/f1/InteractiveCostOfBugGraph';
import HallOfShameCarousel from '@/components/curriculum/f1/HallOfShameCarousel';
import VerificationMethodologiesDiagram from '@/components/curriculum/f1/VerificationMethodologiesDiagram';
import FirstBugHuntGame from '@/components/curriculum/f1/FirstBugHuntGame';

describe('F1 lesson interactive components', () => {
  it('InteractiveCostOfBugGraph highlights the specification stage by default', () => {
    render(<InteractiveCostOfBugGraph />);
    expect(screen.getByText(/Estimated Impact/i)).toBeInTheDocument();
    const currentStageBlock = screen.getByText(/Current Stage/i).parentElement;
    expect(currentStageBlock).not.toBeNull();
    expect(currentStageBlock).toHaveTextContent('Specification');
    expect(screen.getByText('$1')).toBeInTheDocument();
  });

  it('HallOfShameCarousel renders incident details', () => {
    render(
      <HallOfShameCarousel
        items={[
          {
            image: '/visuals/example.svg',
            title: 'Example Bug',
            story: 'A notorious issue that forced a costly respin.',
            impact: 'Large payout and public apology.',
          },
        ]}
      />,
    );

    expect(screen.getByText('The Hall of Shame')).toBeInTheDocument();
    expect(screen.getByText('Example Bug')).toBeInTheDocument();
    expect(screen.getByText('Large payout and public apology.')).toBeInTheDocument();
  });

  it('VerificationMethodologiesDiagram displays tooltips for the flow', () => {
    render(<VerificationMethodologiesDiagram />);
    expect(screen.getAllByText(/Specification/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/RTL/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Gate-level view optimized for silicon/i)).toBeInTheDocument();
  });

  it('FirstBugHuntGame rewards the learner after identifying the bug', async () => {
    render(<FirstBugHuntGame />);
    const bugButton = screen.getByLabelText(/Wraps early at 6/i);
    fireEvent.click(bugButton);
    await waitFor(() => expect(screen.getByText(/Success!/i)).toBeInTheDocument());
    expect(screen.getByText(/Bug Hunter Badge Unlocked/i)).toBeInTheDocument();
  });
});
