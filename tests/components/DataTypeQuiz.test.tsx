import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DataTypeQuiz from '@/components/curriculum/f2/DataTypeQuiz';

const SAMPLE_QUESTIONS = [
  {
    question: 'Which type keeps a shared bus observable when idle?',
    options: ['logic [31:0] bus;', 'wire [31:0] bus;'],
    correctAnswerIndex: 1,
    explanation: 'Nets resolve multiple drivers and default to Z when undriven.',
  },
  {
    question: 'Which declaration safely stores negative scoreboard deltas?',
    options: ['int delta;', 'bit [7:0] delta;'],
    correctAnswerIndex: 0,
    explanation: 'Signed ints capture negative values without wrap-around.',
  },
];

describe('DataTypeQuiz', () => {
  it('shows feedback when an answer is incorrect', async () => {
    render(<DataTypeQuiz questions={SAMPLE_QUESTIONS} />);

    fireEvent.click(screen.getByText('logic [31:0] bus;'));

    const feedback = await screen.findByTestId('quiz-feedback');
    expect(feedback).toHaveTextContent('Not quite.');
    expect(feedback).toHaveTextContent('Nets resolve multiple drivers');

    fireEvent.click(screen.getByRole('button', { name: /next scenario/i }));
    await waitFor(() => expect(screen.getByText(/negative scoreboard/i)).toBeInTheDocument());
  });

  it('rewards the learner after passing the quiz', async () => {
    render(<DataTypeQuiz questions={SAMPLE_QUESTIONS} />);

    // Question 1 — correct choice
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

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByTestId('quiz-reward-modal')).not.toBeInTheDocument());

    const results = await screen.findByTestId('quiz-results');
    expect(results).toHaveTextContent('You scored 2 / 2');
  });
});
