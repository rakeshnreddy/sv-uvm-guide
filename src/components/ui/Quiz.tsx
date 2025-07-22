"use client";

import React, { useState } from 'react';
import { Button } from './Button';

interface QuizProps {
  questions: {
    question: string;
    options: string[];
    correctAnswer: string;
  }[];
}

const Quiz: React.FC<QuizProps> = ({ questions }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const handleAnswerSelection = (option: string) => {
    setSelectedAnswer(option);
    setIsCorrect(option === questions[currentQuestionIndex].correctAnswer);
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  if (currentQuestionIndex >= questions.length) {
    return (
      <div className="p-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg">
        <h3 className="text-xl font-bold text-primary">Quiz Complete!</h3>
      </div>
    );
  }

  const { question, options } = questions[currentQuestionIndex];

  return (
    <div className="p-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold text-primary mb-4">{question}</h3>
      <div className="space-y-2">
        {options.map((option) => (
          <Button
            key={option}
            onClick={() => handleAnswerSelection(option)}
            variant={selectedAnswer === option ? (isCorrect ? 'default' : 'destructive') : 'outline'}
            disabled={selectedAnswer !== null}
          >
            {option}
          </Button>
        ))}
      </div>
      {selectedAnswer && (
        <div className="mt-4">
          <p className={`text-lg ${isCorrect ? 'text-success' : 'text-destructive'}`}>
            {isCorrect ? 'Correct!' : 'Incorrect.'}
          </p>
          <Button onClick={handleNextQuestion} className="mt-2">
            Next Question
          </Button>
        </div>
      )}
    </div>
  );
};

export default Quiz;
