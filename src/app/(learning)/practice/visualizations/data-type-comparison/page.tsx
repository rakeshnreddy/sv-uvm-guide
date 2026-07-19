import dynamic from 'next/dynamic';
import { InfoPage } from '@/components/templates/InfoPage';

const DataTypeComparisonChart = dynamic(
  () => import('@/components/charts/DataTypeComparisonChart'),
  {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

const DataTypeComparisonChartPage = () => {
  return (
    <InfoPage title="Data Type Comparison Chart" charts={[<DataTypeComparisonChart key="dt-chart" />]} />
  );
};

export default DataTypeComparisonChartPage;
