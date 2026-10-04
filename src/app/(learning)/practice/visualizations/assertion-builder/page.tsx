import type { Metadata } from 'next';

import LearnInLesson from '@/components/practice/LearnInLesson';
import { InfoPage } from '@/components/templates/InfoPage';
import { SvaSequenceWaveformVisualizer } from '@/components/visualizers/SvaSequenceWaveformVisualizer';
import { requirePracticePage } from '@/lib/practice-links';

const HREF = '/practice/visualizations/assertion-builder';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = { title: practice.title, description: practice.description };

const AssertionBuilderPage = () => {
  return (
    <InfoPage
      title={practice.title}
      description="Predict what every attempt of a concurrent assertion reports, then check it against a tested model of IEEE 1800-2023 clause 16."
    >
      <LearnInLesson item={practice} />
      <SvaSequenceWaveformVisualizer />
    </InfoPage>
  );
};

export default AssertionBuilderPage;
