import StateMachineDesigner from '@/components/animations/StateMachineDesigner';
import { InfoPage } from '@/components/templates/InfoPage';

const StateMachineDesignerPage = () => {
  return (
    <InfoPage title="State Machine Designer" diagrams={[<StateMachineDesigner key="state-machine" />]} />
  );
};

export default StateMachineDesignerPage;
