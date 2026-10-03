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
});
