import CoverageAnalyzer from '@/components/animations/CoverageAnalyzer';
import { InfoPage } from '@/components/templates/InfoPage';

const CoverageAnalyzerPage = () => {
  return (
    <InfoPage title="Coverage Analyzer" diagrams={[<CoverageAnalyzer key="coverage" />]} />
  );
};

export default CoverageAnalyzerPage;
