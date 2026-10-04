import type { Metadata } from 'next';

import AnimatedUvmTestbenchDiagram from '@/components/diagrams/AnimatedUvmTestbenchDiagram';
import LearnInLesson from '@/components/practice/LearnInLesson';
import { InfoPage } from '@/components/templates/InfoPage';
import { requirePracticePage } from '@/lib/practice-links';

const HREF = '/practice/visualizations/uvm-component-relationships';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = { title: practice.title, description: practice.description };

const UvmComponentRelationshipVisualizerPage = () => {
  return (
    <InfoPage
      title={practice.title}
      description={practice.description}
      diagrams={[<AnimatedUvmTestbenchDiagram key="uvm-agent-topology" />]}
    >
      <LearnInLesson item={practice} />
    </InfoPage>
  );
};

export default UvmComponentRelationshipVisualizerPage;
