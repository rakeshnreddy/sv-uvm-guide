import React from 'react';
import type { Metadata } from 'next';

import { PageShell } from '@/components/layout/PageShell';
import { LearnerPageHeader } from '@/components/learner/LearnerSectionNav';
import { siteLabel } from '@/lib/nav-labels';
import { NOTEBOOK_HREF } from '@/lib/site-links';

import NotebookPageClient from './NotebookPageClient';

export const metadata: Metadata = {
  title: siteLabel(NOTEBOOK_HREF),
  description:
    'Your Teach it back explanations and notes from the SystemVerilog and UVM lessons, stored only in this browser.',
};

/**
 * A static shell: the entries live in this browser, so the client island reads
 * them after hydration. No account or feature switch is needed.
 */
export default function NotebookPage() {
  return (
    <PageShell width="content">
      <LearnerPageHeader
        current="notebook"
        title={siteLabel(NOTEBOOK_HREF)}
        lead="Your Teach it back explanations and your own notes, in one place. Search them, edit them, and download them as Markdown."
      />
      <NotebookPageClient />
    </PageShell>
  );
}
