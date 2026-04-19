import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { renderWaveDromToElementMock } = vi.hoisted(() => ({
  renderWaveDromToElementMock: vi.fn(
    ({ outputElement }: { outputElement: HTMLElement }) => {
      outputElement.innerHTML = '<svg data-testid="mock-wave-svg"></svg>';
    },
  ),
}));

vi.mock('@/lib/wavedrom', async () => {
  const actual = await vi.importActual<typeof import('@/lib/wavedrom')>('@/lib/wavedrom');
  return {
    ...actual,
    createWaveDromIndex: vi.fn(() => 7),
    renderWaveDromToElement: renderWaveDromToElementMock,
  };
});

import { ProtocolWaveform } from '@/components/mdx/ProtocolWaveform';

describe('ProtocolWaveform', () => {
  beforeEach(() => {
    renderWaveDromToElementMock.mockClear();
  });

  it('renders a waveform from a structured object spec', async () => {
    const spec = {
      signal: [
        { name: 'HCLK', wave: 'p.......' },
        { name: 'HTRANS', wave: 'x.3..x..', data: ['NONSEQ'] },
        { name: 'HREADY', wave: '1..0.1..' },
      ],
    };

    render(
      <ProtocolWaveform
        spec={spec}
        title="AHB single write"
        caption="Address phase overlaps the preceding data phase."
        notes="HREADY low stretches both phases."
      />,
    );

    await waitFor(() => expect(renderWaveDromToElementMock).toHaveBeenCalledTimes(1));

    expect(renderWaveDromToElementMock).toHaveBeenCalledWith(
      expect.objectContaining({
        index: expect.any(Number),
        source: spec,
        outputElement: expect.any(HTMLElement),
      }),
    );
    expect(screen.getByRole('img', { name: 'AHB single write' })).toBeInTheDocument();
    expect(screen.getByText('AHB single write')).toBeInTheDocument();
    expect(screen.getByText('Address phase overlaps the preceding data phase.')).toBeInTheDocument();
    expect(screen.getByText('HREADY low stretches both phases.')).toBeInTheDocument();
  });

  it('shows a stable fallback when the waveform input is invalid', async () => {
    render(
      <ProtocolWaveform
        spec="{ signal: ["
        ariaLabel="Broken protocol timing diagram"
      />,
    );

    await waitFor(() => expect(screen.getByTestId('protocol-waveform-error')).toBeInTheDocument());

    expect(renderWaveDromToElementMock).not.toHaveBeenCalled();
    expect(screen.getByText('Unable to render timing diagram.')).toBeInTheDocument();
    expect(screen.getByText('Waveform spec must be valid JSON.')).toBeInTheDocument();
  });

  it('uses title, caption, legend, and explicit aria text correctly', async () => {
    render(
      <ProtocolWaveform
        spec={`{
          "signal": [
            { "name": "AWVALID", "wave": "01.." },
            { "name": "AWREADY", "wave": "0.10" }
          ]
        }`}
        title="AXI write address handshake"
        caption="VALID must remain asserted until READY completes the transfer."
        ariaLabel="AXI write address handshake timing diagram"
        legend="READY low applies backpressure from the slave."
      />,
    );

    await waitFor(() => expect(renderWaveDromToElementMock).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('img', { name: 'AXI write address handshake timing diagram' })).toBeInTheDocument();
    expect(screen.getByText('AXI write address handshake')).toBeInTheDocument();
    expect(screen.getByText('VALID must remain asserted until READY completes the transfer.')).toBeInTheDocument();
    expect(screen.getByText('Legend')).toBeInTheDocument();
    expect(screen.getByText('READY low applies backpressure from the slave.')).toBeInTheDocument();
  });
});
