"use client";

import React, { ReactNode } from "react";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button"; // Will create this basic Button component next
import { Lightbulb, BookOpen } from "lucide-react"; // Example icons

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

// Removed AIAssistantPlaceholder as it will be globally available from RootLayout

interface TopicPageProps {
  title: string;
  level1Content: ReactNode;
  level2Content: ReactNode;
  level3Content: ReactNode;
  // Placeholder for where other components might be injected if needed directly as props
  // feynmanPrompt?: ReactNode;
  // flashcardWidget?: ReactNode;
}

const TopicPage: React.FC<TopicPageProps> = ({
  title,
  level1Content,
  level2Content,
  level3Content,
}) => {
  const handleMarkAsComplete = () => {
    // TODO: Interact with Firebase to mark the topic as complete for the user
    console.log(`Topic "${title}" marked as complete.`);
    alert(`Topic "${title}" marked as complete (placeholder).`);
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <h1 className="text-4xl font-bold mb-6 text-foreground border-b border-border pb-4">{title}</h1>

      <Accordion className="mb-8">
        <AccordionItem title="Level 1: The Elevator Pitch" id="level1" isOpenDefault>
          {level1Content}
        </AccordionItem>
        <AccordionItem title="Level 2: The Practical Explanation" id="level2">
          {level2Content}
          {/* Designated slot for FeynmanPrompt - shown within Level 2 */}
          <FeynmanPromptPlaceholder />
        </AccordionItem>
        <AccordionItem title="Level 3: The Deep Dive" id="level3">
          {level3Content}
          {/* Designated slot for FlashcardWidget - shown within Level 3 */}
          <FlashcardWidgetPlaceholder />
        </AccordionItem>
      </Accordion>

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
