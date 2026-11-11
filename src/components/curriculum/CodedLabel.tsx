import React from "react";

import { SignalTag } from "@/components/ui/SignalTag";
import { cn } from "@/lib/utils";

export interface CodedLabelProps {
  /** A module code or milestone id: "I-SV-1", "M3". */
  code: string;
  /** The title without the code: "Object-Oriented Programming for Verification". */
  title: string;
  /** Extra classes for the SignalTag (for example the hover accent inside a link). */
  tagClassName?: string;
  className?: string;
}

/**
 * A code as a SignalTag followed by its title. A visually hidden ": " sits
 * between them, so the text (and a link's accessible name) reads
 * "I-SV-1: Object-Oriented Programming for Verification", the same as the
 * plain-text label elsewhere.
 */
export function CodedLabel({ code, title, tagClassName, className }: CodedLabelProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-baseline gap-1.5", className)}>
      <SignalTag code={code} className={cn("self-center", tagClassName)} />
      <span className="sr-only">: </span>
      <span className="min-w-0 break-words">{title}</span>
    </span>
  );
}

/** "I-SV-1: Object-Oriented Programming" -> "Object-Oriented Programming"; a label without the code is kept. */
export function withoutCode(label: string, code: string): string {
  return label.startsWith(`${code}: `) ? label.slice(code.length + 2) : label;
}

export default CodedLabel;
