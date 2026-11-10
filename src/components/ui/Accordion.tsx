"use client";

import { ChevronDown } from "lucide-react"; // Corrected import
import { motion, AnimatePresence } from "framer-motion";
import React, { useState, ReactNode, ReactElement } from "react"; // Added ReactElement

import Link from "next/link";

interface AccordionItemProps {
  title: string;
  children: ReactNode;
  isOpenDefault?: boolean;
  id: string; // For ARIA attributes
  buttonId?: string; // For aria-labelledby
  prose?: boolean;
  href?: string;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  title,
  children,
  isOpenDefault = false,
  id,
  buttonId,
  prose = false,
  href,
}) => {
  const [isOpen, setIsOpen] = useState(isOpenDefault);
  const generatedButtonId = buttonId || `accordion-button-${id}`;
  const contentId = `accordion-content-${id}`;

  const content = (
    <button
      id={generatedButtonId}
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      aria-expanded={isOpen}
      aria-controls={contentId}
      className="flex items-center justify-between w-full py-4 px-5 text-left text-lg font-medium text-foreground transition-colors duration-150 ease-bench hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span>{title}</span>
      <ChevronDown
        className={`w-5 h-5 transform transition-transform duration-300 ${
          isOpen ? "rotate-180" : ""
        }`}
        aria-hidden="true"
      />
    </button>
  );

  return (
    <div className="border-b border-border last:border-b-0">
      <h2>
        {href ? <Link href={href}>{content}</Link> : content}
      </h2>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={contentId}
            role="region"
            aria-labelledby={generatedButtonId}
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={{
              open: { opacity: 1, height: "auto", marginTop: "0.5rem", marginBottom: "1rem" },
              collapsed: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 },
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className={`px-5 pb-4 pt-2 text-foreground ${prose ? 'prose max-w-none' : ''}`}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const AccordionTrigger = ({ children, ...props }: { children: React.ReactNode;[key: string]: any }) => (
  <h2 {...props}>{children}</h2>
);

export const AccordionContent = ({ children, ...props }: { children: React.ReactNode;[key: string]: any }) => (
  <div {...props}>{children}</div>
);

interface AccordionProps {
  children: ReactElement<AccordionItemProps> | ReactElement<AccordionItemProps>[];
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({ children, className }) => {
  return (
    <div className={`rounded-2xl border border-border bg-card shadow-card ${className ?? ''}`}>
      {children}
    </div>
  );
};
