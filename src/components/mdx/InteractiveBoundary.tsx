"use client";

import React from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export const INTERACTIVE_FAILED_TEXT = "This interactive failed to load";
export const INTERACTIVE_LOADING_TEXT = "Loading interactive";
export const INTERACTIVE_RETRY_LABEL = "Retry";

/**
 * The box shared by the placeholder and the error state: the same liquid glass
 * panel and padding as VisualFrame (DESIGN.md section 12), so an interactive
 * keeps its frame (radius, fill, top edge) when its code arrives and swaps in.
 */
export const INTERACTIVE_STATE_CLASS = "glass-liquid not-prose my-8 p-3 sm:p-4 md:p-6";

export interface InteractivePlaceholderProps {
  title: string;
  /** Expected height in px from 640 px up. */
  height: number;
  /** Expected height in px on phones; defaults to `height`. */
  mobileHeight?: number;
  /**
   * Expected height in px from 1024 to 1279 px, where the lesson's three
   * columns leave the article narrowest; defaults to `height`.
   */
  midHeight?: number;
  className?: string;
}

/** The placeholder's min-height: phone height, then the 640 px-up height, then the 1024 to 1279 px band. */
export const INTERACTIVE_MIN_HEIGHT_CLASS =
  "min-h-[var(--interactive-height-sm)] sm:min-h-[var(--interactive-height)] lg:max-xl:min-h-[var(--interactive-height-md)]";

/**
 * Stands in for an interactive while its code loads (on a client-side
 * navigation, or after a retry). It reserves the interactive's expected height,
 * so the page does not jump when the interactive swaps in, and carries its title.
 * It is `aria-busy`, not a live region: a lesson with five interactives would
 * otherwise announce "Loading interactive" five times while the learner reads.
 */
export function InteractivePlaceholder({ title, height, mobileHeight, midHeight, className }: InteractivePlaceholderProps) {
  const style = {
    "--interactive-height": `${height}px`,
    "--interactive-height-sm": `${mobileHeight ?? height}px`,
    "--interactive-height-md": `${midHeight ?? height}px`,
  } as React.CSSProperties;
  return (
    <div
      aria-busy="true"
      data-interactive-placeholder=""
      style={style}
      className={cn(INTERACTIVE_STATE_CLASS, INTERACTIVE_MIN_HEIGHT_CLASS, className)}
    >
      <p className="text-ui font-medium text-foreground">{title}</p>
      <p className="mt-1 text-ui text-muted-foreground">{INTERACTIVE_LOADING_TEXT}</p>
    </div>
  );
}

export interface InteractiveErrorProps {
  title: string;
  onRetry: () => void;
  className?: string;
}

/** Shown when an interactive's code fails to load or the interactive throws while rendering. */
export function InteractiveError({ title, onRetry, className }: InteractiveErrorProps) {
  return (
    <div role="alert" data-interactive-error="" className={cn(INTERACTIVE_STATE_CLASS, className)}>
      <p className="text-ui font-medium text-foreground">{title}</p>
      <p className="mt-1 text-ui text-muted-foreground">{INTERACTIVE_FAILED_TEXT}</p>
      <Button type="button" variant="secondary" className="mt-4" onClick={onRetry}>
        {INTERACTIVE_RETRY_LABEL}
      </Button>
    </div>
  );
}

export interface InteractiveBoundaryProps {
  /** The interactive's title, shown in the error state. */
  title: string;
  /** Called when the learner presses Retry, before the boundary renders its children again. */
  onRetry?: () => void;
  /** Called once per failure, for logging. */
  onError?: (error: unknown) => void;
  children: React.ReactNode;
}

interface InteractiveBoundaryState {
  error: unknown;
}

/**
 * An error boundary for one MDX interactive: a failed chunk load or a render
 * error shows "This interactive failed to load" with a Retry button instead of
 * taking the lesson down. Retry clears the error and renders the children
 * again; the caller's `onRetry` gets the chance to drop a cached failed import first.
 */
export class InteractiveBoundary extends React.Component<InteractiveBoundaryProps, InteractiveBoundaryState> {
  state: InteractiveBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): InteractiveBoundaryState {
    return { error: error ?? new Error(INTERACTIVE_FAILED_TEXT) };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }

  retry = () => {
    this.props.onRetry?.();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) return <InteractiveError title={this.props.title} onRetry={this.retry} />;
    return this.props.children;
  }
}

export default InteractiveBoundary;
