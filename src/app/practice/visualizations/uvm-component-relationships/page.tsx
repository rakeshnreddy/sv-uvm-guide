import UvmComponentRelationshipVisualizer from '@/components/diagrams/UvmComponentRelationshipVisualizer';
import { InfoPage } from '@/components/templates/InfoPage';

const UvmComponentRelationshipVisualizerPage = () => {
  return (
    <InfoPage title="UVM Component Relationships">
      <UvmComponentRelationshipVisualizer />
    </InfoPage>
  );
};

export default UvmComponentRelationshipVisualizerPage;
