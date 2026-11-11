import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InterviewPractisedTile } from '@/components/learner/InterviewPractisedTile';
import { __resetRecordsForTests, __resetStorageForTests, setQuestionPractised } from '@/lib/learner-store';
import { INTERVIEW_PREP_HREF } from '@/lib/site-links';

beforeEach(() => {
  localStorage.clear();
  __resetStorageForTests();
  __resetRecordsForTests();
});

afterEach(() => {
  localStorage.clear();
});

describe('InterviewPractisedTile', () => {
  it('says "Interview questions practised: N of total" with the way to interview prep', () => {
    setQuestionPractised('uvm-why-uvm', { bank: 'uvm', level: 'junior' });
    setQuestionPractised('sv-why-systemverilog', { bank: 'systemverilog', level: 'junior' });
    render(<InterviewPractisedTile total={166} />);
    const tile = screen.getByRole('region', { name: 'Interview questions practised' });
    expect(tile).toHaveTextContent('2 of 166');
    expect(tile).toHaveTextContent('164 left to practise.');
    expect(within(tile).getByRole('link', { name: 'Open interview prep' })).toHaveAttribute('href', INTERVIEW_PREP_HREF);
    // One card: nothing inside it is another card.
    expect(tile.querySelectorAll('section')).toHaveLength(0);
  });

  it('explains the mark when none is set, and follows changes', () => {
    render(<InterviewPractisedTile total={3} />);
    const tile = screen.getByRole('region', { name: 'Interview questions practised' });
    expect(tile).toHaveTextContent('0 of 3');
    expect(tile).toHaveTextContent('Mark a question as practised once you can answer it without the model answer.');
    act(() => {
      setQuestionPractised('a', { bank: 'b', level: 'junior' });
      setQuestionPractised('c', { bank: 'b', level: 'junior' });
      setQuestionPractised('d', { bank: 'b', level: 'junior' });
    });
    expect(tile).toHaveTextContent('3 of 3');
    expect(tile).toHaveTextContent('Every question is marked as practised.');
  });
});
