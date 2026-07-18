import dynamic from 'next/dynamic';
import { InfoPage } from '@/components/templates/InfoPage';

const UvmComponentRelationshipVisualizer = dynamic(
  () => import('@/components/diagrams/UvmComponentRelationshipVisualizer'),
  {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

const UvmComponentRelationshipVisualizerPage = () => {
  return (
    <InfoPage title="UVM Component Relationships" diagrams={[<UvmComponentRelationshipVisualizer key="uvm-comp-rel" />]} />
  );
};

export default UvmComponentRelationshipVisualizerPage;
