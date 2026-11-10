import React from 'react';
import Link from 'next/link';

import manifest from '../../content/curriculum/curriculum.manifest.json';
import ShortcutsHelpButton from '@/components/search/ShortcutsHelpButton';
import { moduleHref } from '@/lib/curriculum-data';
import { INTERVIEW_PREP_HREF, LABS_HREF } from '@/lib/site-links';

export const SOURCE_REPO_URL = 'https://github.com/rakeshnreddy/sv-uvm-guide';

const linkClass =
  'rounded px-1 py-0.5 text-muted-foreground underline-offset-4 transition-colors duration-150 ease-bench hover:text-foreground hover:underline motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Column headings: h2 in the label size (12/16, weight 500), primary text, sentence case, no tracking. */
export const FOOTER_HEADING_CLASS = 'px-1 text-label text-foreground';

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
    <footer className="border-t border-border bg-card text-sm text-muted-foreground">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="Site map" className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h2 className={FOOTER_HEADING_CLASS}>Learn</h2>
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
              <li>
                <Link href="/knowledge-hub" className={linkClass}>
                  Knowledge hub
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className={FOOTER_HEADING_CLASS}>Practice</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/practice" className={linkClass}>
                  Practice hub
                </Link>
              </li>
              <li>
                <Link href={LABS_HREF} className={linkClass}>
                  Labs
                </Link>
              </li>
              <li>
                <Link href="/exercises" className={linkClass}>
                  Exercises
                </Link>
              </li>
              <li>
                <Link href={INTERVIEW_PREP_HREF} className={linkClass}>
                  Interview prep
                </Link>
              </li>
              <li>
                <Link href="/assessment" className={linkClass}>
                  Self-assessment
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className={FOOTER_HEADING_CLASS}>Reference</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/resources" className={linkClass}>
                  Resources
                </Link>
              </li>
              <li>
                <Link href="/learning-strategies" className={linkClass}>
                  Learning strategies
                </Link>
              </li>
              <li>
                <Link href="/history" className={linkClass}>
                  History of SystemVerilog and UVM
                </Link>
              </li>
              <li>
                <Link href="/projects" className={linkClass}>
                  Projects
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className={FOOTER_HEADING_CLASS}>About this site</h2>
            <ul className="mt-3 space-y-2">
              {showShortcuts && (
                <li>
                  <ShortcutsHelpButton className="-ml-1 text-muted-foreground" />
                </li>
              )}
              <li>
                <Link href="/privacy-policy" className={linkClass}>
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className={linkClass}>
                  Terms of service
                </Link>
              </li>
            </ul>
          </div>
        </nav>
        <p className="mt-8 border-t border-border pt-6 text-label">
          &copy; {currentYear} SV/UVM Hub · SystemVerilog &amp; UVM learning. MIT licensed.{' '}
          <a href={SOURCE_REPO_URL} className={`${linkClass} underline underline-offset-2`}>
            Source on GitHub
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
