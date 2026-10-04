import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlacementQuiz } from '@/components/assessment/PlacementQuiz';
import { placementQuestions, placementTierRecommendations } from '@/components/assessment/placementQuizData';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { resolvePlacementPlan, resolveRoutes, type PlacementPlan } from '@/lib/learning-paths';

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const routes = resolveRoutes(curriculumData, { labs: getAllLabs() });
const plans: Record<number, PlacementPlan> = Object.fromEntries(
  placementTierRecommendations.map((r) => [r.tier, resolvePlacementPlan(r.route, routes)]),
);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function answerAll(pick: (optionIds: { id: string; isCorrect: boolean }[]) => string) {
  fireEvent.click(screen.getByRole('button', { name: 'Start the quiz' }));
  placementQuestions.forEach((question, index) => {
    expect(screen.getByRole('heading', { level: 2, name: new RegExp(`^${question.prompt.slice(0, 20).replace(/[.*+?^${}()|[\]\\`]/g, '.')}`) })).toHaveFocus();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(question.options.length);
    const chosen = pick(question.options);
    fireEvent.click(radios.find((radio) => (radio as HTMLInputElement).value === chosen)!);
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    const next = screen.getByRole('button', { name: index === placementQuestions.length - 1 ? 'See your result' : 'Next question' });
    expect(next).toHaveFocus();
    fireEvent.click(next);
  });
}

describe('PlacementQuiz', () => {
  it('asks each question as a radio group and explains the answer', () => {
    render(<PlacementQuiz plans={plans} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start the quiz' }));
    expect(screen.getByRole('group', { name: 'Choose one answer' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Questions answered' })).toHaveAttribute('aria-valuenow', '0');
    const wrong = placementQuestions[0].options.find((o) => !o.isCorrect)!;
    fireEvent.click(screen.getAllByRole('radio').find((r) => (r as HTMLInputElement).value === wrong.id)!);
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(screen.getByText('Not quite.')).toBeInTheDocument();
    expect(screen.getByText('Your answer')).toBeInTheDocument();
    expect(screen.getByText('Correct answer')).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  });

  it('sends a perfect score to Tier 4 and starts it at E-DBG-1 on the Expert route', () => {
    render(<PlacementQuiz plans={plans} />);
    answerAll((options) => options.find((o) => o.isCorrect)!.id);

    const heading = screen.getByRole('heading', { level: 2, name: 'Start in Tier 4: Expert' });
    expect(heading).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Start at E-DBG-1: Advanced UVM Debug Methodologies' })).toHaveAttribute(
      'href',
      '/curriculum/T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/index',
    );
    expect(screen.getByRole('link', { name: 'See the Expert route' })).toHaveAttribute('href', '/curriculum#route-expert');
    expect(screen.queryByRole('link', { name: 'Go to dashboard' })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/me/assessments', expect.objectContaining({ method: 'POST' }));
  });

  it('sends a zero score to Tier 1 and starts it at F1A, with review prompts for every area', () => {
    render(<PlacementQuiz plans={plans} />);
    answerAll((options) => options.find((o) => !o.isCorrect)!.id);

    expect(screen.getByRole('heading', { level: 2, name: 'Start in Tier 1: Foundations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start at F1A: The Cost of Bugs' })).toHaveAttribute(
      'href',
      '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index',
    );
    const areas = screen.getByRole('region', { name: 'Your score by area' });
    expect(within(areas).getAllByText('Review this area first (under 75%).')).toHaveLength(3);
    for (const link of within(areas).getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/^\/(curriculum\/T\d_|practice\/|exercises\/)/);
    }
  });

  it('lists the skim modules for a Tier 2 start', () => {
    const tier2: Record<number, PlacementPlan> = { ...plans, 4: plans[2], 3: plans[2], 1: plans[2] };
    render(<PlacementQuiz plans={tier2} />);
    answerAll((options) => options.find((o) => o.isCorrect)!.id);
    const skim = screen.getByRole('list', { name: 'Skim first if an answer surprised you' });
    expect(within(skim).getAllByRole('link').map((a) => a.textContent)).toContain('F4C: Synchronizing with Clocking and Program Blocks');
    expect(screen.getByRole('link', { name: 'Start at I-SV-1: Object-Oriented Programming for Verification' })).toBeInTheDocument();
  });

  it('links the dashboard only when tracking is on', () => {
    render(<PlacementQuiz plans={plans} showDashboardLink />);
    answerAll((options) => options.find((o) => o.isCorrect)!.id);
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('returns focus to the start button on retake', () => {
    render(<PlacementQuiz plans={plans} />);
    answerAll((options) => options[0].id);
    fireEvent.click(screen.getByRole('button', { name: 'Retake the quiz' }));
    expect(screen.getByRole('button', { name: 'Start the quiz' })).toHaveFocus();
  });
});
