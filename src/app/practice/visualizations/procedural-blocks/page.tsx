import dynamic from 'next/dynamic';
import { InfoPage } from '@/components/templates/InfoPage';

// Procedural blocks simulator accesses browser APIs; load it only on the client.
const ProceduralBlocksSimulator = dynamic(
  () => import('@/components/animations/ProceduralBlocksSimulator'),
  { ssr: false }
);

const ProceduralBlocksPage = () => {
  return (
    <InfoPage title="Procedural Blocks Simulator" diagrams={[<ProceduralBlocksSimulator key="proc-blocks" />]} />
  );
};

export default ProceduralBlocksPage;
