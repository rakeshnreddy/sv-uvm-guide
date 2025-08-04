import InteractiveUvmArchitectureDiagram from '@/components/diagrams/InteractiveUvmArchitectureDiagram';
import { InfoPage } from '@/components/templates/InfoPage';

const UvmArchitecturePage = () => {
  return (
    <InfoPage title="Interactive UVM Architecture">
      <InteractiveUvmArchitectureDiagram />
    </InfoPage>
  );
};

export default UvmArchitecturePage;
