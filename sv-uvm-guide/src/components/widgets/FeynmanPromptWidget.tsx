"use client";

import React, { useState, useRef, useEffect } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/Button"; // Assuming a general purpose Button

interface FeynmanPromptWidgetProps {
  conceptTitle?: string; // Optional: title of the concept being explained
  onSubmit?: (explanation: string) => void; // Optional: callback for when user submits their explanation
}

const FeynmanPromptWidget: React.FC<FeynmanPromptWidgetProps> = ({
  conceptTitle,
  onSubmit,
}) => {
  const [explanation, setExplanation] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setExplanation(event.target.value);
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(explanation);
    }
    // Optional: Clear textarea after submit, or show a success message
    // setExplanation("");
    console.log("Feynman explanation submitted:", explanation);
    alert(`Your explanation for "${conceptTitle || 'this concept'}" has been noted (placeholder).`);
  };

  // Auto-resize textarea height based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [explanation, isFocused]); // Re-calculate on explanation change or focus

  return (
    <div className="my-6 p-5 rounded-lg shadow-md bg-secondary/20 dark:bg-secondary/10 border border-primary/30 dark:border-primary/40">
      <div className="flex items-start mb-3">
        <Lightbulb className="w-7 h-7 text-primary mr-3 flex-shrink-0 mt-1" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Challenge your understanding.
          </h3>
          <p className="text-sm text-foreground/80">
            Explain {conceptTitle ? `"${conceptTitle}"` : "this concept"} in your own simple words.
          </p>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={explanation}
        onChange={handleInputChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Type your explanation here... The simpler, the better!"
        className="w-full p-3 min-h-[80px] text-sm bg-background/70 dark:bg-background/40 border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none overflow-y-hidden transition-shadow duration-150 ease-in-out focus:shadow-md"
        rows={3} // Initial rows, will expand
      />
      {onSubmit && explanation.trim() && ( // Show submit button only if onSubmit is provided and there's text
        <div className="mt-3 text-right">
          <Button onClick={handleSubmit} size="sm" variant="default">
            Submit Explanation
          </Button>
        </div>
      )}
    </div>
  );
};

export default FeynmanPromptWidget;
