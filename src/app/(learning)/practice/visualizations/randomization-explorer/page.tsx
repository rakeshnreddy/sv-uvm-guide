import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

import LearnInLesson from '@/components/practice/LearnInLesson';
import { InfoPage } from '@/components/templates/InfoPage';
import { requirePracticePage } from '@/lib/practice-links';

// The exact-enumeration lab replaces the old rejection-sampling RandomizationExplorer,
// which reported satisfiable constraints as solver failures.
const ConstraintSolverHeatmapVisualizer = dynamic(
  () => import('@/components/visualizers/ConstraintSolverHeatmapVisualizer').then((m) => m.ConstraintSolverHeatmapVisualizer),
  {
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

const HREF = '/practice/visualizations/randomization-explorer';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = { title: practice.title, description: practice.description };

const RandomizationExplorerPage = () => {
  return (
    <InfoPage
      title={practice.title}
      description={practice.description}
      diagrams={[<ConstraintSolverHeatmapVisualizer key="rand-explorer" />]}
    >
      <LearnInLesson item={practice} />
    </InfoPage>
  );
};

export default RandomizationExplorerPage;
