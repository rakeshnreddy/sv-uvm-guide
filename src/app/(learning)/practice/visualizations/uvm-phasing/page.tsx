import UvmPhasingDiagram from '@/components/diagrams/UvmPhasingDiagram';
import { UvmPhaseTimelineVisualizer } from '@/components/visualizers/UvmPhaseTimelineVisualizer';
import { InfoPage } from '@/components/templates/InfoPage';

const UvmPhasingDiagramPage = () => {
  return (
    <InfoPage
      title="UVM Phasing and Objections"
      diagrams={[<UvmPhaseTimelineVisualizer key="uvm-phase-map" />, <UvmPhasingDiagram key="uvm-phasing" />]}
    />
  );
};

export default UvmPhasingDiagramPage;
