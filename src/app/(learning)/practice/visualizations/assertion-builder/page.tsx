import { InfoPage } from '@/components/templates/InfoPage';
import { SvaSequenceWaveformVisualizer } from '@/components/visualizers/SvaSequenceWaveformVisualizer';

const AssertionBuilderPage = () => {
  return (
    <InfoPage
      title="SVA Trace Lab"
      description="Predict what every attempt of a concurrent assertion reports, then check it against a tested model of IEEE 1800-2023 clause 16."
    >
      <SvaSequenceWaveformVisualizer />
    </InfoPage>
  );
};

export default AssertionBuilderPage;
