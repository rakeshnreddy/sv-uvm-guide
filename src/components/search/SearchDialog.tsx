"use client";

import React, { useId, useRef } from "react";
import { X } from "lucide-react";

import SearchCombobox from "./SearchCombobox";
import { MODAL_LAYER, shellStore, useShellState } from "./shell-store";
import { useModalDialog } from "./useModalDialog";

const iconButton =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none";

function SearchDialogPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalDialog(panelRef, {
    onClose: shellStore.closeSearch,
    initialFocus: () => panelRef.current?.querySelector<HTMLInputElement>('input[role="combobox"]'),
  });

  return (
    <div className={`fixed inset-0 ${MODAL_LAYER} flex items-start justify-center px-4 pb-4 pt-4 sm:pt-[12vh]`}>
      <div aria-hidden="true" className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={shellStore.closeSearch} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid="search-dialog"
        className="relative flex max-h-full w-full max-w-xl flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-2xl focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            Search the curriculum
          </h2>
          <button type="button" onClick={shellStore.closeSearch} aria-label="Close search" className={iconButton}>
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          <SearchCombobox variant="inline" loadOnMount onNavigate={shellStore.closeSearch} />
        </div>
      </div>
    </div>
  );
}

/** The search dialog: the phone search button, and Ctrl/Cmd+K when the navbar field is hidden. */
export default function SearchDialog() {
  const open = useShellState((state) => state.searchOpen);
  return open ? <SearchDialogPanel /> : null;
}
