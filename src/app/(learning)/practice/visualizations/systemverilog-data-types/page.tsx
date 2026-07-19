import dynamic from 'next/dynamic';
import { InfoPage } from '@/components/templates/InfoPage';

const SystemVerilogDataTypesAnimation = dynamic(
  () => import('@/components/animations/SystemVerilogDataTypesAnimation'),
  {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

const SystemVerilogDataTypesPage = () => {
  return (
    <InfoPage title="SystemVerilog Data Types Visualization" diagrams={[<SystemVerilogDataTypesAnimation key="sv-data" />]} />
  );
};

export default SystemVerilogDataTypesPage;
