import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRouter, useSearchParams } from 'next/navigation';

import SystemVerilog3DVisualizer from '@/components/curriculum/f2/SystemVerilog3DVisualizer';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

const mockReplace = vi.fn();
const mockPush = vi.fn();
const mockSearchParams = {
  get: vi.fn(),
  toString: vi.fn(() => ''),
};

describe('SystemVerilog3DVisualizer (iframe wrapper)', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearchParams.get.mockReset();
    mockSearchParams.get.mockReturnValue(null);
    mockSearchParams.toString.mockReturnValue('');

    vi.mocked(useRouter).mockReturnValue({
      replace: mockReplace,
      push: mockPush,
    } as unknown as ReturnType<typeof useRouter>);

    vi.mocked(useSearchParams).mockReturnValue(
      mockSearchParams as unknown as ReturnType<typeof useSearchParams>,
    );
  });

  it('renders the iframe with default configuration', () => {
    render(<SystemVerilog3DVisualizer />);

    const iframe = screen.getByTitle('SystemVerilog 3D Explorer') as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.src).toContain('/visualizations/systemverilog-3d.html');
    expect(iframe.src).not.toContain('scene=');
  });

  it('honours an initialScene prop and writes it into the URL', () => {
    render(<SystemVerilog3DVisualizer initialScene="queue" />);

    const iframe = screen.getByTitle('SystemVerilog 3D Explorer') as HTMLIFrameElement;
    expect(iframe.src).toContain('scene=queue');
    expect(mockPush).toHaveBeenCalledWith('/?scene=queue', { scroll: false });
  });

  it('responds to scene changes posted from the iframe', async () => {
    render(<SystemVerilog3DVisualizer />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'sv3d:mode-change', scene: 'associative' },
        }),
      );
    });

    await vi.waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/?scene=associative', { scroll: false }),
    );
  });
});
