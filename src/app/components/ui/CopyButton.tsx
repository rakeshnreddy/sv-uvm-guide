"use client";

import React,
{ useState, useEffect } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './Button'; // Using our themed Button

interface CopyButtonProps {
  textToCopy: string;
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ textToCopy, className }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      // Optionally, provide user feedback about the error
    }
  };

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 2000); // Reset after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  return (
    <Button
      variant="ghost" // Use a subtle variant for the copy button
      size="icon"
      onClick={handleCopy}
      className={`absolute top-2 right-2 z-10 text-brand-text-primary/70 hover:text-accent ${className}`} // Updated to brand-text-primary
      aria-label={isCopied ? "Copied!" : "Copy to clipboard"}
    >
      {isCopied ? <Check size={18} className="text-accent" /> : <Copy size={18} />}
    </Button>
  );
};
