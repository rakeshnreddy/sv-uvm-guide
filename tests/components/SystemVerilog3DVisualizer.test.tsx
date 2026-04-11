import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock @react-three/fiber — replace Canvas with a simple div
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({ camera: {}, gl: {} })),
}));

// Mock @react-three/drei helpers
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Text: () => null,
  Grid: () => null,
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock THREE so material/geometry constructors don't fail in JSDOM
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    ...actual,
    MeshStandardMaterial: vi.fn().mockImplementation(() => ({})),
  };
});

import SystemVerilog3DVisualizer from '@/components/curriculum/f2/SystemVerilog3DVisualizer';

describe('SystemVerilog3DVisualizer (React Three Fiber)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the wrapper with the data-testid', () => {
    render(<SystemVerilog3DVisualizer />);
    expect(screen.getByTestId('sv-3d-visualizer')).toBeInTheDocument();
  });

  it('renders the R3F canvas', () => {
    render(<SystemVerilog3DVisualizer />);
    expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
  });

  it('opens in dynamic array mode by default', () => {
    render(<SystemVerilog3DVisualizer />);
    // dynamic array mode shows new/delete buttons
    expect(screen.getByText('new [size]')).toBeInTheDocument();
    expect(screen.getByText('delete()')).toBeInTheDocument();
  });

  it('shows the heading', () => {
    render(<SystemVerilog3DVisualizer />);
    expect(screen.getByText('SV Data Structures')).toBeInTheDocument();
  });

  it('opens in queue mode when initialScene="queue"', () => {
    render(<SystemVerilog3DVisualizer initialScene="queue" />);
    expect(screen.getByText('push_back(val)')).toBeInTheDocument();
    expect(screen.getByText('pop_front()')).toBeInTheDocument();
    expect(screen.getByText('pop_back()')).toBeInTheDocument();
  });

  it('opens in fixed mode when initialScene="packed-matrix"', () => {
    render(<SystemVerilog3DVisualizer initialScene="packed-matrix" />);
    expect(screen.getByText('Update View')).toBeInTheDocument();
    expect(screen.getByText('Highlight Bit by Index')).toBeInTheDocument();
    expect(screen.getByText('Find Bit')).toBeInTheDocument();
  });

  it('opens in associative mode when initialScene="associative"', () => {
    render(<SystemVerilog3DVisualizer initialScene="associative" />);
    expect(screen.getByText('exists(key)')).toBeInTheDocument();
    expect(screen.getByText('delete(key)')).toBeInTheDocument();
    // The initial demo seeds 3 entries
    expect(screen.getByText('aa.num() = 3')).toBeInTheDocument();
  });

  it('correctly performs dynamic array new[] operation', () => {
    render(<SystemVerilog3DVisualizer />);
    const newBtn = screen.getByText('new [size]');
    fireEvent.click(newBtn);
    // Default size is 8
    expect(screen.getByText('dyn.size() = 8')).toBeInTheDocument();
    expect(screen.getByText(/dyn_array = new\[8\]/)).toBeInTheDocument();
  });

  it('correctly performs dynamic array delete operation', () => {
    render(<SystemVerilog3DVisualizer />);
    // First create an array
    fireEvent.click(screen.getByText('new [size]'));
    expect(screen.getByText('dyn.size() = 8')).toBeInTheDocument();
    // Then delete
    fireEvent.click(screen.getByText('delete()'));
    expect(screen.getByText('dyn.size() = 0')).toBeInTheDocument();
    expect(screen.getByText(/dyn_array\.delete/)).toBeInTheDocument();
  });

  it('applies className and height props', () => {
    render(
      <SystemVerilog3DVisualizer className="test-class" height="500px" />,
    );
    const container = screen.getByTestId('sv-3d-visualizer');
    expect(container.className).toContain('test-class');
    expect(container.style.height).toBe('500px');
  });
});
