import type { Metadata } from 'next';
import WaveformStudio from '@/components/practice/WaveformStudio';
import { InfoPage } from '@/components/templates/InfoPage';

export const metadata: Metadata = {
  title: 'Waveform Studio | SystemVerilog & UVM Mastery',
  description:
    'Edit WaveJSON timing diagrams for AXI and AHB, redraw them live, and check AXI handshakes against the VALID/READY and channel-dependency rules.',
};

// Samples come from the AXI and AHB lesson models (src/lib/waveform-studio.ts).
export default function WaveformStudioPage() {
  return (
    <InfoPage
      title="Waveform Studio"
      description="Read, edit and debug protocol timing diagrams. The checker uses the same AXI model as the B-AXI-1 lesson figures."
      diagrams={[<WaveformStudio key="waveform-studio" />]}
    />
  );
}
