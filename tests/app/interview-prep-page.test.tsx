import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import InterviewPrepPage from '@/app/(learning)/interview-prep/page';
import { loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';

describe('/interview-prep page', () => {
  const banks = loadInterviewBanks();

  it('renders one h1 and a section per bank, with level headings', () => {
    render(<InterviewPrepPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const bankHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(bankHeadings.map((heading) => heading.textContent)).toEqual(banks.map((bank) => bank.title));
    bankHeadings.forEach((heading, index) => expect(heading).toHaveAttribute('id', banks[index].anchor));
    const levelCount = banks.reduce((sum, bank) => sum + bank.levels.length, 0);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(levelCount);
  });

  it('jumps to each bank from the bank list', () => {
    render(<InterviewPrepPage />);
    const nav = screen.getByRole('navigation', { name: 'Interview banks' });
    expect(within(nav).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(
      banks.map((bank) => `#${bank.anchor}`),
    );
  });

  it('keeps every model answer hidden until the learner reveals it', () => {
    render(<InterviewPrepPage />);
    const total = banks.reduce((sum, bank) => sum + bank.questionCount, 0);
    const buttons = screen.getAllByRole('button', { name: 'Reveal model answer' });
    expect(buttons).toHaveLength(total);

    const [first] = buttons;
    expect(first).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(first.getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeNull();
    expect(panel).not.toBeVisible();

    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveTextContent('Hide model answer');
    expect(panel).toBeVisible();
    expect(within(panel as HTMLElement).getByText('Model answer')).toBeInTheDocument();
  });

  it('links questions and banks to canonical lesson URLs', () => {
    render(<InterviewPrepPage />);
    const lessonLinks = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/curriculum/'));
    expect(lessonLinks.length).toBeGreaterThan(banks.length);
    for (const href of lessonLinks) expect(href).toMatch(/^\/curriculum\/T[1-4]_[A-Za-z]+\/[^/]+\/[^/]+$/);
    expect(screen.getByRole('link', { name: 'Practice Hub' })).toHaveAttribute('href', '/practice');
  });
});
