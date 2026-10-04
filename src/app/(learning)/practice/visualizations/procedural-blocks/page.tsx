import type { Metadata } from 'next';

import ProceduralBlocksSimulator from '@/components/animations/ProceduralBlocksSimulator';
import LearnInLesson from '@/components/practice/LearnInLesson';
import { InfoPage } from '@/components/templates/InfoPage';
import { requirePracticePage } from '@/lib/practice-links';

const HREF = '/practice/visualizations/procedural-blocks';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = { title: practice.title, description: practice.description };

// Runs on the deterministic process model (src/lib/sv-process-model.ts); no browser-only APIs are needed at render time.
const ProceduralBlocksPage = () => {
  return (
    <InfoPage
      title={practice.title}
      description="initial, always and final procedures over simulation time, with the region each update lands in."
      diagrams={[<ProceduralBlocksSimulator key="proc-blocks" />]}
    >
      <LearnInLesson item={practice} />
    </InfoPage>
  );
};

export default ProceduralBlocksPage;
