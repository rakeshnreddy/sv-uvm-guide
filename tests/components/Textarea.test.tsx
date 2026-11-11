import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Textarea, textareaClass } from '@/components/ui/Textarea';

describe('Textarea', () => {
  it('uses the field tokens: the control boundary, a solid surface, the control radius and the focus ring; no glass', () => {
    render(<Textarea aria-label="Notes" />);
    const field = screen.getByRole('textbox', { name: 'Notes' });
    expect(field).toHaveClass('border-input', 'bg-background', 'rounded-lg', 'text-foreground', 'focus-visible:ring-ring');
    expect(field.className).not.toMatch(/backdrop-blur|bg-white|border-white/);
  });

  it('takes the card surface inside a card, menu or dialog', () => {
    render(<Textarea aria-label="Comment" surface="card" />);
    expect(screen.getByRole('textbox', { name: 'Comment' })).toHaveClass('bg-card');
    expect(textareaClass('card')).not.toContain('bg-background');
  });

  it("calls the caller's onChange and grows with its text", () => {
    const onChange = vi.fn();
    render(<Textarea aria-label="Notes" onChange={onChange} />);
    const field = screen.getByRole('textbox', { name: 'Notes' }) as HTMLTextAreaElement;
    Object.defineProperty(field, 'scrollHeight', { configurable: true, value: 96 });
    fireEvent.change(field, { target: { value: 'one\ntwo\nthree' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(field.style.height).toBe('96px');
  });

  it("keeps the caller's style and rows, and starts at minRows otherwise", () => {
    render(
      <>
        <Textarea aria-label="A" style={{ maxHeight: 112 }} />
        <Textarea aria-label="B" minRows={1} />
        <Textarea aria-label="C" rows={5} />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'A' })).toHaveStyle({ maxHeight: '112px' });
    expect(screen.getByRole('textbox', { name: 'A' })).toHaveAttribute('rows', '2');
    expect(screen.getByRole('textbox', { name: 'B' })).toHaveAttribute('rows', '1');
    expect(screen.getByRole('textbox', { name: 'C' })).toHaveAttribute('rows', '5');
  });
});
