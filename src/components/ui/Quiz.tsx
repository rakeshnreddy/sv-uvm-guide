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

interface QuizProps {
  children: React.ReactNode;
}

const Quiz: React.FC<QuizProps> = ({ children }) => {
  const questions: FormattedQuestion[] = useMemo(() => {
    try {
      // 1. Extract the JSON string from children
      let jsonString = '';
      React.Children.forEach(children, (child) => {
        if (typeof child === 'string') {
          jsonString += child;
        } else if (React.isValidElement(child)) {
            // This handles the case where MDX wraps the code in a <pre><code> structure
            if (child.props.mdxType === 'pre') {
                const codeChild = React.Children.toArray(child.props.children).find(c => React.isValidElement(c) && c.props.mdxType === 'code');
                if(codeChild && React.isValidElement(codeChild)) {
                    jsonString += React.Children.toArray(codeChild.props.children).join('');
                }
            } else {
                 jsonString += React.Children.toArray(child.props.children).join('');
            }
        }
      });
      
      jsonString = jsonString.trim();
      
      // The MDX has a weird `{[...]}`, let's fix it to be `[...]`
      if (jsonString.startsWith('{[')) {
          jsonString = jsonString.substring(1, jsonString.length - 1);
      }

      // 2. Parse the JSON
      const mdxQuestions: MdxQuestion[] = JSON.parse(jsonString);

      // 3. Transform the data
      return mdxQuestions.map((q) => {
        const correctAnswer = q.answers.find((a) => a.correct)?.text;
        if (!correctAnswer) {
          // Throw an error if a question has no correct answer
          throw new Error(`Question has no correct answer: "${q.question}"`);
        }
        return {
          question: q.question,
          options: q.answers.map((a) => a.text),
          correctAnswer: correctAnswer,
          explanation: q.explanation,
        };
      });
    } catch (error) {
      console.error("Error parsing quiz questions:", error);
      return []; // Return an empty array if parsing fails
    }
  }, [children]);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);


  const handleAnswerSelection = (option: string) => {
    setSelectedAnswer(option);
    const correct = option === questions[currentQuestionIndex].correctAnswer;
    setIsCorrect(correct);
    setShowExplanation(true);
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    setShowExplanation(false);
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  if (!questions || questions.length === 0) {
    return <div className="p-4 bg-red-900/50 border border-red-500/50 rounded-lg shadow-lg"><p className="text-white">Failed to load quiz. Check the console for errors.</p></div>;
  }

  if (currentQuestionIndex >= questions.length) {
    return (
      <div className="p-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg">
        <h3 className="text-xl font-bold text-primary">Quiz Complete!</h3>
      </div>
    );
  }

  const { question, options, explanation } = questions[currentQuestionIndex];

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
