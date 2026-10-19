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
      <header className="rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Notebook</h1>
        <p className="mt-3 max-w-3xl text-base text-muted-foreground sm:text-lg">
          Your Teach it back explanations and your own notes, in one place. Search them, edit them, and download them
          as Markdown.
        </p>
        <LearnerSectionNav current="notebook" className="mt-5" />
      </header>
      <NotebookPageClient />
    </div>
  );
}
