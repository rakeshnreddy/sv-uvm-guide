import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ConceptLink from '@/components/knowledge/ConceptLink';
import ConceptModal from '@/components/knowledge/ConceptModal';
import { KnowledgeContextProvider } from '@/contexts/KnowledgeContext';

function renderLesson() {
  return render(
    <KnowledgeContextProvider>
      <p>
        Sample through a <ConceptLink conceptId="term:clocking-block">clocking block</ConceptLink> to avoid races.
      </p>
      <ConceptModal />
    </KnowledgeContextProvider>,
  );
}

describe('ConceptLink + ConceptModal', () => {
  it('renders the inline concept as a keyboard-reachable button', () => {
    renderLesson();
    const trigger = screen.getByRole('button', { name: 'clocking block' });
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('opens a labelled dialog with the real tier, the teaching lesson and the modules to study first', () => {
    renderLesson();
    fireEvent.click(screen.getByRole('button', { name: 'clocking block' }));

    const dialog = screen.getByRole('dialog', { name: 'clocking block' });
    expect(within(dialog).getByText(/Key term · Foundational · first taught in F4C/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /^F4C:/ })).toHaveAttribute(
      'href',
      '/curriculum/T1_Foundational/F4C_Clocking_Blocks/index',
    );
    // F4C's manifest prerequisites.
    expect(within(dialog).getByRole('link', { name: /^F3C:/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /^F4B:/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'race condition' })).toBeInTheDocument();
  });

  it('focuses close, keeps Tab inside, moves to a related term, and closes on Escape with focus returned', () => {
    renderLesson();
    const trigger = screen.getByRole('button', { name: 'clocking block' });
    trigger.focus();
    fireEvent.click(trigger);

    const close = screen.getByRole('button', { name: 'Close concept details' });
    expect(close).toHaveFocus();

    // Shift+Tab from the first control wraps to the last one.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll('a[href], button');
    expect(focusable[focusable.length - 1]).toHaveFocus();

    fireEvent.click(within(dialog).getByRole('button', { name: 'race condition' }));
    expect(screen.getByRole('dialog', { name: 'race condition' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close concept details' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('warns instead of opening a dialog for an unknown concept id', () => {
    render(
      <KnowledgeContextProvider>
        <ConceptLink conceptId="term:does-not-exist">ghost</ConceptLink>
        <ConceptModal />
      </KnowledgeContextProvider>,
    );
    const warn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      fireEvent.click(screen.getByRole('button', { name: 'ghost' }));
    } finally {
      console.warn = warn;
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toHaveLength(1);
  });

  it('locks page scroll while open and restores it on close', () => {
    renderLesson();
    document.body.style.overflow = '';
    fireEvent.click(screen.getByRole('button', { name: 'clocking block' }));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });
});
