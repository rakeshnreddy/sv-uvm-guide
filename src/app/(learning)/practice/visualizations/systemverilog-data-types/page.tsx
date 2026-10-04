import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

import LearnInLesson from '@/components/practice/LearnInLesson';
import { InfoPage } from '@/components/templates/InfoPage';
import { requirePracticePage } from '@/lib/practice-links';

const SystemVerilogDataTypesAnimation = dynamic(
  () => import('@/components/animations/SystemVerilogDataTypesAnimation'),
  {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

const HREF = '/practice/visualizations/systemverilog-data-types';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = { title: practice.title, description: practice.description };

const SystemVerilogDataTypesPage = () => {
  return (
    <InfoPage
      title={practice.title}
      description={practice.description}
      diagrams={[<SystemVerilogDataTypesAnimation key="sv-data" />]}
    >
      <LearnInLesson item={practice} />
    </InfoPage>
  );
};

export default SystemVerilogDataTypesPage;
