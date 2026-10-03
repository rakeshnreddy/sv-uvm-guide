import ForkJoinVisualizer from '@/components/visuals/ForkJoinVisualizer';
import { InfoPage } from '@/components/templates/InfoPage';

// Process-model visual: fork-join variants, disable fork, wait fork, fork-in-loop capture and event races.
// ConcurrencyVisualizer is no longer routed: it modelled process priorities, which SystemVerilog does not have.
const ConcurrencyVisualizerPage = () => {
  return (
    <InfoPage
      title="Concurrency: fork, join and process control"
      description="Predict when each process starts, waits and ends, then step through simulation time."
      diagrams={[<ForkJoinVisualizer key="fork-join" />]}
    />
  );
};

export default ConcurrencyVisualizerPage;
