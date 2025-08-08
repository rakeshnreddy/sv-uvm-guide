import DataTypeComparisonChart from '@/components/charts/DataTypeComparisonChart';
import { InfoPage } from '@/components/templates/InfoPage';

const DataTypeComparisonChartPage = () => {
  return (
    <InfoPage title="Data Type Comparison Chart" charts={[<DataTypeComparisonChart key="dt-chart" />]} />
  );
};

export default DataTypeComparisonChartPage;
