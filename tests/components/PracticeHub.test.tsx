import React from 'react';
import { render, screen, within } from '@testing-library/react';
import PracticeHub from '@/components/practice/PracticeHub';
import { loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { getAllLabs, getLabById } from '@/lib/lab-registry';
import { getLabLessons, getPracticePages } from '@/lib/practice-links';

describe('PracticeHub', () => {
  it('renders hero section with title and description', () => {
    render(<PracticeHub />);

    expect(
      screen.getByRole('heading', { level: 1, name: /practice hub/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/sharpen your systemverilog/i)).toBeInTheDocument();
  });

  it('groups items by category and renders cards', () => {
    render(<PracticeHub />);

    const exerciseHeading = screen.getByRole('heading', {
      level: 2,
      name: /exercise/i,
    });
    expect(exerciseHeading).toBeInTheDocument();

    const cardTitles = screen.getAllByRole('heading', { level: 3 });
    expect(cardTitles.length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'exercises page' })).toHaveAttribute('href', '/exercises');
  });

  it('never links coming-soon labs (their routes 404); only available labs are links', () => {
    render(<PracticeHub />);
    const comingSoon = screen.getAllByText(/coming soon/i);
    expect(comingSoon.length).toBeGreaterThan(0);
    comingSoon.forEach((badge) => expect(badge.closest('a')).toBeNull());

    const labLinks = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/practice/lab/'));
    expect(labLinks.length).toBeGreaterThan(0);
    labLinks.forEach((a) =>
      expect(getLabById(a.getAttribute('href')!.replace('/practice/lab/', ''))?.status).toBe('available'),
    );

    for (const lab of getAllLabs().filter((entry) => entry.status === 'coming_soon')) {
      const heading = screen.getByRole('heading', { level: 4, name: lab.title });
      expect(heading.closest('a')).toBeNull();
      expect(within(heading).queryByRole('link')).toBeNull();
    }
  });

  it('names the lesson behind every available lab and links it', () => {
    render(<PracticeHub />);
    for (const lab of getAllLabs().filter((entry) => entry.status === 'available')) {
      const card = screen.getByRole('link', { name: lab.title }).closest('li') as HTMLElement;
      expect(within(card).getByText('Learn it in')).toBeInTheDocument();
      const hrefs = within(card).getAllByRole('link').map((a) => a.getAttribute('href'));
      expect(hrefs).toContain(getLabLessons(lab)[0].href);
      expect(card).toHaveTextContent('Sign in to open.');
    }
  });

  it('lists every practice page with its teaching lesson, in curriculum order', () => {
    render(<PracticeHub />);
    const pages = getPracticePages();
    for (const page of pages) {
      const link = screen.getByRole('link', { name: page.title });
      expect(link).toHaveAttribute('href', page.href);
      const card = link.closest('li') as HTMLElement;
      expect(within(card).getAllByRole('link').map((a) => a.getAttribute('href'))).toContain(page.lessons[0].href);
    }
    const interactive = screen.getByRole('region', { name: 'Interactive models' });
    expect(within(interactive).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(
      pages.filter((page) => page.kind === 'interactive').map((page) => page.title),
    );
  });

  it('links each interview bank to its section of /interview-prep', () => {
    render(<PracticeHub />);
    const region = screen.getByRole('region', { name: 'Interview prep' });
    for (const bank of loadInterviewBanks()) {
      expect(within(region).getByRole('link', { name: bank.title })).toHaveAttribute('href', `/interview-prep#${bank.anchor}`);
    }
    expect(within(region).getByRole('link', { name: 'interview prep page' })).toHaveAttribute('href', '/interview-prep');
  });
});
