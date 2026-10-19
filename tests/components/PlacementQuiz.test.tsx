import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlacementQuiz } from '@/components/assessment/PlacementQuiz';
import {
  PLACEMENT_ASSESSMENT_VERSION,
  PLACEMENT_SCORING_VERSION,
  placementQuestions,
  placementTierRecommendations,
} from '@/components/assessment/placementQuizData';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { __resetStorageForTests } from '@/lib/learner-store/storage';
import { resolvePlacementPlan, resolveRoutes, type PlacementPlan } from '@/lib/learning-paths';
import { ROUTE_STORAGE_KEY } from '@/lib/learning-route-state';

// Where learner records live (GD6: component tests mock the persistence seam, not the flags).
const persistence = vi.hoisted(() => ({ target: 'local' as 'local' | 'server' }));

vi.mock('@/lib/persistence/target', () => ({
  usePersistenceTarget: () => ({ target: persistence.target, ready: true }),
  useAccountSession: () => ({ status: 'disabled', userId: null }),
  useServerFeature: () => false,
}));

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
  __resetStorageForTests();
  __resetRecordsForTests();
  localStorage.clear();
  persistence.target = 'local';
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

interface StoredAttempt {
  assessmentVersion: string;
  scoringVersion: string;
  responses: { questionId: string; optionId: string }[];
  tier: number;
  routeId: string;
  percent: number;
  categories: { id: string; percent: number }[];
  completedAt: number;
}

function storedAttempts(): StoredAttempt[] {
  const raw = localStorage.getItem('sv-uvm-guide:assessments');
  return raw ? JSON.parse(raw).data.placement : [];
}

