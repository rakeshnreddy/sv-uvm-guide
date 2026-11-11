import type { Metadata } from 'next';

import LearnInLesson from '@/components/practice/LearnInLesson';
import UvmPhasingDiagram from '@/components/diagrams/UvmPhasingDiagram';
import { UvmPhaseTimelineVisualizer } from '@/components/visualizers/UvmPhaseTimelineVisualizer';
import { PracticeInfoPage } from '@/components/practice/PracticeInfoPage';
import { requirePracticePage } from '@/lib/practice-links';

const HREF = '/practice/visualizations/uvm-phasing';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = { title: practice.title, description: practice.description };

const UvmPhasingDiagramPage = () => {
  return (
    <PracticeInfoPage href={HREF}
      title={practice.title}
      description={practice.description}
      diagrams={[<UvmPhaseTimelineVisualizer key="uvm-phase-map" />, <UvmPhasingDiagram key="uvm-phasing" />]}
    >
      <LearnInLesson item={practice} />
    </PracticeInfoPage>
  );
};

export default UvmPhasingDiagramPage;
