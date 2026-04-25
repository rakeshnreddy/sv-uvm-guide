"use client";

import React, { useState, useMemo } from 'react';
import { Button } from './Button';

// This is the structure of the data coming from the MDX file
interface MdxQuestion {
  question: string;
  answers: {
    text: string;
    correct: boolean;
  }[];
  explanation: string;
}

// This is the structure the component internally uses
interface FormattedQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface LegacyFormattedQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface QuizProps {
  questions: (FormattedQuestion | LegacyFormattedQuestion | MdxQuestion)[];
}

const toFormatted = (qs: (FormattedQuestion | LegacyFormattedQuestion | MdxQuestion)[]): FormattedQuestion[] => {
  return qs.map((q) => {
    const anyQ = q as any;

    if (Array.isArray(anyQ.options)) {
      const correct =
        typeof anyQ.correctAnswer === 'string'
          ? anyQ.correctAnswer
          : typeof anyQ.answer === 'string'
            ? anyQ.answer
            : typeof anyQ.correct === 'string'
              ? anyQ.correct
              : undefined;
      const options = anyQ.options.map((opt: unknown) => String(opt));

      return {
        question: String(anyQ.question),
        options,
        correctAnswer: correct ?? options[0] ?? '',
        explanation: String(anyQ.explanation ?? ''),
      };
    }

    if (Array.isArray(anyQ.answers)) {
      if (anyQ.answers.length > 0 && typeof anyQ.answers[0] === 'string') {
        const correct =
          typeof anyQ.correctAnswer === 'string'
            ? anyQ.correctAnswer
            : typeof anyQ.answer === 'string'
              ? anyQ.answer
              : undefined;
        const options = anyQ.answers.map((opt: unknown) => String(opt));
        return {
          question: String(anyQ.question),
          options,
          correctAnswer: correct ?? options[0] ?? '',
          explanation: String(anyQ.explanation ?? ''),
        };
      }

      const mdxQ = anyQ as MdxQuestion;
      const correctAnswer = mdxQ.answers.find((a) => a.correct)?.text;
      const options = mdxQ.answers.map((a) => a.text);
      return {
        question: mdxQ.question,
        options,
        correctAnswer: correctAnswer ?? options[0] ?? '',
        explanation: mdxQ.explanation,
      };
    }

    return {
      question: String(anyQ?.question ?? 'Question unavailable'),
      options: ['N/A'],
      correctAnswer: 'N/A',
      explanation: String(anyQ?.explanation ?? ''),
    };
  });
};

const Quiz: React.FC<QuizProps> = ({ questions }) => {
  const parsedQuestions: FormattedQuestion[] = useMemo(() => {
    try {
      return toFormatted(questions);
    } catch (error) {
      console.error("Error parsing quiz questions:", error);
      return []; // Return an empty array if parsing fails
    }
  }, [questions]);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);


  const handleAnswerSelection = (option: string) => {
    setSelectedAnswer(option);
    const correct = option === parsedQuestions[currentQuestionIndex].correctAnswer;
    setIsCorrect(correct);
    setShowExplanation(true);
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    setShowExplanation(false);
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  if (!parsedQuestions || parsedQuestions.length === 0) {
    return <div className="p-4 bg-red-900/50 border border-red-500/50 rounded-lg shadow-lg"><p className="text-white">Failed to load quiz. Check the console for errors.</p></div>;
  }

  if (currentQuestionIndex >= parsedQuestions.length) {
    return (
      <div className="p-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg">
        <h3 className="text-xl font-bold text-primary">Quiz Complete!</h3>
      </div>
    );
  }

  const { question, options, explanation } = parsedQuestions[currentQuestionIndex];

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
      {showExplanation && (
        <div className="mt-4">
          <p className={`text-lg ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
            {isCorrect ? 'Correct!' : 'Incorrect.'}
          </p>
          <p className="text-sm mt-2 text-foreground/80">{explanation}</p>
          <Button onClick={handleNextQuestion} className="mt-4">
            Next Question
          </Button>
        </div>
      )}
    </div>
  );
};

export default Quiz;
