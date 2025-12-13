import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import QueueOperationLab from '@/components/curriculum/f2/QueueOperationLab';

describe('QueueOperationLab', () => {
  it('updates queue state with push and pop operations', () => {
    render(<QueueOperationLab />);

    expect(screen.getByTestId('queue-lab-state').textContent).toContain('depth 4');

    fireEvent.change(screen.getByTestId('queue-lab-value'), { target: { value: '77' } });
    fireEvent.click(screen.getByTestId('queue-lab-push-back'));
    expect(screen.getByTestId('queue-lab-state').textContent).toContain('depth 5');
    expect(screen.getByTestId('queue-lab-log').textContent).toMatch(/push_back/);

    fireEvent.click(screen.getByTestId('queue-lab-pop-front'));
    expect(screen.getByTestId('queue-lab-state').textContent).toContain('depth 4');

    fireEvent.change(screen.getByTestId('queue-lab-index'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('queue-lab-value'), { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('queue-lab-insert'));
    expect(screen.getByTestId('queue-lab-log').textContent).toMatch(/insert/);

    fireEvent.click(screen.getByTestId('queue-lab-reset'));
    expect(screen.getByTestId('queue-lab-state').textContent).toContain('depth 4');
    expect(screen.getByTestId('queue-lab-pressure').textContent).toMatch(/Healthy/);
  });
});
