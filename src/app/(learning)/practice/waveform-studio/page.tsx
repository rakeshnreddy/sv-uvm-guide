import type { Metadata } from 'next';

import LearnInLesson from '@/components/practice/LearnInLesson';
import WaveformStudio from '@/components/practice/WaveformStudio';
import { PracticeInfoPage } from '@/components/practice/PracticeInfoPage';
import { requirePracticePage } from '@/lib/practice-links';

const HREF = '/practice/waveform-studio';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = {
  title: practice.title,
  description:
    'Edit WaveJSON timing diagrams for AXI and AHB, redraw them live, and check AXI handshakes against the VALID/READY and channel-dependency rules.',
};

// Samples come from the AXI and AHB lesson models (src/lib/waveform-studio.ts).
export default function WaveformStudioPage() {
  return (
    // A dense tool: the wide width (1280 px).
    <PracticeInfoPage
      href={HREF}
      width="wide"
      title={practice.title}
      description="Read, edit and debug protocol timing diagrams. The checker uses the same AXI model as the B-AXI-1 lesson figures."
      diagrams={[<WaveformStudio key="waveform-studio" />]}
    >
      <LearnInLesson item={practice} />
    </PracticeInfoPage>
  );
}
