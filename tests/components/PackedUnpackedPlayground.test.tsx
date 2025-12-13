import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PackedUnpackedPlayground from '@/components/curriculum/f2/PackedUnpackedPlayground';

describe('PackedUnpackedPlayground', () => {
  it('switches scenarios and walks memory steps', () => {
    render(<PackedUnpackedPlayground />);

    expect(screen.getByTestId('packed-unpacked-scenario').textContent).toMatch(/Burst Payload/);
    expect(screen.getByTestId('packed-unpacked-step').textContent).toContain('payload');

    fireEvent.click(screen.getByTestId('packed-unpacked-next'));
    expect(screen.getByTestId('packed-unpacked-step').textContent).not.toEqual('');

    fireEvent.click(screen.getByTestId('packed-unpacked-lane-matrix'));
    expect(screen.getByTestId('packed-unpacked-scenario').textContent).toMatch(/Lane Matrix/);

    fireEvent.click(screen.getByTestId('packed-unpacked-scoreboard'));
    expect(screen.getByTestId('packed-unpacked-scenario').textContent).toMatch(/Scoreboard Grid/);
    expect(screen.getByTestId('packed-unpacked-order').textContent).toContain('scoreboard');
  });
});
