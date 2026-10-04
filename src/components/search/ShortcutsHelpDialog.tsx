"use client";

import React, { Fragment, useId, useRef } from "react";
import { X } from "lucide-react";

import { featureFlags } from "@/tools/featureFlags";

import { isApplePlatform } from "./platform";
import { MODAL_LAYER, shellStore, useShellState } from "./shell-store";
import { shortcutHelp, SPOKEN_KEY_NAMES } from "./shortcuts";
import { useModalDialog } from "./useModalDialog";

function Key({ label }: { label: string }) {
  const spoken = SPOKEN_KEY_NAMES[label];
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
      {spoken ? (
        <>
          <span aria-hidden="true">{label}</span>
          <span className="sr-only">{spoken}</span>
        </>
      ) : (
        label
      )}
    </kbd>
  );
}

function KeyCombos({ combos }: { combos: string[][] }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {combos.map((combo, comboIndex) => (
        <Fragment key={combo.join("+")}>
          {comboIndex > 0 && <span className="text-xs text-muted-foreground">or</span>}
          <span className="inline-flex items-center gap-1">
            {combo.map((key, keyIndex) => (
              <Fragment key={key}>
                {keyIndex > 0 && (
                  <span aria-hidden="true" className="text-xs text-muted-foreground">
                    +
                  </span>
                )}
                <Key label={key} />
              </Fragment>
            ))}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

function ShortcutsHelpPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useModalDialog(panelRef, { onClose: shellStore.closeHelp });
  const apple = isApplePlatform();
  const groups = shortcutHelp({ apple, flags: { tracking: featureFlags.tracking, community: featureFlags.community } });

  return (
    <div className={`fixed inset-0 ${MODAL_LAYER} flex items-start justify-center overflow-y-auto px-4 py-6 sm:py-[10vh]`}>
      <div aria-hidden="true" className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={shellStore.closeHelp} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card text-card-foreground shadow-2xl focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-foreground">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={shellStore.closeHelp}
            aria-label="Close keyboard shortcuts"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-6 px-5 py-4">
          <p id={descriptionId} className="text-sm text-muted-foreground">
            Single-key and {apple ? "Option" : "Alt"} shortcuts pause while you type in a field; {apple ? "Cmd" : "Ctrl"}+K
            works everywhere.
          </p>
          {groups.map((group) => (
            <table key={group.title} className="w-full border-collapse text-left text-sm">
              <caption className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Keys</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="py-2 pr-4 align-top">
                      <KeyCombos combos={item.keys} />
                    </td>
                    <td className="py-2 align-top text-foreground">{item.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The "?" help dialog listing every shortcut that works here. */
export default function ShortcutsHelpDialog() {
  const open = useShellState((state) => state.helpOpen);
  return open ? <ShortcutsHelpPanel /> : null;
}
