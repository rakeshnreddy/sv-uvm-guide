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
 * (/settings#data). It is reversible; revisit it before accounts, the AI tutor,
 * the community forum or any analytics are switched on. The contact address is
 * unchanged.
 */

const settingsLink = (
  <Link href="/settings#data" className="text-primary underline underline-offset-4 hover:no-underline">
    Settings
  </Link>
);

const sections = [
  {
    heading: 'Information We Collect',
    body: (
      <ul>
        <li>This site has no accounts yet. You don&apos;t sign up, and we don&apos;t ask for your name, email address or any other personal details.</li>
        <li>
          Your learning data stays in your browser. Lesson progress, the lessons you opened and the days you studied,
          flashcard reviews, Teach-it-back notes and other notebook entries, lab code, quiz and placement results,
          exercise scores and your chosen learning route are kept in this browser&apos;s local storage. They are never
          sent to the site.
        </li>
        <li>Your theme preference is stored locally in this browser too.</li>
        <li>
          Like any website, the hosting provider that delivers these pages receives the standard details of each
          request, such as your IP address and browser type, in order to serve the pages and keep the site secure.
        </li>
      </ul>
    ),
  },
  {
    heading: 'How We Use Your Data',
    body: (
      <ul>
        <li>
          Data in your browser is used only by the pages you open there, for example to show your dashboard, your
          flashcard review queue and where you left off.
        </li>
        <li>Lab checks run in your browser. Your lab code is not uploaded, compiled or simulated on a server.</li>
        <li>No AI service and no community forum are active, so nothing you write is sent to one.</li>
        <li>We don&apos;t build profiles, show advertising, or sell or share learner data.</li>
      </ul>
    ),
  },
  {
    heading: 'Retention & Control',
    body: (
      <ul>
        <li>
          Your data stays in this browser until you delete it. In {settingsLink} you can download a backup, import one,
          or delete all of your learning data.
        </li>
        <li>
          Clearing this site&apos;s data in your browser deletes it, and some browsers remove data for sites you
          haven&apos;t visited for a while. Keep a backup if you want to be able to restore your progress.
        </li>
        <li>
          Data in one browser isn&apos;t visible in another browser or on another device. To move it, download a backup
          and import it there.
        </li>
        <li>Because we never receive your learning data, we can&apos;t see it, and we can&apos;t recover it for you if it is deleted.</li>
      </ul>
    ),
  },
  {
    heading: 'Cookies & Third Parties',
    body: (
      <ul>
        <li>There are no cookies for signing in, because there is nothing to sign in to.</li>
        <li>Your theme preference and learning data use your browser&apos;s local storage, not cookies.</li>
        <li>No analytics or advertising trackers are loaded.</li>
        <li>
          The full code editor in labs and code examples is loaded from the jsDelivr content network, which therefore
          sees your IP address when it sends the editor. If it is blocked, a plain text editor is used instead and
          nothing is sent.
        </li>
      </ul>
    ),
  },
  {
    heading: 'Questions or Requests',
    body: (
      <p>
        Contact <a href="mailto:privacy@sv-uvm-guide.dev" className="text-primary hover:underline">privacy@sv-uvm-guide.dev</a> with
        questions about this policy. Your learning data never leaves your browser, so you can view, export or delete
        it yourself in {settingsLink}.
      </p>
    ),
  },
];

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'The SystemVerilog & UVM learning site has no accounts: your learning data stays in your browser.',
};

export default function PrivacyPolicyPage() {
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
          title="Privacy Policy"
          description="There are no accounts on this site, and your learning data stays in your browser."
        >
          <div className="space-y-10">
            <p className="text-sm text-foreground/80">Last updated: October 2026</p>
            {sections.map((section) => (
              <section key={section.heading} className="space-y-4">
                <h2 className="text-2xl font-semibold text-primary">{section.heading}</h2>
                <div className="prose max-w-none text-foreground/90 dark:prose-invert">{section.body}</div>
              </section>
            ))}
          </div>
        </InfoPage>
      </main>
      <Footer />
    </div>
  );
}
