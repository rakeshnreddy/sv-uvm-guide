import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import Footer from '@/components/Footer';
import InfoPage from '@/components/templates/InfoPage';
import Logo from '@/components/ui/Logo';

/*
 * OWNER SIGN-OFF NEEDED (GD23): this wording was rewritten in October 2026 for
 * the site as deployed without accounts: learner data lives only in the
 * browser's local storage, with export, import and reset in Settings
 * (/settings#data). The uptime promise, the community channel and the account
 * deletion and purge terms were removed because none of them exist. It is
 * reversible; revisit it before accounts or community features are switched on.
 */

const settingsLink = (
  <Link href="/settings#data" className="text-primary underline underline-offset-4 hover:no-underline">
    Settings
  </Link>
);

const commitments: { heading: string; points: { id: string; content: React.ReactNode }[] }[] = [
  {
    heading: 'Using the Platform',
    points: [
      {
        id: 'personal-use',
        content: 'You may use the curriculum, labs, and visual assets for personal or organizational learning.',
      },
      {
        id: 'no-account',
        content: (
          <>
            No account is needed. Your progress is kept in your browser&apos;s local storage, not on our servers; use{' '}
            {settingsLink} to back it up, import it, or delete it.
          </>
        ),
      },
      {
        id: 'fair-use',
        content: 'Do not scrape the site or send automated traffic that slows it down for other learners.',
      },
      {
        id: 'license',
        content:
          'Downloaded lab material keeps its open-source license; credit the project when you redistribute changes.',
      },
    ],
  },
  {
    heading: 'Contributor Responsibilities',
    points: [
      { id: 'style', content: 'Follow the style guide and Definition of Done before submitting pull requests.' },
      {
        id: 'rights',
        content: 'Do not upload proprietary RTL or verification IP unless you own the rights to share it.',
      },
      {
        id: 'disclose',
        content: 'Disclose simulated data or anonymized logs that originate from real silicon projects.',
      },
    ],
  },
  {
    heading: 'Availability & Updates',
    points: [
      {
        id: 'as-is',
        content:
          'The site is provided as is, without a guaranteed uptime. Pages may change, or be briefly unavailable, while they are updated.',
      },
      {
        id: 'unreleased',
        content: 'Features that are not ready stay switched off until they are.',
      },
      {
        id: 'revisions',
        content:
          'Lessons and labs are revised over time, so progress saved in your browser may refer to an earlier version of a lab.',
      },
    ],
  },
  {
    heading: 'Termination',
    points: [
      {
        id: 'conduct',
        content: 'We may block access that violates the code of conduct or endangers learners.',
      },
      {
        id: 'stop',
        content: (
          <>
            You can stop using the site at any time. To remove your learning data, delete it in {settingsLink} or clear
            this site&apos;s data in your browser.
          </>
        ),
      },
      {
        id: 'browser-only',
        content:
          "Because your data lives only in your browser's local storage, clearing site data, or a browser removing data for sites you haven't visited for a while, deletes it. Keep a backup.",
      },
    ],
  },
];

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Guidelines for using the SystemVerilog & UVM learning site.',
};

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="SV/UVM Hub home"
            className="block w-32 shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[150px]"
          >
            <Logo />
          </Link>
          <nav aria-label="Main">
            <Link
              href="/curriculum"
              className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Back to the curriculum
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" className="flex-1">
        <InfoPage
          title="Terms of Service"
          description="Guidelines for using the SystemVerilog &amp; UVM learning site."
        >
          <div className="space-y-10">
            <p className="text-sm text-foreground/80">Last updated: October 2026</p>
            {commitments.map((section) => (
              <section key={section.heading} className="space-y-4">
                <h2 className="text-2xl font-semibold text-primary">{section.heading}</h2>
                <ul className="list-disc space-y-2 pl-6 text-foreground/90">
                  {section.points.map((item) => (
                    <li key={item.id}>{item.content}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </InfoPage>
      </main>
      <Footer />
    </div>
  );
}
