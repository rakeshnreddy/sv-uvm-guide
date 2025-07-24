import { render, fireEvent, screen } from '@testing-library/react';
import Quiz from '../src/components/ui/Quiz';
import React from 'react';

describe('Quiz component', () => {
  const questions = [
    {
      question: '2 + 2 = ?',
      options: ['3', '4'],
      correctAnswer: '4',
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
});
