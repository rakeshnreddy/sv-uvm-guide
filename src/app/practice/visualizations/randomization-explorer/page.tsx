import dynamic from 'next/dynamic';
import { InfoPage } from '@/components/templates/InfoPage';

const RandomizationExplorer = dynamic(
  () => import('@/components/animations/RandomizationExplorer'),
  {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

const RandomizationExplorerPage = () => {
  return (
    <InfoPage title="Randomization Explorer" diagrams={[<RandomizationExplorer key="rand-explorer" />]} />
  );
};

export default RandomizationExplorerPage;
