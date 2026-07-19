import ConcurrencyVisualizer from '@/components/animations/ConcurrencyVisualizer';
import { InfoPage } from '@/components/templates/InfoPage';

const ConcurrencyVisualizerPage = () => {
  return (
    <InfoPage title="Concurrency Visualizer" diagrams={[<ConcurrencyVisualizer key="concurrency" />]} />
  );
};

export default ConcurrencyVisualizerPage;
