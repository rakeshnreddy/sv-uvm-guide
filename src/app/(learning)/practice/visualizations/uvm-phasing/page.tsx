import type { Metadata } from 'next';

import LearnInLesson from '@/components/practice/LearnInLesson';
import UvmPhasingDiagram from '@/components/diagrams/UvmPhasingDiagram';
import { UvmPhaseTimelineVisualizer } from '@/components/visualizers/UvmPhaseTimelineVisualizer';
import { InfoPage } from '@/components/templates/InfoPage';
import { requirePracticePage } from '@/lib/practice-links';

const HREF = '/practice/visualizations/uvm-phasing';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = { title: practice.title, description: practice.description };

const UvmPhasingDiagramPage = () => {
  return (
    <InfoPage
      title={practice.title}
      description={practice.description}
      diagrams={[<UvmPhaseTimelineVisualizer key="uvm-phase-map" />, <UvmPhasingDiagram key="uvm-phasing" />]}
    >
      <LearnInLesson item={practice} />
    </InfoPage>
  );
};

export default UvmPhasingDiagramPage;
