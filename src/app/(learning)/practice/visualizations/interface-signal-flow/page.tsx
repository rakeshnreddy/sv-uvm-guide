import InterfaceSignalFlow from '@/components/animations/InterfaceSignalFlow';
import { InfoPage } from '@/components/templates/InfoPage';

const InterfaceSignalFlowPage = () => {
  return (
    <InfoPage title="Interface Signal Flow" diagrams={[<InterfaceSignalFlow key="if-flow" />]} />
  );
};

export default InterfaceSignalFlowPage;
