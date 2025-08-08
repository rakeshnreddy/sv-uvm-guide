import UvmComponentRelationshipVisualizer from '@/components/diagrams/UvmComponentRelationshipVisualizer';
import { InfoPage } from '@/components/templates/InfoPage';

const UvmComponentRelationshipVisualizerPage = () => {
  return (
    <InfoPage title="UVM Component Relationships" diagrams={[<UvmComponentRelationshipVisualizer key="uvm-comp-rel" />]} />
  );
};

export default UvmComponentRelationshipVisualizerPage;
