"use client";

/**
 * The site's code editor: Monaco (@monaco-editor/react) first, with a plain
 * <textarea> that takes over when Monaco cannot be used.
 *
 * Monaco's loader fetches the editor from a CDN (cdn.jsdelivr.net). Where that
 * is blocked, offline or slow, Monaco would show "Loading editor…" forever, so
 * the plain editor replaces it when
 * - the Monaco package or the CDN editor fails to load (loader.init() rejects),
 * - Monaco throws while rendering (an error boundary), or
 * - Monaco has not mounted within loadTimeoutMs (8 s by default).
 * After a timeout, Monaco keeps loading in the background. When it arrives it
 * comes back by itself if the learner has not used the plain editor yet;
 * otherwise a "Switch to the full editor" button is offered, so text is never
 * swapped out from under them.
 *
 * Both editors share one contract: `value` in, `onChange(value: string)` out,
 * one accessible name, and readOnly. Nothing here touches storage.
 */
import type { BeforeMount, EditorProps, OnMount } from "@monaco-editor/react";
import dynamic from "next/dynamic";
import React, { Component, useCallback, useEffect, useId, useLayoutEffect, useReducer, useRef } from "react";

import { cn } from "@/lib/utils";

/** How long Monaco may take to mount before the plain editor replaces it. */
export const MONACO_LOAD_TIMEOUT_MS = 8000;
export const EDITOR_LOADING_TEXT = "Loading editor…";
export const EDITOR_FALLBACK_NOTE = "The full code editor could not load, so this is a plain text editor.";
export const EDITOR_RECOVERED_NOTE = "The full code editor has loaded.";
export const EDITOR_SWITCH_LABEL = "Switch to the full editor";
export const PLAIN_EDITOR_TAB_HINT = "Tab inserts two spaces. To leave the editor, press Esc, then Tab.";

/** What the plain editor inserts for Tab. */
const INDENT = "  ";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function EditorLoading() {
  return <div className="flex h-full items-center justify-center">{EDITOR_LOADING_TEXT}</div>;
}

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.default), {
  ssr: false,
  loading: () => <EditorLoading />,
});

/** Loads the Monaco package and then the editor itself from the loader's CDN. Rejects when either cannot load. */
function loadMonaco(): Promise<unknown> {
  return import("@monaco-editor/react").then((mod) => mod.loader.init());
}

// ---------------------------------------------------------------------------
// Load state
// ---------------------------------------------------------------------------

export interface EditorLoadState {
  /** Which editor is showing. */
  mode: "monaco" | "plain";
  /** Monaco has mounted since it was last shown. */
  ready: boolean;
  /** Why the plain editor is showing: Monaco was too slow, or it cannot load. */
  reason: "timeout" | "error" | null;
  /** The Monaco loader resolved, so Monaco can come back quickly. */
  available: boolean;
  /** The learner has focused the plain editor, so it is not swapped out by itself. */
  touched: boolean;
  /** Monaco replaced the plain editor (announced once it mounts). */
  recovered: boolean;
  /** Focus Monaco when it mounts: the learner asked to switch. */
  focusOnMount: boolean;
}

export type EditorLoadEvent =
  | { type: "mounted" }
  | { type: "timeout" }
  | { type: "failed"; source: "loader" | "render" }
  | { type: "available" }
  | { type: "touched" }
  | { type: "switch" };

export const initialEditorLoadState: EditorLoadState = Object.freeze({
  mode: "monaco",
  ready: false,
  reason: null,
  available: false,
  touched: false,
  recovered: false,
  focusOnMount: false,
});

