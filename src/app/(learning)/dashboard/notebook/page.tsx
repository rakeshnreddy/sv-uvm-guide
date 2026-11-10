import React from 'react';
import type { Metadata } from 'next';

import { LearnerSectionNav } from '@/components/learner/LearnerSectionNav';

import NotebookPageClient from './NotebookPageClient';

export const metadata: Metadata = {
  title: 'Notebook',
  description:
    'Your Teach it back explanations and notes from the SystemVerilog and UVM lessons, stored only in this browser.',
};

/**
 * A static shell: the entries live in this browser, so the client island reads
 * them after hydration. No account or feature switch is needed.
 */
export default function NotebookPage() {
  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      <header className="space-y-4">
        <div>
          <h1 className="text-h1 text-foreground">Notebook</h1>
          <p className="mt-2 max-w-3xl text-lead text-muted-foreground">
            Your Teach it back explanations and your own notes, in one place. Search them, edit them, and download them
            as Markdown.
          </p>
        </div>
        <LearnerSectionNav current="notebook" />
      </header>
      <NotebookPageClient />
    </div>
  );
}
