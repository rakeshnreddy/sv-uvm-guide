import type { Metadata } from 'next';

import InterfaceSignalFlow from '@/components/animations/InterfaceSignalFlow';
import LearnInLesson from '@/components/practice/LearnInLesson';
import { InfoPage } from '@/components/templates/InfoPage';
import { requirePracticePage } from '@/lib/practice-links';

const HREF = '/practice/visualizations/interface-signal-flow';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = { title: practice.title, description: practice.description };

const InterfaceSignalFlowPage = () => {
  return (
    <InfoPage title={practice.title} description={practice.description} diagrams={[<InterfaceSignalFlow key="if-flow" />]}>
      <LearnInLesson item={practice} />
    </InfoPage>
  );
};

export default InterfaceSignalFlowPage;
