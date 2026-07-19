import dynamic from 'next/dynamic';
import { InfoPage } from '@/components/templates/InfoPage';

const InteractiveUvmArchitectureDiagram = dynamic(
  () => import('@/components/diagrams/InteractiveUvmArchitectureDiagram'),
  {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

const UvmArchitecturePage = () => {
  return (
    <InfoPage title="Interactive UVM Architecture" diagrams={[<InteractiveUvmArchitectureDiagram key="uvm-arch" />]} />
  );
};

export default UvmArchitecturePage;
