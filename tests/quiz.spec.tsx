import { render, fireEvent, screen } from '@testing-library/react';
import Quiz from '../src/components/ui/Quiz';
import React from 'react';
import { afterEach, beforeEach, vi } from 'vitest';

import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { ASSESSMENTS_MAX_CHARS, QUIZ_RESULTS_MAX } from '@/lib/learner-store/repositories/assessments';
import { __resetStorageForTests } from '@/lib/learner-store/storage';
import { localDayKey } from '@/lib/learner-store/time';

const navigation = vi.hoisted(() => ({ pathname: null as string | null }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

const LESSON_PATH = '/curriculum/T1_Foundational/F3A_Simulation_Semantics/index';

beforeEach(() => {
  __resetStorageForTests();
  __resetRecordsForTests();
  localStorage.clear();
  navigation.pathname = null;
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function storedAssessments(): { quizzes: Record<string, { lessonPath: string; best: number; last: number; total: number; attempts: number }> } {
  const raw = localStorage.getItem('sv-uvm-guide:assessments');
  return raw ? JSON.parse(raw).data : { quizzes: {} };
}

describe('Quiz component', () => {
  const questions = [
    {
      question: '2 + 2 = ?',
      options: ['3', '4'],
      correctAnswer: '4',
      explanation: 'Basic addition.',
    },
  ];

  it('shows Correct! when selecting the right answer', () => {
    render(<Quiz questions={questions} />);
    fireEvent.click(screen.getByText('4'));
    screen.getByText('Correct!');
  });

  it('shows Incorrect. when selecting the wrong answer', () => {
    render(<Quiz questions={questions} />);
    fireEvent.click(screen.getByText('3'));
    screen.getByText('Incorrect.');
  });

  it.each([
    ['correctAnswer', { correctAnswer: 1 }],
    ['correctIndex', { correctIndex: 1 }],
  ])('treats a numeric %s as a 0-based option index', (_label, answer) => {
    render(
      <Quiz
        questions={[
          { question: 'Which TLM element buffers analysis writes?', options: ['uvm_analysis_imp', 'uvm_tlm_analysis_fifo'], explanation: 'FIFO.', ...answer } as never,
        ]}
      />,
    );
    fireEvent.click(screen.getByText('uvm_tlm_analysis_fifo'));
    screen.getByText('Correct!');
  });

  const canonical = [
    {
      question: 'When does a nonblocking assignment update its left-hand side?',
      objective: 2,
      answers: [
        { text: 'Immediately, in the Active region', correct: false, feedback: 'That is a blocking assignment.' },
        { text: 'In the NBA region of the same time slot', correct: true, feedback: 'Right: the update is scheduled for NBA.' },
      ],
      explanation: 'IEEE 1800-2023 §10.4.2: the update is scheduled as an NBA update event.',
    },
    {
      question: 'Second question',
      answers: [
        { text: 'A', correct: true },
        { text: 'B', correct: false },
      ],
      explanation: 'A is right.',
    },
  ];

  it('shows the feedback for the option the learner picked, and marks the correct answer after a miss', () => {
    render(<Quiz questions={canonical as never} />);
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Immediately, in the Active region'));
    screen.getByText('Incorrect.');
    screen.getByText('That is a blocking assignment.');
    expect(screen.getByText('correct answer')).toBeInTheDocument();
    screen.getByText(/§10\.4\.2/);
  });

  it('reports the score at the end and lets the learner retry', () => {
    render(<Quiz questions={canonical as never} />);
    fireEvent.click(screen.getByText('In the NBA region of the same time slot'));
    fireEvent.click(screen.getByText('Next Question'));
    fireEvent.click(screen.getByText('B'));
    fireEvent.click(screen.getByText('Next Question'));
    screen.getByText('Quiz Complete!');
    screen.getByText(/You answered 1 of 2 correctly/);
    fireEvent.click(screen.getByText('Retry quiz'));
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
  });

  it('names the objective each question checks, so "Each question names the objective it checks" is true on the page', () => {
    render(<Quiz questions={canonical as never} />);
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    expect(screen.getByTestId('quiz-objective')).toHaveTextContent('Checks lesson Objective 2');
    fireEvent.click(screen.getByText('In the NBA region of the same time slot'));
    fireEvent.click(screen.getByText('Next Question'));
    // The second question has no objective, so no tag is drawn.
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument();
    expect(screen.queryByTestId('quiz-objective')).not.toBeInTheDocument();
  });

  it.each([[0], [-1], [1.5], ['2']])('ignores a malformed objective (%s)', (objective) => {
    render(<Quiz questions={[{ ...canonical[0], objective }] as never} />);
    expect(screen.queryByTestId('quiz-objective')).not.toBeInTheDocument();
  });

  it('keeps the objective for options-style questions too', () => {
    render(<Quiz questions={[{ question: 'Q?', options: ['a', 'b'], correctAnswer: 'a', explanation: 'e', objective: 3 }] as never} />);
    expect(screen.getByTestId('quiz-objective')).toHaveTextContent('Objective 3');
  });
  describe('saving results in this browser', () => {
    const finish = (picks: string[]) => {
      for (const pick of picks) {
        fireEvent.click(screen.getByText(pick));
        fireEvent.click(screen.getByText('Next Question'));
      }
    };

    it('records the score for the lesson path once the quiz is finished, plus quiz activity', () => {
      navigation.pathname = `${LESSON_PATH}/`;
      vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 9, 18, 9).getTime());
      render(<Quiz questions={canonical as never} />);

      fireEvent.click(screen.getByText('In the NBA region of the same time slot'));
      fireEvent.click(screen.getByText('Next Question'));
      expect(localStorage.getItem('sv-uvm-guide:assessments')).toBeNull();

      finish(['B']);
      screen.getByText('Quiz Complete!');

      const quizzes = Object.entries(storedAssessments().quizzes);
      expect(quizzes).toHaveLength(1);
      const [key, result] = quizzes[0];
      expect(key).toMatch(new RegExp(`^${LESSON_PATH}#[0-9a-f]{8}$`));
      expect(result).toEqual(expect.objectContaining({ lessonPath: LESSON_PATH, best: 1, last: 1, total: 2, attempts: 1 }));

      const activity = JSON.parse(localStorage.getItem('sv-uvm-guide:activity') ?? '{}').data;
      expect(activity.days[localDayKey(new Date(2026, 9, 18, 9).getTime())]).toEqual({ quiz: 1 });
    });

    it('keeps the best score across a retry and counts both attempts', () => {
      navigation.pathname = LESSON_PATH;
      render(<Quiz questions={canonical as never} />);
      finish(['In the NBA region of the same time slot', 'A']);
      fireEvent.click(screen.getByText('Retry quiz'));
      finish(['Immediately, in the Active region', 'B']);

      const [result] = Object.values(storedAssessments().quizzes);
      expect(result).toEqual(expect.objectContaining({ best: 2, last: 0, total: 2, attempts: 2 }));
    });

    it('records nothing when there is no pathname', () => {
      render(<Quiz questions={canonical as never} />);
      finish(['In the NBA region of the same time slot', 'A']);
      screen.getByText('Quiz Complete!');
      expect(localStorage.getItem('sv-uvm-guide:assessments')).toBeNull();
      expect(localStorage.getItem('sv-uvm-guide:activity')).toBeNull();
    });

    it('says so when the score could not be saved because the stored quiz results are full', () => {
      navigation.pathname = LESSON_PATH;
      // QUIZ_RESULTS_MAX results with very long lesson paths: even after older
      // results are dropped to make room, the record is past its size limit,
      // so the write is refused as too large.
      const full = Object.fromEntries(
        Array.from({ length: QUIZ_RESULTS_MAX }, (_, i) => {
          const path = `/curriculum/T1_Foundational/F3A_Simulation_Semantics/lesson-${String(i).padStart(4, '0')}-${'x'.repeat(400)}`;
          return [`${path}#0000${String(i).padStart(4, '0')}`, { lessonPath: path, best: 1, last: 1, total: 2, attempts: 1, lastAt: 1 }];
        }),
      );
      localStorage.setItem('sv-uvm-guide:assessments', JSON.stringify({ v: 1, data: { placement: [], quizzes: full } }));
      expect(localStorage.getItem('sv-uvm-guide:assessments')!.length).toBeGreaterThan(ASSESSMENTS_MAX_CHARS);

      render(<Quiz questions={canonical as never} />);
      finish(['In the NBA region of the same time slot', 'A']);

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Quiz Complete!');
      expect(screen.getByTestId('quiz-save-message')).toHaveTextContent(
        "Your score wasn't saved: the quiz results kept in this browser have reached their size limit.",
      );
      expect(status).toContainElement(screen.getByTestId('quiz-save-message'));
      expect(Object.keys(storedAssessments().quizzes)).toHaveLength(QUIZ_RESULTS_MAX);

      fireEvent.click(screen.getByText('Retry quiz'));
      expect(screen.queryByTestId('quiz-save-message')).not.toBeInTheDocument();
    });

    it('shows no save message when the score is saved', () => {
      navigation.pathname = LESSON_PATH;
      render(<Quiz questions={canonical as never} />);
      finish(['In the NBA region of the same time slot', 'A']);
      screen.getByText('Quiz Complete!');
      expect(screen.queryByTestId('quiz-save-message')).not.toBeInTheDocument();
    });

    it('keeps separate results for two quizzes on the same lesson', () => {
      navigation.pathname = LESSON_PATH;
      const { unmount } = render(<Quiz questions={canonical as never} />);
      finish(['In the NBA region of the same time slot', 'A']);
      unmount();

      render(<Quiz questions={questions} />);
      finish(['3']);

      const results = Object.entries(storedAssessments().quizzes);
      expect(results).toHaveLength(2);
      expect(new Set(results.map(([key]) => key)).size).toBe(2);
      expect(results.map(([, result]) => [result.best, result.total]).sort()).toEqual([
        [0, 1],
        [2, 2],
      ]);
    });
  });
});

