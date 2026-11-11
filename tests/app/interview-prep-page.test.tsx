import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import InterviewPrepPage from '@/app/(learning)/interview-prep/page';
import InterviewBankPage, { generateMetadata, generateStaticParams } from '@/app/(learning)/interview-prep/[bank]/page';
import { interviewLevelOptions, loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import sitemap, { interviewBankPaths } from '@/app/sitemap';
import { bankRowLine } from '@/components/interview/BankNav';
import { INTERVIEW_BANK_OUTCOMES } from '@/lib/practice-links';

const banks = loadInterviewBanks();

/** The bank JSON as it is on disk: what every page must show, question by question. */
const rawQuestions = fs
  .readdirSync(path.resolve(__dirname, '../../content/interview-questions'))
  .filter((file) => file.endsWith('.json'))
  .flatMap((file) => {
    const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/interview-questions', file), 'utf8')) as {
      questions: { id: string; prompt: string; level: string }[];
    };
    return raw.questions.map((question) => ({ ...question, file }));
  });

function renderBank(slug: string) {
  return render(<InterviewBankPage params={{ bank: slug }} />);
}

describe('/interview-prep index', () => {
  it('renders one h1, the level filter and one row per bank', () => {
    render(<InterviewPrepPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const filter = screen.getByRole('group', { name: 'Level' });
    expect(within(filter).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual([
      'All levels',
      'Junior',
      'Mid-level',
      'Senior',
      'Staff',
      'Senior staff',
    ]);
    expect(within(filter).getByRole('radio', { name: 'All levels' })).toBeChecked();
    const rows = document.querySelectorAll('[data-bank-row]');
    expect(rows).toHaveLength(banks.length);
  });

  it('links each bank row to its page and keeps the old bank anchor on the row', () => {
    render(<InterviewPrepPage />);
    banks.forEach((bank) => {
      const row = document.getElementById(bank.anchor) as HTMLElement;
      expect(row, bank.anchor).toHaveAttribute('data-bank-row', bank.slug);
      expect(within(row).getByRole('link', { name: bank.name })).toHaveAttribute('href', bank.href);
      // The teaching lesson's module code, as a signal tag linking to the lesson.
      const tag = row.querySelector('a[data-lesson-tag]');
      expect(tag).toHaveAttribute('href', bank.lessons[0].href);
      expect(tag?.querySelector('[data-signal-tag]')).toHaveTextContent(bank.lessons[0].code);
    });
  });

  it("shows each bank's authored outcome line in full: never clamped, so no row ends in an ellipsis", () => {
    render(<InterviewPrepPage />);
    banks.forEach((bank) => {
      const line = document.getElementById(bank.anchor)!.querySelector('[data-bank-outcome]') as HTMLElement;
      expect(line, bank.anchor).toHaveTextContent(INTERVIEW_BANK_OUTCOMES[bank.topic]);
      expect(line.className).not.toMatch(/line-clamp|truncate/);
    });
    expect(bankRowLine({ topic: 'no-such-topic', description: 'Interview preparation for simulation debug, from logs to triage.' })).toBe(
      'Simulation debug, from logs to triage.',
    );
  });

  it('gives the level chips the 3:1 control boundary, like the other form controls', () => {
    render(<InterviewPrepPage />);
    for (const radio of within(screen.getByRole('group', { name: 'Level' })).getAllByRole('radio')) {
      expect(radio.closest('label')).toHaveClass('border-input');
      expect(radio.closest('label')?.className).not.toMatch(/(^| )border-border( |$)/);
    }
  });

  it('renders every count variant, so the filter can show the one for the chosen level without scripts', () => {
    render(<InterviewPrepPage />);
    const row = document.getElementById(banks[0].anchor) as HTMLElement;
    const variants = Array.from(row.querySelectorAll('[data-level-count]:not([data-practised-count])')).map((node) => [
      node.getAttribute('data-level-count'),
      node.textContent,
    ]);
    expect(variants[0]).toEqual(['all', `${banks[0].questionCount} questions`]);
    expect(variants.slice(1).map(([level]) => level)).toEqual(interviewLevelOptions(banks).map((level) => level.value));
    expect(variants[1][1]).toBe(`${banks[0].levelCounts.junior} junior questions`);
  });

  it('holds no question text: the questions live on the bank pages', () => {
    const { container } = render(<InterviewPrepPage />);
    expect(container.querySelectorAll('details')).toHaveLength(0);
    expect(container.textContent).not.toContain(rawQuestions[0].prompt.slice(0, 40));
  });

  it('is a top-level page, so it has no breadcrumb', () => {
    render(<InterviewPrepPage />);
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });
});

describe('/interview-prep/<bank> pages', () => {
  it('prerenders one page per bank, all of them in the sitemap', () => {
    expect(generateStaticParams()).toEqual(banks.map((bank) => ({ bank: bank.slug })));
    expect(interviewBankPaths()).toEqual(banks.map((bank) => `/interview-prep/${bank.slug}`));
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    for (const href of interviewBankPaths()) expect(urls.filter((url) => url === href)).toHaveLength(1);
    expect(generateMetadata({ params: { bank: 'uvm' } })).toMatchObject({ title: 'UVM interview questions' });
  });

  it('shows every question in the data exactly once, on its own bank page', () => {
    const seen = new Map<string, number>();
    for (const bank of banks) {
      const { container, unmount } = renderBank(bank.slug);
      const rows = Array.from(container.querySelectorAll('details[data-question-level]'));
      expect(rows, bank.slug).toHaveLength(bank.questionCount);
      for (const row of rows) {
        const id = row.id.replace(/^q-/, '');
        seen.set(id, (seen.get(id) ?? 0) + 1);
        const raw = rawQuestions.find((question) => question.id === id);
        expect(raw, `${id} is not in the bank files`).toBeDefined();
        expect(raw?.file).toBe(bank.file);
        expect(row.getAttribute('data-question-level')).toBe(raw?.level);
      }
      unmount();
    }
    expect([...seen.keys()].sort()).toEqual(rawQuestions.map((question) => question.id).sort());
    for (const [id, count] of seen) expect(count, id).toBe(1);
  });

  it('keeps each question collapsed until opened, with its answer and lessons inside', () => {
    const { container } = renderBank('uvm');
    const rows = Array.from(container.querySelectorAll<HTMLDetailsElement>('details[data-question-level]'));
    expect(rows.every((row) => !row.open)).toBe(true);
    const row = container.querySelector('#q-uvm-factory-purpose') as HTMLDetailsElement;
    expect(row.querySelector('summary')).toHaveTextContent(/factory/i);
    expect(row.querySelector('summary [data-kind]')?.textContent).toMatch(/^(Junior|Mid-level|Senior|Staff|Senior staff) · /);
    const answer = row.querySelector('[data-answer]') as HTMLElement;
    expect(within(answer).getByRole('heading', { name: 'Model answer' })).toBeInTheDocument();
    expect(within(answer).getByRole('heading', { name: 'Learn it in' })).toBeInTheDocument();
    for (const link of within(answer).getAllByRole('link')) expect(link.getAttribute('href')).toMatch(/^\/curriculum\/T[1-4]_[A-Za-z]+\/[^/]+\/[^/]+$/);
  });

  it('has one h1, a breadcrumb to the index, the bank tabs and a heading per level', () => {
    const bank = banks.find((entry) => entry.slug === 'systemverilog');
    if (!bank) throw new Error('no systemverilog bank');
    renderBank(bank.slug);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SystemVerilog interview questions');
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    // The trail and its phone "back" link both lead to the index.
    for (const link of within(crumbs).getAllByRole('link', { name: 'Interview prep' })) expect(link).toHaveAttribute('href', '/interview-prep');
    const tabs = screen.getByRole('navigation', { name: 'Interview banks' });
    expect(within(tabs).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(banks.map((entry) => entry.href));
    expect(within(tabs).getByRole('link', { current: 'page' })).toHaveAttribute('href', bank.href);
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      ...bank.levels.map((group) => group.label),
      'Related lessons',
    ]);
    expect(screen.getByRole('button', { name: 'Expand all in this bank' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeInTheDocument();
  });

  it('gives the short bank tab its whole name for screen readers', () => {
    renderBank('sva-formal');
    const tabs = screen.getByRole('navigation', { name: 'Interview banks' });
    expect(within(tabs).getByRole('link', { name: /^SVA & formal verification 20 questions$/ })).toBeInTheDocument();
  });

  it('marks code blocks and tables as focusable named regions', () => {
    const { container } = renderBank('amba-protocols');
    const regions = Array.from(container.querySelectorAll('[data-scroll]'));
    expect(regions.length).toBeGreaterThan(0);
    for (const region of regions) {
      expect(region).toHaveAttribute('tabindex', '0');
      expect(region).toHaveAttribute('role', 'region');
      expect(region.getAttribute('aria-label')).toMatch(/code example|^Table$/i);
    }
  });
});
