"use client";

import { useState, useEffect } from 'react';
import { getDueFlashcards, reviewFlashcard } from '@/app/actions/srs';
import FlashcardWidget from '@/components/widgets/FlashcardWidget';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';

type Card = {
  id: string;
  front: string;
  back: string;
};

export default function MemoryHubPage() {
  const { user } = useAuth();
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDueCards() {
      if (user) {
        const cards = await getDueFlashcards();
        setDueCards(cards);
      }
      setIsLoading(false);
    }
    fetchDueCards();
  }, [user]);

  const handleReview = async (cardId: string, quality: number) => {
    await reviewFlashcard(cardId, quality);
    setDueCards(dueCards.filter(card => card.id !== cardId));
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (dueCards.length === 0) {
    return <div>No due cards for today!</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Memory Hub</h1>
      <FlashcardWidget
        cards={dueCards}
        onProgressUpdate={() => {}}
      />
      <div className="flex justify-center space-x-4 mt-4">
        <Button onClick={() => handleReview(dueCards[0].id, 0)}>Again</Button>
        <Button onClick={() => handleReview(dueCards[0].id, 2)}>Hard</Button>
        <Button onClick={() => handleReview(dueCards[0].id, 4)}>Good</Button>
        <Button onClick={() => handleReview(dueCards[0].id, 5)}>Easy</Button>
      </div>
    </div>
  );
}
