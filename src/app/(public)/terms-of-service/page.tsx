import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import Footer from '@/components/Footer';
import InfoPage from '@/components/templates/InfoPage';
import Logo from '@/components/ui/Logo';

const commitments = [
  {
    heading: 'Using the Platform',
    points: [
      'You may access the curriculum, labs, and visual assets for personal or organizational learning.',
      'Accounts must belong to real people; automated scraping or credential sharing is not permitted.',
      'Downloaded lab material keeps its open-source license; credit the project when you redistribute changes.',
    ],
  },
  {
    heading: 'Contributor Responsibilities',
    points: [
      'Follow the style guide and Definition of Done before submitting pull requests.',
      'Do not upload proprietary RTL or verification IP unless you own the rights to share it.',
      'Disclose simulated data or anonymized logs that originate from real silicon projects.',
    ],
  },
  {
    heading: 'Availability & Updates',
    points: [
      'We aim for 99.5% uptime; planned maintenance windows are announced in the community channel.',
      'Feature flags may hide beta functionality until the curriculum steward approves a release.',
      'Breaking changes to API contracts or schema migrations are documented two sprints in advance.',
    ],
  },
  {
    heading: 'Termination',
    points: [
      'We reserve the right to disable access that violates the code of conduct or endangers learners.',
      'You may delete your account at any time; feedback helps us resolve issues before departure.',
      'Inactive beta accounts are purged after 12 months to protect learner data.',
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
          description="Guidelines for engaging with the SystemVerilog &amp; UVM learning platform."
        >
          <div className="space-y-10">
            <p className="text-sm text-foreground/80">Last updated: October 7, 2025</p>
            {commitments.map((section) => (
              <section key={section.heading} className="space-y-4">
                <h2 className="text-2xl font-semibold text-primary">{section.heading}</h2>
                <ul className="list-disc space-y-2 pl-6 text-foreground/90">
                  {section.points.map((item) => (
                    <li key={item}>{item}</li>
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
