import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DynamicStructureVisualizer from '@/components/curriculum/f2/DynamicStructureVisualizer';

describe('DynamicStructureVisualizer', () => {
  it('animates dynamic array operations and updates stats', () => {
    render(<DynamicStructureVisualizer />);

    const infoPanel = screen.getByTestId('dynamic-array-info');
    expect(infoPanel.textContent).toContain('size()3');

    fireEvent.change(screen.getByTestId('dynamic-array-input'), { target: { value: '80' } });
    fireEvent.click(screen.getByTestId('dynamic-array-push'));
    expect(infoPanel.textContent).toContain('size()4');

    fireEvent.change(screen.getByTestId('dynamic-array-resize-input'), { target: { value: '6' } });
    fireEvent.click(screen.getByTestId('dynamic-array-resize'));
    expect(infoPanel.textContent).toContain('capacity6');
    expect(infoPanel.textContent).toContain('sum()128');

    fireEvent.click(screen.getByTestId('dynamic-array-delete'));
    expect(infoPanel.textContent).toContain('size()0');
  });

  it('handles queue limits, packed mapping, and associative array updates', () => {
    render(<DynamicStructureVisualizer />);

    fireEvent.click(screen.getByTestId('tab-queue'));
    fireEvent.click(screen.getByTestId('queue-bounded-switch'));
    fireEvent.change(screen.getByTestId('queue-bound-input'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('queue-push'));
    expect(screen.getByTestId('queue-warning').textContent).toMatch(/queue full/i);

    fireEvent.click(screen.getByTestId('queue-pop'));
    fireEvent.click(screen.getByTestId('queue-bounded-switch'));
    fireEvent.change(screen.getByTestId('queue-input'), { target: { value: '250' } });
    fireEvent.click(screen.getByTestId('queue-push-front'));
    fireEvent.change(screen.getByTestId('queue-index'), { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('queue-insert'));
    expect(screen.getByTestId('queue-info').textContent).toMatch(/insert\(1\)/i);
    fireEvent.click(screen.getByTestId('queue-delete'));
    expect(screen.getByTestId('queue-info').textContent).toMatch(/delete\(1\)/i);

    fireEvent.click(screen.getByTestId('tab-associative'));
    fireEvent.change(screen.getByTestId('associative-key'), { target: { value: 'packet_2000' } });
    fireEvent.change(screen.getByTestId('associative-value'), { target: { value: 'DONE' } });
    fireEvent.click(screen.getByTestId('associative-add'));
    expect(screen.getByTestId('associative-count').textContent).toContain('3');

    fireEvent.click(screen.getByTestId('associative-delete'));
    expect(screen.getByTestId('associative-count').textContent).toContain('2');

    fireEvent.click(screen.getByTestId('tab-packed'));
    expect(screen.getByTestId('packed-scenario-title').textContent).toMatch(/burst payload/i);
    expect(screen.getByTestId('packed-advance')).toBeDisabled();
    fireEvent.click(screen.getByTestId('packed-option-packed-bit-position'));
    expect(screen.getByTestId('packed-feedback').textContent).toMatch(/correct/i);
    expect(screen.getByTestId('packed-advance')).not.toBeDisabled();
  });
});
