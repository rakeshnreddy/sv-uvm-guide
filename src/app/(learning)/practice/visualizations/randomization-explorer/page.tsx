import dynamic from 'next/dynamic';
import { InfoPage } from '@/components/templates/InfoPage';

// The exact-enumeration lab replaces the old rejection-sampling RandomizationExplorer,
// which reported satisfiable constraints as solver failures.
const ConstraintSolverHeatmapVisualizer = dynamic(
  () => import('@/components/visualizers/ConstraintSolverHeatmapVisualizer').then((m) => m.ConstraintSolverHeatmapVisualizer),
  {
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

const RandomizationExplorerPage = () => {
  return (
    <InfoPage title="Randomization Explorer" diagrams={[<ConstraintSolverHeatmapVisualizer key="rand-explorer" />]} />
  );
};

export default RandomizationExplorerPage;
