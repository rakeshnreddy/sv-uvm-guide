import UvmPhasingDiagram from '@/components/diagrams/UvmPhasingDiagram';
import { InfoPage } from '@/components/templates/InfoPage';

const UvmPhasingDiagramPage = () => {
  return (
    <InfoPage title="UVM Phasing Diagram" diagrams={[<UvmPhasingDiagram key="uvm-phasing" />]} />
  );
};

export default UvmPhasingDiagramPage;
