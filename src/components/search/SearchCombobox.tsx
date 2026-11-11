"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Search } from "lucide-react";

import { MENU_SURFACE_CLASS } from "@/components/layout/nav-styles";
import { SignalTag } from "@/components/ui/SignalTag";
import { CURRICULUM_HREF, PRACTICE_HUB_LINK } from "@/lib/site-links";
import { cn } from "@/lib/utils";

import { focusAfterNavigation } from "./focus-target";
import { loadSearchDocuments } from "./load-search-index";
import { useIsApplePlatform } from "./platform";
import {
  MIN_QUERY_LENGTH,
  resultContext,
  resultKindLabel,
  resultTitle,
  searchCurriculum,
  type SearchDocument,
  type SearchResult,
} from "./search-engine";

export interface SearchComboboxProps {
  /**
   * "popup": the results float under the field and close when focus leaves
   * (the navbar). "inline": the results list sits under the field inside the
   * search dialog, and Escape is left to the dialog.
   */
  variant: "popup" | "inline";
  /** Runs when a result is chosen, before navigation starts (for example, to close the dialog). */
  onNavigate?: () => void;
  /** Start loading the index at once (the dialog), instead of on first focus. */
  loadOnMount?: boolean;
  /** The navbar field: Ctrl/Cmd+K and "/" focus it. */
  commandTarget?: boolean;
  testId?: string;
  className?: string;
}

export type LoadState = "idle" | "loading" | "ready" | "error";

const EXAMPLE_QUERIES = ["mailbox", "WSTRB", "uvm_config_db"];

/** The field's placeholder and accessible name, in the navbar and in the dialog. */
export const SEARCH_PLACEHOLDER = "Search lessons, labs and practice";

/**
 * The keyboard hint inside the navbar field. Hidden on phones (the field is
 * not there) and between lg and xl, where the field is too narrow for both
 * the hint and the placeholder.
 */
export const SHORTCUT_HINT_VISIBILITY = "hidden sm:inline-block lg:hidden xl:inline-block";

/** Right padding that keeps typed text clear of the hint, dropped wherever the hint is hidden. */
export const SHORTCUT_FIELD_PADDING = "pr-3 sm:pr-16 lg:pr-3 xl:pr-16";

/** What the index covers, for the empty and no-result states. */
export const SEARCH_SCOPE = "lessons and their sections, labs, exercises, interactive models, tools, interview questions and reference pages";

/** The status line under the field for a query of at least MIN_QUERY_LENGTH characters. */
export function searchStatus(query: string, loadState: LoadState, resultCount: number | null): string {
  if (loadState === "error") return "Search is unavailable right now.";
  if (resultCount === null) return "Loading the search index…";
  if (resultCount === 0) return `Nothing matches “${query}”. Search covers ${SEARCH_SCOPE}.`;
  return `${resultCount} ${resultCount === 1 ? "result" : "results"}.`;
}

