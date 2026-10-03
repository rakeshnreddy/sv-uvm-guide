import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConceptLink from '@/components/knowledge/ConceptLink';
import ConceptModal from '@/components/knowledge/ConceptModal';
import { KnowledgeContextProvider } from '@/contexts/KnowledgeContext';

function renderLesson() {
  return render(
    <KnowledgeContextProvider>
      <p>
        Start with <ConceptLink conceptId="data_types">data types</ConceptLink> first.
      </p>
      <ConceptModal />
    </KnowledgeContextProvider>,
  );
}

describe('ConceptLink + ConceptModal', () => {
  it('renders the inline concept as a keyboard-reachable button', () => {
    renderLesson();
    const trigger = screen.getByRole('button', { name: 'data types' });
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('opens a labelled modal dialog, focuses close, and closes on Escape with focus returned', async () => {
    renderLesson();
    const trigger = screen.getByRole('button', { name: 'data types' });

    // The graph loads asynchronously; retry the click until the dialog appears.
    await waitFor(() => {
      trigger.focus();
      fireEvent.click(trigger);
      expect(screen.getByRole('dialog', { name: 'Data Types' })).toBeInTheDocument();
    });

    const close = screen.getByRole('button', { name: 'Close concept details' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
