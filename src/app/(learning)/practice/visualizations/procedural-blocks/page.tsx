import ProceduralBlocksSimulator from '@/components/animations/ProceduralBlocksSimulator';
import { InfoPage } from '@/components/templates/InfoPage';

// Runs on the deterministic process model (src/lib/sv-process-model.ts); no browser-only APIs are needed at render time.
const ProceduralBlocksPage = () => {
  return (
    <InfoPage
      title="Procedural Blocks Simulator"
      description="initial, always and final procedures over simulation time, with the region each update lands in."
      diagrams={[<ProceduralBlocksSimulator key="proc-blocks" />]}
    />
  );
};

export default ProceduralBlocksPage;