function isModifiedClick(event: MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * Search field with a list of results (ARIA 1.2 combobox with list
 * autocomplete and automatic selection): the first result is highlighted,
 * ↑/↓ move, Enter opens, Escape closes the list. Each result is a real link
 * to the lesson, the heading's anchor, or the lab, exercise, model, tool,
 * interview bank or reference page, so it also works with a mouse, a
 * middle-click or "open in new tab". Each result names its kind in text and
 * shows its module code as a signal tag.
 */
export default function SearchCombobox({
  variant,
  onNavigate,
  loadOnMount = false,
  commandTarget = false,
  testId,
  className,
}: SearchComboboxProps) {
  const router = useRouter();
  const apple = useIsApplePlatform();
  // The hint's text depends on the platform, known only after mount: keep it invisible until then so the swap is not a layout shift.
  const [platformKnown, setPlatformKnown] = useState(false);
  useEffect(() => setPlatformKnown(true), []);
  const baseId = useId();
  const listboxId = `${baseId}-results`;
  const hintId = `${baseId}-hint`;
  const optionId = useCallback((index: number) => `${baseId}-option-${index}`, [baseId]);

  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<SearchDocument[] | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const loadStateRef = useRef<LoadState>("idle");
  const [activeIndex, setActiveIndex] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);

  const ensureLoaded = useCallback(() => {
    if (loadStateRef.current === "loading" || loadStateRef.current === "ready") return;
    loadStateRef.current = "loading";
    setLoadState("loading");
    loadSearchDocuments()
      .then((loaded) => {
        loadStateRef.current = "ready";
        setDocs(loaded);
        setLoadState("ready");
      })
      .catch(() => {
        loadStateRef.current = "error";
        setLoadState("error");
      });
  }, []);

  useEffect(() => {
    if (loadOnMount) ensureLoaded();
  }, [loadOnMount, ensureLoaded]);

  const trimmed = query.trim();
  const queryReady = trimmed.length >= MIN_QUERY_LENGTH;
  const results = useMemo<SearchResult[]>(
    () => (docs && queryReady ? searchCurriculum(docs, trimmed) : []),
    [docs, queryReady, trimmed],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  const panelVisible = (variant === "inline" || popupOpen) && queryReady;
  const listVisible = panelVisible && results.length > 0;
  const active = listVisible ? Math.min(activeIndex, results.length - 1) : -1;
  const activeResult = active >= 0 ? results[active] : undefined;

  useEffect(() => {
    if (active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
  }, [active, optionId]);

  const finish = useCallback(() => {
    setPopupOpen(false);
    setQuery("");
    onNavigate?.();
  }, [onNavigate]);

  const choose = useCallback(
    (result: SearchResult) => {
      finish();
      router.push(result.doc.href);
      focusAfterNavigation(result.doc.href);
    },
    [finish, router],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (!queryReady) return;
        event.preventDefault();
        if (!panelVisible) {
          setPopupOpen(true);
          return;
        }
        if (results.length === 0) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((Math.max(active, 0) + step + results.length) % results.length);
        return;
      }
      case "Enter":
        if (activeResult) {
          event.preventDefault();
          choose(activeResult);
        }
        return;
      case "Escape":
        if (variant !== "popup") return; // the search dialog closes itself
        if (panelVisible) {
          event.preventDefault();
          setPopupOpen(false);
        } else if (query) {
          event.preventDefault();
          setQuery("");
        }
        return;
      default:
    }
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (variant === "popup" && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setPopupOpen(false);
    }
  };

  const onResultClick = (event: MouseEvent<HTMLAnchorElement>, result: SearchResult) => {
    if (isModifiedClick(event)) return; // a new tab or window: leave this page as it is
    finish();
    focusAfterNavigation(result.doc.href);
  };

  const status = queryReady ? searchStatus(trimmed, loadState, docs ? results.length : null) : "";
  const shortcut = commandTarget ? (apple ? "⌘K" : "Ctrl K") : null;

  return (
    <div className={cn("relative w-full", className)} onBlur={onBlur}>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          role="combobox"
          aria-label={SEARCH_PLACEHOLDER}
          aria-autocomplete="list"
          aria-expanded={listVisible}
          aria-controls={listboxId}
          aria-activedescendant={activeResult ? optionId(active) : undefined}
          aria-describedby={hintId}
          aria-keyshortcuts={commandTarget ? "Control+K Meta+K /" : undefined}
          data-command-target={commandTarget ? "global-search" : undefined}
          data-testid={testId}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="go"
          placeholder={SEARCH_PLACEHOLDER}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPopupOpen(true);
            ensureLoaded();
          }}
          onFocus={() => {
            ensureLoaded();
            setPopupOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "h-10 w-full rounded-lg border border-input bg-background pl-9 text-base text-foreground md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            shortcut ? SHORTCUT_FIELD_PADDING : "pr-3",
          )}
        />
        {shortcut && (
          <kbd
            aria-hidden="true"
            data-search-shortcut=""
            className={cn(
              // A fixed box, so "Ctrl K" and "⌘K" take the same room.
              "pointer-events-none absolute right-2 top-1/2 w-14 -translate-y-1/2 rounded border border-border py-0.5 text-center font-mono text-label text-muted-foreground",
              SHORTCUT_HINT_VISIBILITY,
              !platformKnown && "invisible",
            )}
          >
            {shortcut}
          </kbd>
        )}
      </div>

      <p id={hintId} className={variant === "inline" && !queryReady ? "mt-3 text-sm text-muted-foreground" : "sr-only"}>
        {`Search ${SEARCH_SCOPE}. Type at least ${MIN_QUERY_LENGTH} characters, for example ${EXAMPLE_QUERIES.map((example) => `“${example}”`).join(", ")}.`}
        <span className="sr-only"> Use the up and down arrow keys to choose a result, then Enter to open it.</span>
      </p>

      {/* Announced as the results change; the visible panel shows the same message. */}
      <p role="status" className="sr-only">
        {status}
      </p>

      <div hidden={!panelVisible}>
        <div
          data-search-panel={variant}
          className={variant === "popup" ? cn(MENU_SURFACE_CLASS, "absolute left-0 right-0 top-full z-50 mt-3 min-w-[20rem] overflow-hidden") : "mt-3"}
        >
          {loadState === "error" ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Search is unavailable right now.{" "}
              <Link href={CURRICULUM_HREF} className="font-medium text-foreground underline underline-offset-2">
                Browse the curriculum
              </Link>{" "}
              or the{" "}
              <Link href={PRACTICE_HUB_LINK.href} className="font-medium text-foreground underline underline-offset-2">
                {PRACTICE_HUB_LINK.label}
              </Link>
              .
            </p>
          ) : (
            results.length === 0 && (
              <p aria-hidden="true" className="px-3 py-3 text-sm text-muted-foreground">
                {status}
              </p>
            )
          )}
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Search results"
            hidden={!listVisible}
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
              "overflow-y-auto overscroll-contain p-1",
              variant === "popup" ? "max-h-[min(70vh,28rem)]" : "max-h-[min(60vh,32rem)]",
            )}
          >
            {results.map((result, index) => {
              const selected = index === active;
              const context = resultContext(result.doc);
              return (
                <li key={result.doc.id} role="none">
                  <Link
                    id={optionId(index)}
                    role="option"
                    aria-selected={selected}
                    href={result.doc.href}
                    prefetch={false}
                    tabIndex={-1}
                    data-href={result.doc.href}
                    data-kind={result.doc.kind}
                    onClick={(event) => onResultClick(event, result)}
                    onMouseMove={() => {
                      if (!selected) setActiveIndex(index);
                    }}
                    className={cn(
                      "block rounded-lg border-l-2 px-3 py-2 text-left transition-colors duration-150 ease-bench motion-reduce:transition-none",
                      selected ? "border-primary bg-muted" : "border-transparent hover:bg-muted",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span data-search-title="" className="min-w-0 break-words text-sm font-normal text-foreground">
                        {resultTitle(result.doc)}
                      </span>
                      <span data-search-kind="" className="shrink-0 text-label font-medium text-muted-foreground">
                        {resultKindLabel(result.doc)}
                      </span>
                    </span>
                    {(context.code || context.text) && (
                      <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        {context.code && <SignalTag code={context.code} />}
                        {context.text && <span className="min-w-0 truncate">{context.text}</span>}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          {listVisible && (
            <p aria-hidden="true" className="border-t border-glass-border px-3 py-2 text-xs text-muted-foreground">
              ↑ ↓ to choose · Enter to open · Esc to close
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
