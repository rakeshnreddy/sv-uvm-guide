import type { Metadata } from 'next';

import LearnInLesson from '@/components/practice/LearnInLesson';
import { InfoPage } from '@/components/templates/InfoPage';
import { CovergroupBuilder } from '@/components/visuals/CovergroupBuilder';
import { CoverageCrossExplorerVisualizer } from '@/components/visualizers/CoverageCrossExplorerVisualizer';
import { requirePracticePage } from '@/lib/practice-links';

const HREF = '/practice/visualizations/coverage-analyzer';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = { title: practice.title, description: practice.description };

const CoverageAnalyzerPage = () => {
  return (
    <InfoPage
      title={practice.title}
      description={practice.description}
      diagrams={[<CoverageCrossExplorerVisualizer key="coverage-cross" />, <CovergroupBuilder key="covergroup-bins" />]}
    >
      <LearnInLesson item={practice} />
    </InfoPage>
  );
};

export default CoverageAnalyzerPage;