const correct = (options: { id: string; isCorrect: boolean }[]) => options.find((o) => o.isCorrect)!.id;

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

  it('always links the dashboard', () => {
    render(<PlacementQuiz plans={plans} />);
    expect(screen.getByRole('link', { name: 'dashboard' })).toHaveAttribute('href', '/dashboard');
    answerAll(correct);
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('saves one attempt in this browser and sends nothing while records are local', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_760_000_000_000);
    render(<PlacementQuiz plans={plans} />);
    answerAll(correct);

    const attempts = storedAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toEqual({
      assessmentVersion: PLACEMENT_ASSESSMENT_VERSION,
      scoringVersion: PLACEMENT_SCORING_VERSION,
      responses: placementQuestions.map((q) => ({ questionId: q.id, optionId: correct(q.options) })),
      tier: 4,
      routeId: 'expert',
      percent: 1,
      categories: [
        { id: 'foundations', percent: 1 },
        { id: 'methodology', percent: 1 },
        { id: 'debug', percent: 1 },
      ],
      completedAt: 1_760_000_000_000,
    });
    const activity = JSON.parse(localStorage.getItem('sv-uvm-guide:activity') ?? '{}').data;
    expect(Object.values(activity.days)).toEqual([{ placement: 1 }]);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getAllByRole('status').map((node) => node.textContent).join('')).toBe('');
  });

  it('also sends the attempt to the account, with the existing body, when records live on the server', () => {
    persistence.target = 'server';
    render(<PlacementQuiz plans={plans} />);
    answerAll(correct);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/me/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessmentId: 'placement',
        assessmentVersion: PLACEMENT_ASSESSMENT_VERSION,
        scoringVersion: PLACEMENT_SCORING_VERSION,
        responses: placementQuestions.map((q) => ({ questionId: q.id, optionId: correct(q.options) })),
      }),
    });
    expect(storedAttempts()).toHaveLength(1);
  });

  it('shows the last result after a remount and reopens its plan without saving it again', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 9, 18, 10).getTime());
    const first = render(<PlacementQuiz plans={plans} />);
    expect(screen.queryByTestId('placement-last-result')).not.toBeInTheDocument();
    answerAll(correct);
    first.unmount();

    render(<PlacementQuiz plans={plans} />);
    const last = screen.getByTestId('placement-last-result');
    expect(last).toHaveTextContent(/^Your last result: Tier 4 on the Expert route, 100% · .*2026/);
    fireEvent.click(within(last).getByRole('button', { name: 'See your plan' }));

    expect(screen.getByRole('heading', { level: 2, name: 'Start in Tier 4: Expert' })).toHaveFocus();
    expect(storedAttempts()).toHaveLength(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks for a retake when the saved attempt is from an earlier version of the quiz', () => {
    localStorage.setItem(
      'sv-uvm-guide:assessments',
      JSON.stringify({
        v: 1,
        data: {
          placement: [
            {
              assessmentVersion: 'placement-v1',
              scoringVersion: 'placement-scoring-v1',
              responses: [],
              tier: 2,
              routeId: 'practitioner',
              percent: 0.5,
              categories: [],
              completedAt: 1_000,
            },
          ],
          quizzes: {},
        },
      }),
    );
    render(<PlacementQuiz plans={plans} />);
    expect(screen.getByTestId('placement-last-result')).toHaveTextContent('The quiz changed since your last attempt. Retake it.');
    expect(screen.queryByRole('button', { name: 'See your plan' })).not.toBeInTheDocument();
  });

  const seedCurrentAttempt = (attempt: Partial<StoredAttempt>) =>
    localStorage.setItem(
      'sv-uvm-guide:assessments',
      JSON.stringify({
        v: 1,
        data: {
          placement: [
            {
              assessmentVersion: PLACEMENT_ASSESSMENT_VERSION,
              scoringVersion: PLACEMENT_SCORING_VERSION,
              responses: [],
              tier: 3,
              routeId: 'practitioner',
              percent: 0.6,
              categories: [],
              completedAt: new Date(2026, 9, 17, 10).getTime(),
              ...attempt,
            },
          ],
          quizzes: {},
        },
      }),
    );

  it('shows the saved tier and route without "See your plan" when the saved answers are missing', () => {
    seedCurrentAttempt({ responses: [] });
    render(<PlacementQuiz plans={plans} />);
    const last = screen.getByTestId('placement-last-result');
    expect(last).toHaveTextContent(/^Your last result: Tier 3 on the Practitioner route, 60% · .*2026/);
    expect(last).toHaveTextContent("The full plan for this attempt can't be rebuilt here. Retake the quiz to see one.");
    expect(within(last).queryByRole('button', { name: 'See your plan' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start the quiz' })).toBeInTheDocument();
  });

  it('hides "See your plan" when only some answers were saved', () => {
    const someCorrect = placementQuestions.slice(0, 4).map((q) => ({ questionId: q.id, optionId: correct(q.options) }));
    seedCurrentAttempt({ responses: someCorrect });
    render(<PlacementQuiz plans={plans} />);
    expect(screen.getByTestId('placement-last-result')).toHaveTextContent('Tier 3 on the Practitioner route');
    expect(screen.queryByRole('button', { name: 'See your plan' })).not.toBeInTheDocument();
  });

  it('hides "See your plan" when the saved answers rebuild a different tier than the one saved', () => {
    // Every answer correct rebuilds Tier 4 on the Expert route, not the saved Tier 3.
    const allCorrect = placementQuestions.map((q) => ({ questionId: q.id, optionId: correct(q.options) }));
    seedCurrentAttempt({ responses: allCorrect });
    render(<PlacementQuiz plans={plans} />);
    expect(screen.getByTestId('placement-last-result')).toHaveTextContent('Tier 3 on the Practitioner route');
    expect(screen.queryByRole('button', { name: 'See your plan' })).not.toBeInTheDocument();
  });

  it('follows the recommended route when asked, and confirms it', () => {
    render(<PlacementQuiz plans={plans} />);
    answerAll(correct);
    expect(localStorage.getItem(ROUTE_STORAGE_KEY)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Follow the Expert route' }));

    expect(localStorage.getItem(ROUTE_STORAGE_KEY)).toBe('expert');
    expect(screen.getByText(/You're following the Expert route\./)).toBeInTheDocument();
    expect(screen.getByText(/You're following the Expert route\./).closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('returns focus to the start button on retake', () => {
    render(<PlacementQuiz plans={plans} />);
    answerAll((options) => options[0].id);
    fireEvent.click(screen.getByRole('button', { name: 'Retake the quiz' }));
    expect(screen.getByRole('button', { name: 'Start the quiz' })).toHaveFocus();
  });
});
