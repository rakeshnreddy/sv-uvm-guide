import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DataTypeExplorer from '@/components/animations/DataTypeExplorer';

describe('DataTypeExplorer', () => {
  it('manipulates the dynamic array and logs operations', () => {
    render(<DataTypeExplorer />);

    const explorer = screen.getByTestId('data-type-explorer');
    const pushBack = within(explorer).getAllByRole('button', { name: /push_back/i })[0];
    fireEvent.click(pushBack);

    const consoleLog = screen.getByTestId('dynamic-array-console-log');
    expect(consoleLog.textContent).toContain('arr.push_back');

    const sizeButton = within(explorer).getAllByRole('button', { name: /size\(\)/i })[0];
    fireEvent.click(sizeButton);
    expect(consoleLog.textContent).toContain('arr.size()');
  });

  it('switches tabs and interacts with queue and associative array methods', () => {
    render(<DataTypeExplorer />);

    const queueTab = screen.getByRole('button', { name: /queue/i });
    fireEvent.click(queueTab);

    const popFront = screen.getByRole('button', { name: /pop_front/i });
    fireEvent.click(popFront);
    const queueLog = screen.getByTestId('queue-console-log');
    expect(queueLog.textContent).toMatch(/q\.pop_front/);

    const assocTab = screen.getByRole('button', { name: /associative array/i });
    fireEvent.click(assocTab);

    const existsButton = screen.getByRole('button', { name: /exists/i });
    fireEvent.click(existsButton);
    const assocLog = screen.getByTestId('associative-array-console-log');
    expect(assocLog.textContent).toMatch(/aa\.exists/);
  });
});
