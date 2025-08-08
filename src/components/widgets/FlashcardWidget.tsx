"use client";

import React, { useState, useEffect, ReactNode } from "react"; // Added ReactNode
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import flashcardDecks, { RawFlashcard } from "@/lib/flashcard-decks";

interface CardData {
  id: string | number;
  front: ReactNode; // Allow ReactNode for richer content
  back: ReactNode;
}

interface FlashcardWidgetProps {
  cards?: CardData[];
  deckId?: string;
  onProgressUpdate?: (lastViewedCardIndex: number) => void; // For Firestore integration later
  initialCardIndex?: number;
}

const FlashcardWidget: React.FC<FlashcardWidgetProps> = ({
  cards,
  deckId,
  onProgressUpdate,
  initialCardIndex = 0,
}) => {
  const [loadedCards, setLoadedCards] = useState<CardData[]>(cards || []);
  const [currentIndex, setCurrentIndex] = useState(initialCardIndex);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (!cards && deckId) {
      const deck = flashcardDecks[deckId];
      if (deck) {
        const formatted = deck.map((c: RawFlashcard) => ({
          id: c.id,
          front: c.question,
          back: c.answer,
        }));
        setLoadedCards(formatted);
      }
    } else if (cards) {
      setLoadedCards(cards);
    }
  }, [deckId, cards]);

  useEffect(() => {
    setIsMounted(true);
    // Potential: Load last viewed index from localStorage or prop
  }, []);

  useEffect(() => {
    if (isMounted && onProgressUpdate) {
      onProgressUpdate(currentIndex);
    }
    // Reset flip state when card changes
    setIsFlipped(false);
  }, [currentIndex, onProgressUpdate, isMounted]);

  if (!isMounted || !loadedCards || loadedCards.length === 0) {
    return (
      <div className="my-6 p-5 rounded-lg shadow-md bg-secondary/20 dark:bg-secondary/10 border border-border/30 text-center">
        <p className="text-foreground/70">No flashcards available or component loading...</p>
      </div>
    );
  }

  const currentCard = loadedCards[currentIndex];
  const progressPercentage = ((currentIndex + 1) / loadedCards.length) * 100;

  const handleNext = () => {
    if (currentIndex < loadedCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }

  const cardVariants = {
    front: { rotateY: 0 },
    back: { rotateY: 180 },
  };

  return (
    <div className="my-6 p-4 sm:p-6 rounded-lg shadow-xl bg-card border border-border/50 flex flex-col items-center w-full max-w-lg mx-auto">
      {/* Header: Counter and Restart Button */}
      <div className="w-full flex justify-between items-center mb-3 px-1">
        <span className="text-sm font-medium text-foreground/80">
          Card {currentIndex + 1} of {loadedCards.length}
        </span>
        <Button variant="ghost" size="sm" onClick={handleRestart} aria-label="Restart flashcards">
          <RefreshCw className="w-4 h-4 mr-1 sm:mr-2" />
          Restart
        </Button>
      </div>

      {/* Flashcard */}
      <div
        className="w-full h-64 sm:h-72 perspective bg-transparent cursor-pointer mb-4"
        onClick={handleFlip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? handleFlip() : null}
        aria-pressed={isFlipped}
        aria-label={`Flashcard: ${isFlipped ? 'Showing back' : 'Showing front'}. Click to flip.`}
      >
        <motion.div
          className="relative w-full h-full preserve-3d"
          animate={isFlipped ? "back" : "front"}
          variants={cardVariants}
          transition={{ duration: 0.6 }}
        >
          {/* Front of Card */}
          <motion.div
            className="absolute w-full h-full backface-hidden flex items-center justify-center p-6 rounded-md shadow-md border border-border/30 bg-background"
          >
            <div className="text-center text-lg text-foreground">{currentCard.front}</div>
          </motion.div>
          {/* Back of Card */}
          <motion.div
            className="absolute w-full h-full backface-hidden flex items-center justify-center p-6 rounded-md shadow-md border border-border/30 bg-background [transform:rotateY(180deg)]"
          >
            <div className="text-center text-md text-foreground/90">{currentCard.back}</div>
          </motion.div>
        </motion.div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between w-full">
        <Button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          variant="outline"
          aria-label="Previous card"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Previous
        </Button>
        <Button
          onClick={handleNext}
          disabled={currentIndex === loadedCards.length - 1}
          variant="outline"
          aria-label="Next card"
        >
          Next
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default FlashcardWidget;
