import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import manifest from '../../content/curriculum/curriculum.manifest.json';
import Sidebar from '@/components/layout/Sidebar';
import {
  buildCourseOutline,
  currentLessonSlug,
  defaultExpansion,
  manifestTierMeta,
  outlineLessonHrefs,
} from '@/components/search/course-outline';
import { shellStore } from '@/components/search/shell-store';
import { curriculumData } from '@/lib/curriculum-data';

let mockPathname = '/practice';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', async () => {
  const ReactModule = await import('react');
  type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };
  const MockLink = ReactModule.forwardRef<HTMLAnchorElement, LinkProps>(({ href, children, prefetch: _prefetch, onClick, ...rest }, ref) => (
    <a
      ref={ref}
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  ));
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

const MAILBOXES = '/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes';

const manifestLessonHrefs = manifest.tiers.flatMap((tier) =>
  tier.modules.flatMap((mod) => mod.lessons.map((lesson) => `/curriculum/${tier.id}/${mod.id}/${lesson}`)),
);

beforeEach(() => {
  shellStore.reset();
  mockPathname = '/practice';
});

afterEach(() => {
  cleanup();
  shellStore.reset();
  window.localStorage.clear();
});

describe('course outline model', () => {
  const outline = buildCourseOutline(curriculumData, manifestTierMeta, null);

  it('lists every lesson in manifest order', () => {
    expect(outlineLessonHrefs(outline)).toEqual(manifestLessonHrefs);
  });

  it('keeps tiers and modules in manifest order, with manifest tier titles', () => {
    expect(outline.map((tier) => tier.id)).toEqual(manifest.tiers.map((tier) => tier.id));
    expect(outline.map((tier) => tier.title)).toEqual(manifest.tiers.map((tier) => tier.title));
    outline.forEach((tier, index) => {
      const modules = tier.groups.flatMap((group) => group.modules.map((mod) => mod.id));
      expect(modules).toEqual(manifest.tiers[index].modules.map((mod) => mod.id));
      expect(tier.moduleCount).toBe(manifest.tiers[index].modules.length);
    });
    expect(outline).toHaveLength(4);
    expect(outline.reduce((sum, tier) => sum + tier.moduleCount, 0)).toBe(70);
  });

  it('groups consecutive elective modules and labels their track', () => {
    for (const [index, tier] of outline.entries()) {
      const tracks = Object.fromEntries(manifest.tiers[index].modules.map((mod) => [mod.id, mod.track]));
      for (const group of tier.groups) {
        for (const mod of group.modules) expect(mod.track).toBe(group.track);
        for (const mod of group.modules) expect(tracks[mod.id]).toBe(group.track);
      }
      // Runs are maximal: two neighbouring groups never share a track.
      tier.groups.slice(1).forEach((group, groupIndex) => expect(group.track).not.toBe(tier.groups[groupIndex].track));
    }
    const t2Electives = outline[1].groups.filter((group) => group.track === 'elective').flatMap((group) => group.modules);
    expect(t2Electives.map((mod) => mod.code)).toEqual(['I-SV-8']);
    const t4Electives = outline[3].groups.filter((group) => group.track === 'elective').flatMap((group) => group.modules);
    expect(t4Electives.map((mod) => mod.code)).toEqual(['E-EMU-1', 'E-PYUVM-1', 'E-UVM-ML-1', 'E-RISCV-1', 'E-AI-1']);
  });

  it('shows module titles without their code and lesson titles without legacy suffixes', () => {
    const ipc = outline[1].groups[0].modules.find((mod) => mod.code === 'I-SV-5');
    expect(ipc?.title).toBe('Synchronization and IPC');
    expect(ipc?.lessons.map((lesson) => lesson.title)).toEqual([
      'Synchronization and IPC',
      'Events',
      'Mailboxes',
      'Semaphores',
    ]);
  });

  it('marks exactly the current lesson, module and tier', () => {
    const marked = buildCourseOutline(curriculumData, manifestTierMeta, currentLessonSlug(MAILBOXES));
    const currentLessons = marked.flatMap((tier) =>
      tier.groups.flatMap((group) => group.modules.flatMap((mod) => mod.lessons.filter((lesson) => lesson.current))),
    );
    expect(currentLessons.map((lesson) => lesson.href)).toEqual([MAILBOXES]);
    expect(marked.filter((tier) => tier.current).map((tier) => tier.code)).toEqual(['T2']);
    expect(defaultExpansion(marked)).toEqual({ tiers: ['T2_Intermediate'], modules: ['I-SV-5_Synchronization_and_IPC'] });
    expect(defaultExpansion(outline)).toEqual({ tiers: ['T1_Foundational'], modules: [] });
  });

  it('recognises every URL form of a lesson, and nothing else', () => {
    expect(currentLessonSlug(MAILBOXES)).toEqual(['T2_Intermediate', 'I-SV-5_Synchronization_and_IPC', 'mailboxes']);
    expect(currentLessonSlug('/curriculum/T1_Foundational/F2A_Core_Data_Types')).toEqual([
      'T1_Foundational',
      'F2A_Core_Data_Types',
      'index',
    ]);
    expect(currentLessonSlug('/curriculum/t2-intermediate/i-sv-5-synchronization-and-ipc/mailboxes')).toEqual(
      currentLessonSlug(MAILBOXES),
    );
    expect(currentLessonSlug('/curriculum')).toBeNull();
    expect(currentLessonSlug('/curriculum/does-not-exist')).toBeNull();
    expect(currentLessonSlug('/practice')).toBeNull();
    expect(currentLessonSlug(null)).toBeNull();
  });
});

