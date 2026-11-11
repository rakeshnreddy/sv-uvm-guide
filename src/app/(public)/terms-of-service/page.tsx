import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import Footer from '@/components/Footer';
import { Section } from '@/components/layout/Section';
import InfoPage, { infoSectionId } from '@/components/templates/InfoPage';
import { Prose } from '@/components/ui/Prose';
import { LEGAL_LINKS, SITE_NAME, TERMS_OF_SERVICE_HREF } from '@/lib/site-links';

/** The page's one label, from the shared navigation config. */
const PAGE_LABEL = LEGAL_LINKS.find((link) => link.href === TERMS_OF_SERVICE_HREF)?.label ?? '';

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
    heading: 'Using the platform',
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
    heading: 'Contributor responsibilities',
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
    heading: 'Availability and updates',
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
  title: PAGE_LABEL,
  description: `Guidelines for using ${SITE_NAME}.`,
};

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col text-foreground sm:min-h-[calc(100vh-4rem)]">
      <main id="main-content" className="flex-1">
        <InfoPage
          width="reading"
          prose={false}
          title={PAGE_LABEL}
          description={`Guidelines for using ${SITE_NAME}.`}
          meta={<span>Last updated: October 2026</span>}
        >
          {commitments.map((section) => (
            <Section key={section.heading} id={infoSectionId(section.heading)} title={section.heading}>
              <Prose>
                <ul>
                  {section.points.map((item) => (
                    <li key={item.id}>{item.content}</li>
                  ))}
                </ul>
              </Prose>
            </Section>
          ))}
        </InfoPage>
      </main>
      <Footer />
    </div>
  );
}
