"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useId, useRef, useState, type FocusEvent } from "react";
import { ChevronDown } from "lucide-react";

import { currentChild, topItemCurrent } from "@/components/layout/nav-current";
import { barLinkClass, menuItemClass, menuPanelClass } from "@/components/layout/nav-styles";
import { useDismiss } from "@/components/layout/use-dismiss";
import type { NavGroup } from "@/lib/site-links";
import { cn } from "@/lib/utils";

interface NavDisclosureProps {
  group: NavGroup;
  pathname: string | null;
}

/**
 * A top-level group in the bar (Practice, Reference), as a WAI-ARIA disclosure
 * of links, not a menu: a button with aria-expanded and aria-controls and a
 * panel of plain links. Escape closes it and returns focus to the button;
 * focus leaving it, a press outside it, following a link or a route change
 * close it too.
 */
export default function NavDisclosure({ group, pathname }: NavDisclosureProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, containerRef, buttonRef, close);
  useEffect(() => close(), [pathname, close]);

  const current = topItemCurrent(pathname, group);
  const marked = currentChild(pathname, group.children);

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next && !containerRef.current?.contains(next)) close();
  };

  return (
    <div ref={containerRef} className="relative" onBlur={onBlur} data-nav-disclosure={group.label}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-current={current}
        className={barLinkClass(Boolean(current))}
      >
        {group.label}
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 transition-transform duration-200 ease-bench motion-reduce:transition-none", open && "rotate-180")}
        />
      </button>
      <div id={panelId} className={menuPanelClass(open)} data-state={open ? "open" : "closed"}>
        <ul className="space-y-0.5">
          {group.children.map((link) => {
            const isCurrent = marked?.href === link.href;
            return (
              <li key={link.href}>
                <Link href={link.href} aria-current={isCurrent ? marked.current : undefined} onClick={close} className={menuItemClass(isCurrent)}>
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
