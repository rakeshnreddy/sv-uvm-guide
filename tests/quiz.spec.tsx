import { render, fireEvent, screen } from '@testing-library/react';
import Quiz from '../src/components/ui/Quiz';
import React from 'react';

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
});
