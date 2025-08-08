import SystemVerilogDataTypesAnimation from '@/components/animations/SystemVerilogDataTypesAnimation';
import { InfoPage } from '@/components/templates/InfoPage';

const SystemVerilogDataTypesPage = () => {
  return (
    <InfoPage title="SystemVerilog Data Types Visualization" diagrams={[<SystemVerilogDataTypesAnimation key="sv-data" />]} />
  );
};

export default SystemVerilogDataTypesPage;
