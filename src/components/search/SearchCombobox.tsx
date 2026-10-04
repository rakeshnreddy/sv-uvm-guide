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

import { cn } from "@/lib/utils";

import { focusAfterNavigation } from "./focus-target";
import { loadSearchDocuments } from "./load-search-index";
import { useIsApplePlatform } from "./platform";
import {
  describeResult,
  MIN_QUERY_LENGTH,
  resultKindLabel,
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

type LoadState = "idle" | "loading" | "ready" | "error";

const EXAMPLE_QUERIES = ["mailbox", "WSTRB", "uvm_config_db"];

function isModifiedClick(event: MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * Search field with a list of results (ARIA 1.2 combobox with list
 * autocomplete and automatic selection): the first result is highlighted,
 * ↑/↓ move, Enter opens, Escape closes the list. Each result is a real link
 * to the lesson or to the heading's anchor, so it also works with a mouse,
 * a middle-click or "open in new tab".
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

  let status = "";
  if (queryReady) {
    if (loadState === "error") status = "Search is unavailable right now.";
    else if (!docs) status = "Loading the search index…";
    else if (results.length === 0) status = `No lessons or sections match “${trimmed}”.`;
    else status = `${results.length} ${results.length === 1 ? "result" : "results"}.`;
  }

  const placeholder = commandTarget ? `Search lessons… (${apple ? "⌘K" : "Ctrl K"})` : "Search lessons and sections";

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
          aria-label="Search lessons and sections"
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
          placeholder={placeholder}
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
          className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      </div>

      <p id={hintId} className={variant === "inline" && !queryReady ? "mt-3 text-sm text-muted-foreground" : "sr-only"}>
        {`Type at least ${MIN_QUERY_LENGTH} characters. Try ${EXAMPLE_QUERIES.map((example) => `“${example}”`).join(", ")}.`}
        <span className="sr-only"> Use the up and down arrow keys to choose a result, then Enter to open it.</span>
      </p>

      {/* Announced as the results change; the visible panel shows the same message. */}
      <p role="status" className="sr-only">
        {status}
      </p>

      <div hidden={!panelVisible}>
        <div
          className={
            variant === "popup"
              ? "absolute left-0 right-0 top-full z-50 mt-2 min-w-[20rem] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl"
              : "mt-3"
          }
        >
          {loadState === "error" ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Search is unavailable right now.{" "}
              <Link href="/curriculum" className="font-medium text-foreground underline underline-offset-2">
                Browse the curriculum
              </Link>
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
                    onClick={(event) => onResultClick(event, result)}
                    onMouseMove={() => {
                      if (!selected) setActiveIndex(index);
                    }}
                    className={cn(
                      "block rounded-lg border-l-4 px-3 py-2 text-left transition-colors motion-reduce:transition-none",
                      selected ? "border-primary bg-muted" : "border-transparent hover:bg-muted/60",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words text-sm font-medium text-foreground">{result.doc.title}</span>
                      <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {resultKindLabel(result.doc)}
                      </span>
                    </span>
                    <span className="mt-0.5 block break-words text-xs text-muted-foreground">{describeResult(result.doc)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {listVisible && (
            <p aria-hidden="true" className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              ↑ ↓ to choose · Enter to open · Esc to close
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
