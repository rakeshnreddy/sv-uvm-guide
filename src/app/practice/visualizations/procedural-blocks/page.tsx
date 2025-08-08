import ProceduralBlocksSimulator from '@/components/animations/ProceduralBlocksSimulator';
import { InfoPage } from '@/components/templates/InfoPage';

const ProceduralBlocksPage = () => {
  return (
    <InfoPage title="Procedural Blocks Simulator" diagrams={[<ProceduralBlocksSimulator key="proc-blocks" />]} />
  );
};

export default ProceduralBlocksPage;