describe('docked course outline on a lesson page', () => {
  beforeEach(() => {
    mockPathname = MAILBOXES;
  });

  it('renders a named navigation landmark with the current lesson marked', () => {
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Course outline' });
    const current = within(nav).getByRole('link', { name: 'Mailboxes' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveAttribute('href', MAILBOXES);
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the current tier and module, and lets each tier collapse', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Course outline' });

    const t1 = within(nav).getByRole('button', { name: /Tier 1: Foundations/ });
    const t2 = within(nav).getByRole('button', { name: /Tier 2: Intermediate/ });
    expect(t2).toHaveAttribute('aria-expanded', 'true');
    expect(t1).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).queryByRole('link', { name: /F1A/ })).not.toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'I-SV-5 lessons (3)' })).toHaveAttribute('aria-expanded', 'true');

    await user.click(t1);
    expect(t1).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(t1.getAttribute('aria-controls') ?? '')).not.toHaveAttribute('hidden');
    expect(within(nav).getByRole('link', { name: 'F1A: The Cost of Bugs' })).toHaveAttribute(
      'href',
      '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index',
    );

    await user.click(t2);
    expect(t2).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).queryByRole('link', { name: 'Mailboxes' })).not.toBeInTheDocument();
  });

  it('is operable from the keyboard', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Course outline' });
    const t3 = within(nav).getByRole('button', { name: /Tier 3: Advanced/ });
    t3.focus();
    await user.keyboard('{Enter}');
    expect(t3).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard(' ');
    expect(t3).toHaveAttribute('aria-expanded', 'false');

    const moduleToggle = within(nav).getByRole('button', { name: 'I-SV-5 lessons (3)' });
    moduleToggle.focus();
    await user.keyboard('{Enter}');
    expect(moduleToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('groups and labels electives', () => {
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Course outline' });
    const electives = within(nav).getByRole('group', { name: /Electives/ });
    expect(within(electives).getByRole('link', { name: /I-SV-8/ })).toHaveAttribute(
      'href',
      '/curriculum/T2_Intermediate/I-SV-8_Power_Intent_and_UPF/index',
    );
  });

  it('shows no authoring-status badges or placeholder bookmarks', () => {
    render(<Sidebar />);
    for (const text of ['Draft', 'In Review', 'Complete', 'Bookmarks', 'Quick Access']) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
  });

  it('hides when the learner asks, and remembers it', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole('button', { name: 'Hide course outline' }));
    expect(screen.queryByRole('navigation', { name: 'Course outline' })).not.toBeInTheDocument();
    expect(shellStore.getState().outlineCollapsed).toBe(true);
    expect(window.localStorage.getItem('sv-uvm:outline-collapsed')).toBe('1');
    act(() => shellStore.setOutlineCollapsed(false));
    expect(screen.getByRole('navigation', { name: 'Course outline' })).toBeInTheDocument();
    expect(window.localStorage.getItem('sv-uvm:outline-collapsed')).toBeNull();
  });
});

describe('course outline drawer (below lg, and off lesson pages)', () => {
  function renderWithOpener() {
    render(
      <>
        <button type="button">Opener</button>
        <Sidebar />
      </>,
    );
    const opener = screen.getByRole('button', { name: 'Opener' });
    opener.focus();
    return opener;
  }

  it('is a labelled modal dialog that takes focus and gives it back on Escape', async () => {
    const user = userEvent.setup();
    const opener = renderWithOpener();
    expect(screen.queryByRole('navigation', { name: 'Course outline' })).not.toBeInTheDocument();

    act(() => shellStore.openOutline());
    const dialog = screen.getByRole('dialog', { name: 'Course outline' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('navigation', { name: 'Course outline' })).toBeInTheDocument();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close course outline' }));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
    expect(shellStore.getState().outlineOpen).toBe(false);
  });

  it('closes from the backdrop and from its close button', async () => {
    const user = userEvent.setup();
    renderWithOpener();
    act(() => shellStore.openOutline());
    fireEvent.click(screen.getByTestId('course-outline-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => shellStore.openOutline());
    await user.click(screen.getByRole('button', { name: 'Close course outline' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    renderWithOpener();
    act(() => shellStore.openOutline());
    const dialog = screen.getByRole('dialog', { name: 'Course outline' });
    const close = within(dialog).getByRole('button', { name: 'Close course outline' });
    const practice = within(dialog).getByRole('link', { name: 'Practice hub' });

    practice.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(practice);
  });

  it('starts on the current lesson and closes when a lesson is chosen', async () => {
    const user = userEvent.setup();
    mockPathname = MAILBOXES;
    renderWithOpener();
    act(() => shellStore.openOutline());
    const dialog = screen.getByRole('dialog', { name: 'Course outline' });
    expect(document.activeElement).toBe(within(dialog).getByRole('link', { name: 'Mailboxes' }));

    await user.click(within(dialog).getByRole('link', { name: 'Semaphores' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('links the curriculum overview and the practice hub', () => {
    renderWithOpener();
    act(() => shellStore.openOutline());
    const dialog = screen.getByRole('dialog', { name: 'Course outline' });
    expect(within(dialog).getByRole('link', { name: 'Practice hub' })).toHaveAttribute('href', '/practice');
    expect(within(dialog).getByRole('link', { name: 'Curriculum overview' })).toHaveAttribute('href', '/curriculum');
  });

  it('stops the page behind from scrolling while open', async () => {
    const user = userEvent.setup();
    renderWithOpener();
    act(() => shellStore.openOutline());
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });
});
