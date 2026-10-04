import { InfoPage } from '@/components/templates/InfoPage';
import { CovergroupBuilder } from '@/components/visuals/CovergroupBuilder';
import { CoverageCrossExplorerVisualizer } from '@/components/visualizers/CoverageCrossExplorerVisualizer';

const CoverageAnalyzerPage = () => {
  return (
    <InfoPage
      title="Coverage Cross Explorer"
      diagrams={[<CoverageCrossExplorerVisualizer key="coverage-cross" />, <CovergroupBuilder key="covergroup-bins" />]}
    />
  );
};

export default CoverageAnalyzerPage;
