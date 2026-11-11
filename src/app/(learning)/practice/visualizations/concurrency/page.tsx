import type { Metadata } from 'next';

import LearnInLesson from '@/components/practice/LearnInLesson';
import ForkJoinVisualizer from '@/components/visuals/ForkJoinVisualizer';
import { PracticeInfoPage } from '@/components/practice/PracticeInfoPage';
import { requirePracticePage } from '@/lib/practice-links';

const HREF = '/practice/visualizations/concurrency';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = { title: practice.title, description: practice.description };

// Process-model visual: fork-join variants, disable fork, wait fork, fork-in-loop capture and event races.
// ConcurrencyVisualizer is no longer routed: it modelled process priorities, which SystemVerilog does not have.
const ConcurrencyVisualizerPage = () => {
  return (
    <PracticeInfoPage href={HREF}
      title={practice.title}
      description="Predict when each process starts, waits and ends, then step through simulation time."
      diagrams={[<ForkJoinVisualizer key="fork-join" />]}
    >
      <LearnInLesson item={practice} />
    </PracticeInfoPage>
  );
};

export default ConcurrencyVisualizerPage;
