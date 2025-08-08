import RandomizationExplorer from '@/components/animations/RandomizationExplorer';
import { InfoPage } from '@/components/templates/InfoPage';

const RandomizationExplorerPage = () => {
  return (
    <InfoPage title="Randomization Explorer" diagrams={[<RandomizationExplorer key="rand-explorer" />]} />
  );
};

export default RandomizationExplorerPage;
