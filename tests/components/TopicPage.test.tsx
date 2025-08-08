import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import TopicPage from '../../src/components/templates/TopicPage';

const store: Record<string, any> = {};

afterEach(() => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
});

vi.mock('firebase/firestore', () => ({
  getDoc: async (ref: string) => ({
    exists: () => store[ref] !== undefined,
    data: () => store[ref],
  }),
  setDoc: async (ref: string, data: any, options?: { merge?: boolean }) => {
    if (options?.merge && store[ref]) {
      store[ref] = { ...store[ref], ...data };
    } else {
      store[ref] = { ...data };
    }
  },
  doc: (_db: unknown, ...segments: string[]) => segments.join('/'),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'test-user', isAnonymous: false } }),
}));

vi.mock('@/lib/firebase', () => ({ db: {} }));

describe('TopicPage flashcard progress', () => {
  const flashcards = [
    { id: 1, front: 'Q1', back: 'A1' },
    { id: 2, front: 'Q2', back: 'A2' },
    { id: 3, front: 'Q3', back: 'A3' },
  ];

  it('saves and restores progress', async () => {
    const path = 'users/test-user/topics/test-topic';
    store[path] = { flashcardProgress: { lastViewedCardIndex: 1 } };

    const props = {
      title: 'Test Topic',
      level1Content: <div />,
      level2Content: <div />,
      level3Content: <div />,
      flashcards,
      topicId: 'test-topic',
    };

    const { unmount } = render(<TopicPage {...props} />);

    await screen.findByText('Card 2 of 3');

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(store[path].flashcardProgress.lastViewedCardIndex).toBe(2);
    });

    unmount();

    render(<TopicPage {...props} />);
    await screen.findByText('Card 3 of 3');
  });
});