/** The editor's load state machine. Pure. */
export function editorLoadReducer(state: EditorLoadState, event: EditorLoadEvent): EditorLoadState {
  switch (event.type) {
    case "mounted":
      return state.mode === "monaco" && !state.ready ? { ...state, ready: true, focusOnMount: false } : state;
    case "timeout":
      return state.mode === "monaco" && !state.ready
        ? { ...state, mode: "plain", reason: "timeout", recovered: false, focusOnMount: false }
        : state;
    case "failed":
      // A loader failure after Monaco mounted changes nothing; a render error always falls back.
      if (event.source === "loader" && state.mode === "monaco" && state.ready) return state;
      return {
        ...state,
        mode: "plain",
        ready: false,
        reason: "error",
        available: false,
        recovered: false,
        focusOnMount: false,
      };
    case "available":
      if (state.available || state.reason === "error") return state;
      if (state.mode === "plain" && state.reason === "timeout" && !state.touched) {
        return { ...state, available: true, mode: "monaco", ready: false, reason: null, recovered: true };
      }
      return { ...state, available: true };
    case "touched":
      return state.touched ? state : { ...state, touched: true };
    case "switch":
      return state.mode === "plain" && state.reason === "timeout" && state.available
        ? { ...state, mode: "monaco", ready: false, reason: null, recovered: true, focusOnMount: true }
        : state;
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Monaco error boundary
// ---------------------------------------------------------------------------

interface MonacoBoundaryProps {
  onError: () => void;
  children: React.ReactNode;
}

/** Catches a Monaco chunk or render failure so the plain editor can take over. */
class MonacoBoundary extends Component<MonacoBoundaryProps, { failed: boolean }> {
  public state = { failed: false };

  public static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  public componentDidCatch() {
    this.props.onError();
  }

  public render() {
    return this.state.failed ? null : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// The plain editor
// ---------------------------------------------------------------------------

export interface PlainCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  /** The editor's accessible name. */
  ariaLabel: string;
  readOnly?: boolean;
  onFocus?: () => void;
  className?: string;
}

/**
 * A labelled monospace <textarea>. When editable, Tab inserts two spaces;
 * Esc then Tab moves focus on (so the editor never traps the keyboard), and
 * Shift+Tab always moves focus back. A visible hint says so.
 */
export function PlainCodeEditor({ value, onChange, ariaLabel, readOnly = false, onFocus, className }: PlainCodeEditorProps) {
  const hintId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const releaseTabRef = useRef(false);
  /** The caret to restore once the parent accepts an inserted indent. */
  const pendingCaretRef = useRef<{ value: string; caret: number } | null>(null);

  useLayoutEffect(() => {
    const pending = pendingCaretRef.current;
    pendingCaretRef.current = null;
    const textarea = textareaRef.current;
    if (pending && textarea && textarea.value === pending.value) {
      textarea.setSelectionRange(pending.caret, pending.caret);
    }
  }, [value]);

  const insertIndent = (textarea: HTMLTextAreaElement) => {
    // execCommand keeps the browser's undo history and fires a normal input event; engines without it get a splice.
    let inserted = false;
    try {
      inserted = typeof document.execCommand === "function" && document.execCommand("insertText", false, INDENT);
    } catch {
      inserted = false;
    }
    if (inserted) return;
    const { selectionStart, selectionEnd } = textarea;
    const next = textarea.value.slice(0, selectionStart) + INDENT + textarea.value.slice(selectionEnd);
    pendingCaretRef.current = { value: next, caret: selectionStart + INDENT.length };
    onChange?.(next);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      releaseTabRef.current = true;
      return;
    }
    const release = releaseTabRef.current;
    releaseTabRef.current = false;
    if (
      readOnly
      || release
      || event.key !== "Tab"
      || event.shiftKey
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    insertIndent(event.currentTarget);
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <textarea
        ref={textareaRef}
        aria-label={ariaLabel}
        aria-describedby={readOnly ? undefined : hintId}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          releaseTabRef.current = false;
        }}
        onFocus={onFocus}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className={cn(
          "block min-h-0 w-full flex-1 resize-none border-0 bg-background p-3 font-mono text-sm leading-6 text-foreground [tab-size:2]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
      />
      {readOnly ? null : (
        <p id={hintId} className="border-t border-border bg-muted px-3 py-1 text-xs text-foreground">
          {PLAIN_EDITOR_TAB_HINT}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  /** Monaco's language id; the plain editor ignores it. */
  language?: string;
  /** The accessible name of whichever editor is showing. */
  ariaLabel: string;
  readOnly?: boolean;
  /** CSS height of the editor box, e.g. "100%" or "400px". */
  height: string;
  className?: string;
  /** Monaco theme name. */
  theme?: string;
  beforeMount?: BeforeMount;
  onMount?: OnMount;
  /** Further Monaco options; ariaLabel and readOnly come from the props above. */
  options?: EditorProps["options"];
  /** How long Monaco may take to mount before the plain editor replaces it. */
  loadTimeoutMs?: number;
  /** Told whenever the plain editor starts (true) or stops (false) showing. */
  onFallbackChange?: (usingPlainEditor: boolean) => void;
}

export function CodeEditor({
  value,
  onChange,
  language,
  ariaLabel,
  readOnly = false,
  height,
  className,
  theme,
  beforeMount,
  onMount,
  options,
  loadTimeoutMs = MONACO_LOAD_TIMEOUT_MS,
  onFallbackChange,
}: CodeEditorProps) {
  const [state, dispatch] = useReducer(editorLoadReducer, initialEditorLoadState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onMountRef = useRef(onMount);
  onMountRef.current = onMount;
  const onFallbackChangeRef = useRef(onFallbackChange);
  onFallbackChangeRef.current = onFallbackChange;

  // Find out early whether Monaco can load at all (an offline or blocked CDN rejects quickly).
  useEffect(() => {
    let active = true;
    loadMonaco().then(
      () => {
        if (active) dispatch({ type: "available" });
      },
      () => {
        if (active) dispatch({ type: "failed", source: "loader" });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  // Monaco gets loadTimeoutMs each time it is shown.
  useEffect(() => {
    if (state.mode !== "monaco" || state.ready) return undefined;
    const timer = setTimeout(() => dispatch({ type: "timeout" }), loadTimeoutMs);
    return () => clearTimeout(timer);
  }, [loadTimeoutMs, state.mode, state.ready]);

  const plain = state.mode === "plain";
  useEffect(() => {
    onFallbackChangeRef.current?.(plain);
  }, [plain]);

  const handleMount = useCallback<OnMount>((editor, monaco) => {
    const focus = stateRef.current.focusOnMount;
    dispatch({ type: "mounted" });
    if (focus) editor.focus();
    onMountRef.current?.(editor, monaco);
  }, []);

  const handleRenderError = useCallback(() => dispatch({ type: "failed", source: "render" }), []);
  const handleTouched = useCallback(() => dispatch({ type: "touched" }), []);

  const statusText = plain ? EDITOR_FALLBACK_NOTE : state.recovered && state.ready ? EDITOR_RECOVERED_NOTE : "";
  const canSwitch = plain && state.reason === "timeout" && state.available;

  return (
    <div
      data-editor={plain ? "plain" : "monaco"}
      className={cn(plain ? "flex flex-col" : "relative", className)}
      style={{ height }}
    >
      {/* Rendered in both modes so the status region stays mounted and its change is announced. */}
      <div className={plain ? "flex flex-wrap items-center gap-2 border-b border-border bg-muted px-3 py-2" : "sr-only"}>
        <p role="status" aria-live="polite" className="min-w-0 flex-1 text-xs text-foreground">{statusText}</p>
        {canSwitch ? (
          <button
            type="button"
            onClick={() => dispatch({ type: "switch" })}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground",
              focusRing,
            )}
          >
            {EDITOR_SWITCH_LABEL}
          </button>
        ) : null}
      </div>
      {plain ? (
        <PlainCodeEditor
          value={value}
          onChange={onChange}
          ariaLabel={ariaLabel}
          readOnly={readOnly}
          onFocus={handleTouched}
        />
      ) : (
        <MonacoBoundary onError={handleRenderError}>
          <MonacoEditor
            height="100%"
            language={language}
            value={value}
            onChange={(next) => onChange?.(next ?? "")}
            beforeMount={beforeMount}
            onMount={handleMount}
            theme={theme}
            loading={<EditorLoading />}
            options={{ ...options, ariaLabel, readOnly }}
          />
        </MonacoBoundary>
      )}
    </div>
  );
}

export default CodeEditor;
