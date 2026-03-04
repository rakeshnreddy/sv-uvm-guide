import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WebGLFallbackBoundary } from '@/components/ui/WebGLFallbackBoundary';

const RenderFailure = () => {
  throw new Error('render failure');
};

describe('WebGLFallbackBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error is thrown', () => {
    render(
      <WebGLFallbackBoundary>
        <div data-testid="ok">Ready</div>
      </WebGLFallbackBoundary>,
    );

    expect(screen.getByTestId('ok')).toHaveTextContent('Ready');
    expect(screen.queryByTestId('webgl-fallback')).not.toBeInTheDocument();
  });

  it('shows default fallback when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <WebGLFallbackBoundary>
        <RenderFailure />
      </WebGLFallbackBoundary>,
    );

    expect(screen.getByTestId('webgl-fallback')).toBeInTheDocument();
    expect(screen.getByText(/3D Visualization unavailable/i)).toBeVisible();
  });

  it('shows custom fallback when provided', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <WebGLFallbackBoundary fallback={<div data-testid="custom-fallback">Canvas offline</div>}>
        <RenderFailure />
      </WebGLFallbackBoundary>,
    );

    expect(screen.getByTestId('custom-fallback')).toHaveTextContent('Canvas offline');
  });
});
