import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

import LearnInLesson from '@/components/practice/LearnInLesson';
import { InfoPage } from '@/components/templates/InfoPage';
import { requirePracticePage } from '@/lib/practice-links';

const DataTypeComparisonChart = dynamic(
  () => import('@/components/charts/DataTypeComparisonChart'),
  {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

const HREF = '/practice/visualizations/data-type-comparison';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = { title: practice.title, description: practice.description };

const DataTypeComparisonChartPage = () => {
  return (
    <InfoPage
      title={practice.title}
      description={practice.description}
      charts={[<DataTypeComparisonChart key="dt-chart" />]}
    >
      <LearnInLesson item={practice} />
    </InfoPage>
  );
};

export default DataTypeComparisonChartPage;
