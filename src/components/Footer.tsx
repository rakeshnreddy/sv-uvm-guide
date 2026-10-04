import React from 'react';
import Link from 'next/link';

import manifest from '../../content/curriculum/curriculum.manifest.json';
import ShortcutsHelpButton from '@/components/search/ShortcutsHelpButton';
import { moduleHref } from '@/lib/curriculum-data';

const linkClass =
  'rounded px-1 py-0.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Each tier's first lesson, labelled with the manifest's tier title. */
const tierStarts = manifest.tiers.flatMap((tier) => {
  const href = tier.modules[0] ? moduleHref(tier.modules[0].id) : undefined;
  return href ? [{ title: tier.title, href }] : [];
});

interface FooterProps {
  /** Show the "Keyboard shortcuts" button. Only the learning layout mounts the shortcuts dialog. */
  showShortcuts?: boolean;
}

/** Site footer with a short site map (G30-SIDE-07), so no page, including Privacy and Terms, is a dead end. */
const Footer = ({ showShortcuts = false }: FooterProps) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/40 text-sm text-muted-foreground">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="Site map" className="grid gap-8 sm:grid-cols-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">Learn</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/curriculum" className={linkClass}>
                  Curriculum overview
                </Link>
              </li>
              {tierStarts.map((tier) => (
                <li key={tier.href}>
                  <Link href={tier.href} className={linkClass}>
                    Start {tier.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">Practice</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/practice" className={linkClass}>
                  Practice hub
                </Link>
              </li>
              <li>
                <Link href="/exercises" className={linkClass}>
                  Exercises
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">About this site</h2>
            <ul className="mt-3 space-y-2">
              {showShortcuts && (
                <li>
                  <ShortcutsHelpButton className="-ml-1 text-muted-foreground" />
                </li>
              )}
              <li>
                <Link href="/privacy-policy" className={linkClass}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className={linkClass}>
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </nav>
        <p className="mt-8 border-t border-border pt-6 text-xs">
          &copy; {currentYear} SV/UVM Hub · SystemVerilog &amp; UVM learning. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
