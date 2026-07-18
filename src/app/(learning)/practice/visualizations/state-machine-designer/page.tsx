import dynamic from 'next/dynamic';
import { InfoPage } from '@/components/templates/InfoPage';

const StateMachineDesigner = dynamic(
  () => import('@/components/animations/StateMachineDesigner'),
  {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

const StateMachineDesignerPage = () => {
  return (
    <InfoPage title="State Machine Designer" diagrams={[<StateMachineDesigner key="state-machine" />]} />
  );
};

export default StateMachineDesignerPage;
