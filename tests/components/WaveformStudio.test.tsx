import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

const { renderMock } = vi.hoisted(() => ({
  renderMock: vi.fn(({ outputElement }: { outputElement: HTMLElement }) => {
    outputElement.innerHTML = '<svg data-testid="mock-wave-svg"></svg>';
  }),
}));

vi.mock('@/lib/wavedrom', async () => {
  const actual = await vi.importActual<typeof import('@/lib/wavedrom')>('@/lib/wavedrom');
  return { ...actual, createWaveDromIndex: vi.fn(() => 3), renderWaveDromToElement: renderMock };
});

import WaveformStudio from '@/components/practice/WaveformStudio';

const source = () => screen.getByLabelText('WaveJSON source') as HTMLTextAreaElement;
const check = () => screen.getByRole('region', { name: 'Protocol check' });

describe('WaveformStudio', () => {
  beforeEach(() => {
    renderMock.mockClear();
  });

  it('renders the first model sample and reports a clean AXI handshake', () => {
    render(<WaveformStudio />);
    expect(renderMock).toHaveBeenCalled();
    expect(screen.getByTestId('studio-waveform').querySelector('svg')).not.toBeNull();
    expect(within(check()).getByText(/No handshake or dependency violations/)).toBeInTheDocument();
    expect(within(check()).getByText('AW')).toBeInTheDocument();
  });

  it('flags the debug sample with the spec clause, and clears after the learner fixes VALID and the address', () => {
    render(<WaveformStudio />);
    fireEvent.change(screen.getByLabelText('Sample'), { target: { value: 'axi-bug-dropped-valid' } });
    expect(within(check()).getByText(/AW channel, edge 3/)).toBeInTheDocument();
    expect(within(check()).getAllByText(/A3\.2\.1/).length).toBeGreaterThan(0);

    const fixed = source().value.replace('"01.01.0"', '"01...10"').replace('"x=.x=.x"', '"x=....x"');
    fireEvent.change(source(), { target: { value: fixed } });
    expect(within(check()).getByText(/No handshake or dependency violations/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset sample' }));
    expect(within(check()).getByText(/AW channel, edge 3/)).toBeInTheDocument();
  });

  it('accepts relaxed WaveJSON and shows a parse error as an alert instead of crashing', () => {
    render(<WaveformStudio />);
    fireEvent.change(source(), { target: { value: "{ signal: [ { name: 'clk', wave: 'p...' }, ] }" } });
    expect(screen.getByText(/Relaxed WaveJSON accepted/)).toBeInTheDocument();
    expect(within(check()).getByText(/No AXI VALID\/READY pairs found/)).toBeInTheDocument();

    fireEvent.change(source(), { target: { value: '{ signal: [ oops ] }' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/Unexpected word "oops"/);
  });

  it('AHB samples render without running the AXI checker', () => {
    render(<WaveformStudio />);
    fireEvent.change(screen.getByLabelText('Sample'), { target: { value: 'ahb-error' } });
    expect(screen.getByText(/ERROR takes two cycles/)).toBeInTheDocument();
    expect(within(check()).getByText(/No AXI VALID\/READY pairs found/)).toBeInTheDocument();
  });
});
