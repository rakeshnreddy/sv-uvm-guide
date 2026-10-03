import AnimatedUvmTestbenchDiagram from '@/components/diagrams/AnimatedUvmTestbenchDiagram';
import { InfoPage } from '@/components/templates/InfoPage';

const UvmComponentRelationshipVisualizerPage = () => {
  return (
    <InfoPage
      title="UVM Component Relationships"
      description="Predict what an agent builds in active and passive mode, then inject the two classic agent bugs and watch the build log."
      diagrams={[<AnimatedUvmTestbenchDiagram key="uvm-agent-topology" />]}
    />
  );
};

export default UvmComponentRelationshipVisualizerPage;
