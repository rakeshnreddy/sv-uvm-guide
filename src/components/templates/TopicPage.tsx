"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button"; // Will create this basic Button component next
import { Lightbulb, BookOpen } from "lucide-react"; // Example icons
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Placeholder components - these will be developed in later tasks
const FeynmanPromptPlaceholder = () => (
  <div className="my-4 p-4 border border-dashed border-primary/50 rounded-md bg-primary/5">
    <h3 className="font-semibold text-primary mb-2 flex items-center">
      <Lightbulb className="w-5 h-5 mr-2" />
      Feynman Prompt Placeholder
    </h3>
    <p className="text-sm text-foreground/80">
      Explain this concept in your own simple words here... (Textarea will go here)
    </p>
  </div>
);

const FlashcardWidgetPlaceholder = () => (
  <div className="my-4 p-4 border border-dashed border-accent-foreground/30 rounded-md bg-accent/50">
    <h3 className="font-semibold text-accent-foreground mb-2 flex items-center">
      <BookOpen className="w-5 h-5 mr-2" />
      Flashcard Widget Placeholder
    </h3>
    <p className="text-sm text-foreground/80">
      Interactive flashcards will appear here...
    </p>
  </div>
);

import FlashcardWidget from "@/components/widgets/FlashcardWidget"; // Import the actual widget

// Removed AIAssistantPlaceholder as it will be globally available from RootLayout

interface CardData { // Duplicating interface for now, ideally import from FlashcardWidget or a shared types file
  id: string | number;
  front: ReactNode;
  back: ReactNode;
}
interface TopicPageProps {
  title: string;
  level1Content: ReactNode;
  level2Content: ReactNode;
  level3Content: ReactNode;
  flashcards?: CardData[]; // Optional prop for flashcard data
  topicId?: string; // To identify the topic in Firestore
}

const TopicPage: React.FC<TopicPageProps> = ({
  title,
  level1Content,
  level2Content,
  level3Content,
  flashcards,
  topicId, // Will be used for Firestore interaction
}) => {
  const { user } = useAuth();
  const [initialCardIndex, setInitialCardIndex] = useState(0);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

  useEffect(() => {
    const loadProgress = async () => {
      if (user && topicId) {
        try {
          const docRef = doc(db, "users", user.uid, "topics", topicId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data() as any;
            const savedIndex =
              data?.flashcardProgress?.lastViewedCardIndex ?? 0;
            setInitialCardIndex(savedIndex);
          }
        } catch (error) {
          console.error("Error loading flashcard progress:", error);
        }
      }
      setIsLoadingProgress(false);
    };
    loadProgress();
  }, [user, topicId]);

  const handleFlashcardProgressUpdate = async (
    lastViewedCardIndex: number,
  ) => {
    if (!user || !topicId) return;
    try {
      const docRef = doc(db, "users", user.uid, "topics", topicId);
      await setDoc(
        docRef,
        { flashcardProgress: { lastViewedCardIndex } },
        { merge: true },
      );
    } catch (error) {
      console.error("Error saving flashcard progress:", error);
    }
  };

  const handleMarkAsComplete = async () => {
    if (!user || !topicId) {
      alert(`Topic "${title}" marked as complete.`);
      return;
    }
    try {
      const docRef = doc(db, "users", user.uid, "topics", topicId);
      await setDoc(docRef, { completed: true }, { merge: true });
      alert(`Topic "${title}" marked as complete.`);
    } catch (error) {
      console.error("Error marking topic complete:", error);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <h1 className="text-4xl font-bold mb-6 text-foreground border-b border-border pb-4">{title}</h1>

      <Accordion className="mb-8">
        <AccordionItem title="Level 1: The Elevator Pitch" id="level1" isOpenDefault prose>
          {level1Content}
        </AccordionItem>
        <AccordionItem title="Level 2: The Practical Explanation" id="level2" prose>
          {level2Content}
          {/* Designated slot for FeynmanPrompt - shown within Level 2 */}
          <FeynmanPromptPlaceholder />
        </AccordionItem>
      </Accordion>

      <div>
        <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">Level 3: The Deep Dive</h2>
        <div className="prose dark:prose-invert max-w-none">
          {level3Content}
        </div>
      </div>

      {flashcards && flashcards.length > 0 && !isLoadingProgress && (
        <FlashcardWidget
          cards={flashcards}
          onProgressUpdate={handleFlashcardProgressUpdate}
          initialCardIndex={initialCardIndex}
        />
      )}

      <div className="mt-8 mb-4 text-center">
        <Button onClick={handleMarkAsComplete} variant="default" size="lg">
          Mark as Complete
        </Button>
      </div>

      {/* AI Assistant component is now globally available from RootLayout */}
    </div>
  );
};

export default TopicPage;
