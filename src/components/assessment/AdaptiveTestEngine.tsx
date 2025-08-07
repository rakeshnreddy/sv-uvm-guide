"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';

type Difficulty = 'Easy' | 'Medium' | 'Hard';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: number;
  difficulty: Difficulty;
}

const questionBank: Question[] = [
  { id: 1, text: "What does 'logic' data type represent in SystemVerilog?", options: ["A 4-state value", "A 2-state value", "A real number", "A string"], correctAnswer: 0, difficulty: 'Easy' },
  { id: 2, text: "Which keyword is used to define a module?", options: ["class", "module", "package", "interface"], correctAnswer: 1, difficulty: 'Easy' },
  { id: 3, text: "What is the purpose of an `always_ff` block?", options: ["Combinational logic", "Latched logic", "Sequential logic (flip-flops)", "Asynchronous events"], correctAnswer: 2, difficulty: 'Medium' },
  { id: 4, text: "In UVM, which component is responsible for generating stimulus?", options: ["Driver", "Monitor", "Sequencer", "Scoreboard"], correctAnswer: 2, difficulty: 'Medium' },
  { id: 5, text: "What is the primary role of a UVM factory?", options: ["To run tests", "To create components and objects by type", "To connect components", "To manage phasing"], correctAnswer: 1, difficulty: 'Hard' },
  { id: 6, text: "What does a functional coverage of 100% imply?", options: ["The design is bug-free", "All specified coverage points have been hit", "The simulation is complete", "The testbench is efficient"], correctAnswer: 1, difficulty: 'Hard' },
];

export const AdaptiveTestEngine = () => {
  const [currentDifficulty, setCurrentDifficulty] = useState<Difficulty>('Easy');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<number[]>([]);

  const availableQuestions = useMemo(() => {
    return questionBank.filter(q => q.difficulty === currentDifficulty && !answeredQuestions.includes(q.id));
  }, [currentDifficulty, answeredQuestions]);

  const selectNextQuestion = () => {
    let nextQuestion: Question | undefined;
    if (availableQuestions.length > 0) {
      nextQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    } else {
      const allRemaining = questionBank.filter(q => !answeredQuestions.includes(q.id));
      if (allRemaining.length > 0) {
        nextQuestion = allRemaining[Math.floor(Math.random() * allRemaining.length)];
      }
    }

    if (nextQuestion) {
      setCurrentQuestion(nextQuestion);
      setCurrentDifficulty(nextQuestion.difficulty);
    } else {
      setCurrentQuestion(null); // End of quiz
    }

    setSelectedAnswer(null);
    setFeedback('');
  };

  const startQuiz = () => {
    setAnsweredQuestions([]);
    setScore(0);
    setCurrentDifficulty('Easy');
    setIsStarted(true);
  };

  useEffect(() => {
    if (isStarted) {
      // This effect runs when isStarted becomes true, or when the list of answered questions changes.
      selectNextQuestion();
    }
  }, [isStarted]);


  const handleAnswerSubmit = () => {
    if (selectedAnswer === null || !currentQuestion) return;

    setAnsweredQuestions(prev => [...prev, currentQuestion.id]);

    if (selectedAnswer === currentQuestion.correctAnswer) {
      setScore(prev => prev + 1);
      setFeedback('Correct!');
      // Increase difficulty
      if (currentDifficulty === 'Easy') setCurrentDifficulty('Medium');
      else if (currentDifficulty === 'Medium') setCurrentDifficulty('Hard');
    } else {
      setFeedback('Incorrect. The correct answer was: ' + currentQuestion.options[currentQuestion.correctAnswer]);
      // Decrease difficulty
      if (currentDifficulty === 'Hard') setCurrentDifficulty('Medium');
      else if (currentDifficulty === 'Medium') setCurrentDifficulty('Easy');
    }

    // Load next question after a short delay
    setTimeout(() => {
      selectNextQuestion();
    }, 1500);
  };

  const handleRestart = () => {
    setIsStarted(false);
    // Reset state for the next quiz start
    setAnsweredQuestions([]);
    setScore(0);
    setFeedback('');
    setCurrentQuestion(null);
  }

  if (!isStarted) {
    return (
      <div className="p-4 border border-dashed border-white/30 rounded-lg my-6 bg-white/5">
        <h2 className="text-2xl font-bold text-primary mb-4">Adaptive Test Engine</h2>
        <div className="text-center">
          <h3 className="text-xl font-semibold text-primary mb-2">Ready to test your knowledge?</h3>
          <Button onClick={startQuiz}>Start Quiz</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-dashed border-white/30 rounded-lg my-6 bg-white/5">
       <h2 className="text-2xl font-bold text-primary mb-4">Adaptive Test Engine</h2>
      {currentQuestion ? (
        <div>
          <p className="text-sm text-muted-foreground mb-2">Difficulty: {currentDifficulty} | Score: {score}</p>
          <h3 className="text-lg font-semibold mb-4">{currentQuestion.text}</h3>
          <div className="space-y-2">
            {currentQuestion.options.map((option, index) => (
              <Button
                key={index}
                variant={selectedAnswer === index ? 'default' : 'outline'}
                onClick={() => setSelectedAnswer(index)}
                className="w-full text-left justify-start"
                disabled={feedback !== ''}
              >
                {option}
              </Button>
            ))}
          </div>
          <Button onClick={handleAnswerSubmit} disabled={selectedAnswer === null || feedback !== ''} className="mt-4">
            Submit
          </Button>
          {feedback && <p className="mt-4 text-center font-semibold">{feedback}</p>}
        </div>
      ) : (
        <div className="text-center">
          <h3 className="text-xl font-semibold text-primary mb-2">Quiz Complete!</h3>
          <p>Your final score is: {score} / {questionBank.length}</p>
          <Button onClick={handleRestart} className="mt-4">Play Again</Button>
        </div>
      )}
    </div>
  );
};

export default AdaptiveTestEngine;
