import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

import LearnInLesson from '@/components/practice/LearnInLesson';
import { InfoPage } from '@/components/templates/InfoPage';
import { requirePracticePage } from '@/lib/practice-links';

const StateMachineDesigner = dynamic(
  () => import('@/components/animations/StateMachineDesigner'),
  {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

const HREF = '/practice/visualizations/state-machine-designer';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = { title: practice.title, description: practice.description };

const StateMachineDesignerPage = () => {
  return (
    <InfoPage title={practice.title} description={practice.description} diagrams={[<StateMachineDesigner key="state-machine" />]}>
      <LearnInLesson item={practice} />
    </InfoPage>
  );
};

export default StateMachineDesignerPage;
