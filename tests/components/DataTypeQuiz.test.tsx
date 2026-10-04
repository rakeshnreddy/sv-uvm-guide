import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DataTypeQuiz from '@/components/curriculum/f2/DataTypeQuiz';
import CurriculumDataTypeQuiz from '@/components/curriculum/f2/CurriculumDataTypeQuiz';
import { dataTypeQuizQuestions } from '@/content/f2/dataTypeQuizQuestions';

const SAMPLE_QUESTIONS = [
  {
    question: 'Which type keeps a shared bus observable when idle?',
    options: ['logic [31:0] bus;', 'wire [31:0] bus;'],
    correctAnswerIndex: 1,
    explanation: 'Nets resolve multiple drivers and default to Z when undriven.',
    optionFeedback: ['A variable rejects a second continuous driver.', 'Nets resolve their drivers.'],
  },
  {
    question: 'Which declaration safely stores negative scoreboard deltas?',
    options: ['int delta;', 'bit [7:0] delta;'],
    correctAnswerIndex: 0,
    explanation: 'Signed ints capture negative values without wrap-around.',
  },
];

describe('DataTypeQuiz', () => {
  it('shows the feedback for the chosen option plus why the answer holds', async () => {
    render(<DataTypeQuiz questions={SAMPLE_QUESTIONS} />);

    fireEvent.click(screen.getByText('logic [31:0] bus;'));

    const feedback = await screen.findByTestId('quiz-feedback');
    expect(feedback).toHaveTextContent('Not quite.');
    expect(feedback).toHaveTextContent('A variable rejects a second continuous driver.');
    expect(feedback).toHaveTextContent('Why the answer holds: Nets resolve their drivers.');
    expect(feedback).toHaveTextContent('Nets resolve multiple drivers');
    // Focus moves to the next control for keyboard users.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /next scenario/i }));

    fireEvent.click(screen.getByRole('button', { name: /next scenario/i }));
    await waitFor(() => expect(screen.getByText(/negative scoreboard/i)).toBeInTheDocument());
  });

  it('rewards the learner after passing, focuses the dialog and closes it with Escape', async () => {
    render(<DataTypeQuiz questions={SAMPLE_QUESTIONS} />);

    fireEvent.click(screen.getByText('wire [31:0] bus;'));
    await screen.findByTestId('quiz-feedback');
    fireEvent.click(screen.getByRole('button', { name: /next scenario/i }));

    await screen.findByText('Which declaration safely stores negative scoreboard deltas?');
    fireEvent.click(screen.getByText('int delta;'));
    await screen.findByTestId('quiz-feedback');
    fireEvent.click(screen.getByRole('button', { name: /see results/i }));

    const reward = await screen.findByTestId('quiz-reward-modal');
    expect(reward).toHaveTextContent('Success!');
    expect(reward).toHaveTextContent('+150 XP');
    expect(screen.getByRole('dialog', { name: 'Success!' })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /close/i }));

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('quiz-reward-modal')).not.toBeInTheDocument());

    const results = await screen.findByTestId('quiz-results');
    expect(results).toHaveTextContent('You scored 2 / 2');
  });
});

describe('F2A data type question bank', () => {
  it('gives every option its own diagnostic feedback', () => {
    for (const q of dataTypeQuizQuestions) {
      expect(q.optionFeedback).toHaveLength(q.options.length);
      expect(new Set(q.optionFeedback).size).toBe(q.options.length);
    }
  });

  it('recommends 4-state logic for an RTL counter, not 2-state bit (missing resets must stay visible)', () => {
    const q = dataTypeQuizQuestions.find((x) => /counter/.test(x.question));
    expect(q?.options[q.correctAnswerIndex]).toBe('logic [15:0] count;');
  });

  it('does not grade "two procedural blocks resolve to X" as correct (§6.5: last write wins)', () => {
    const q = dataTypeQuizQuestions.find((x) => /reads x long after reset/.test(x.question));
    expect(q).toBeDefined();
    const correct = q!.options[q!.correctAnswerIndex];
    expect(correct).toMatch(/still holds its starting value of x/);
    const procedural = q!.options.findIndex((o) => /always blocks/.test(o));
    expect(q!.optionFeedback?.[procedural]).toMatch(/last write wins/);
  });

  it('cites only verified clause numbers (no §6.1, §6.4 or §6.10 for data types)', () => {
    const text = JSON.stringify(dataTypeQuizQuestions);
    expect(text).not.toMatch(/§6\.1\)|§6\.4\)|§6\.10\b/);
  });

  it('renders through the curriculum wrapper', () => {
    render(<CurriculumDataTypeQuiz />);
    expect(screen.getByTestId('data-type-quiz')).toBeInTheDocument();
  });
});
