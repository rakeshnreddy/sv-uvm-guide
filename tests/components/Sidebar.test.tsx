import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import manifest from '../../content/curriculum/curriculum.manifest.json';
import Sidebar, { OUTLINE_OVERVIEW_LINK, outlineRowClass, revealCurrentItem } from '@/components/layout/Sidebar';
import {
  buildCourseOutline,
  currentLessonSlug,
  defaultExpansion,
  manifestTierMeta,
  outlineLessonHrefs,
} from '@/components/search/course-outline';
import { shellStore } from '@/components/search/shell-store';
import { focusableWithin } from '@/components/search/useModalDialog';
import { curriculumData } from '@/lib/curriculum-data';
import { tierSectionHref } from '@/lib/site-links';

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

// Picking a link in the drawer starts focusAfterNavigation, which polls for up
// to 8 s until window.location shows the new path. The mocked router never
// navigates, so the real poller would outlive the test file and fire after the
// jsdom environment is torn down ("document is not defined").
vi.mock('@/components/search/focus-target', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/search/focus-target')>()),
  focusAfterNavigation: vi.fn(() => () => {}),
}));

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
    expect(outline.reduce((sum, tier) => sum + tier.moduleCount, 0)).toBe(74);
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

  it('repeats no site links: only tier sections and lessons (SPEC "Course outline")', () => {
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Course outline' });
    expect(within(nav).queryByRole('list', { name: 'Quick links' })).not.toBeInTheDocument();
    const hrefs = within(nav).getAllByRole('link').map((link) => link.getAttribute('href') ?? '');
    const tierHrefs = manifest.tiers.map((tier) => tierSectionHref(tier.id));
    for (const href of hrefs) {
      expect(tierHrefs.includes(href) || manifestLessonHrefs.includes(href), href).toBe(true);
    }
    expect(within(nav).queryByRole('link', { name: OUTLINE_OVERVIEW_LINK.label })).not.toBeInTheDocument();
  });

  it("links each tier heading to its section of /curriculum, beside the tier's disclosure button", () => {
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Course outline' });
    manifest.tiers.forEach((tier) => {
      const link = within(nav).getByRole('link', { name: new RegExp(`^${tier.title}\\W`) });
      expect(link).toHaveAttribute('href', tierSectionHref(tier.id));
      expect(link).not.toHaveAttribute('aria-current');
      expect(within(nav).getByRole('button', { name: `${tier.title} modules` })).toHaveAttribute('aria-expanded');
    });
    expect(within(nav).getByRole('link', { name: /^Tier 2: Intermediate\W/ })).toHaveAttribute('href', '/curriculum#t2');
  });

  it('renders module codes as signal tags inside the module links', () => {
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Course outline' });
    const ipc = within(nav).getByRole('link', { name: 'I-SV-5: Synchronization and IPC' });
    const tag = ipc.querySelector('[data-signal-tag]');
    expect(tag).toHaveTextContent('I-SV-5');
    expect(tag).toHaveAttribute('translate', 'no');
    expect(tag?.tagName).toBe('SPAN');
  });

  it('gives every control a 40 px target', () => {
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Course outline' });
    for (const link of within(nav).getAllByRole('link')) expect(link.className).toMatch(/\bmin-h-10\b/);
    for (const button of within(nav).getAllByRole('button')) expect(button).toHaveClass('h-10', 'w-10');
  });

  it('marks the current lesson with a raised row and a 2 px accent edge, not an accent fill', () => {
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Course outline' });
    const current = nav.querySelector('[aria-current="page"]');
    expect(current).toHaveClass('bg-muted', 'border-l-2', 'border-primary', 'font-medium', 'text-foreground');
    expect(current?.className).not.toMatch(/bg-primary/);
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
    const last = focusableWithin(dialog).at(-1)!;
    expect(last).not.toBe(close);

    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
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

  it('starts with one "Curriculum overview" link, then the outline', () => {
    renderWithOpener();
    act(() => shellStore.openOutline());
    const nav = within(screen.getByRole('dialog', { name: 'Course outline' })).getByRole('navigation', { name: 'Course outline' });
    const links = within(nav).getAllByRole('link');
    expect(links[0]).toHaveAccessibleName('Curriculum overview');
    expect(links[0]).toHaveAttribute('href', '/curriculum');
    expect(links.filter((link) => link.getAttribute('href') === '/curriculum')).toHaveLength(1);
    expect(links[0]).not.toHaveAttribute('aria-current');
    expect(within(nav).queryByRole('list', { name: 'Quick links' })).not.toBeInTheDocument();
    expect(OUTLINE_OVERVIEW_LINK).toEqual({ label: 'Curriculum overview', href: '/curriculum' });
  });

  it('marks the overview link as the current page on /curriculum', () => {
    mockPathname = '/curriculum';
    renderWithOpener();
    act(() => shellStore.openOutline());
    const dialog = screen.getByRole('dialog', { name: 'Course outline' });
    const overview = within(dialog).getByRole('link', { name: 'Curriculum overview' });
    expect(overview).toHaveAttribute('aria-current', 'page');
    expect(overview).toHaveClass('border-primary', 'bg-muted');
  });

  it('closes when the overview or a tier section is followed', async () => {
    const user = userEvent.setup();
    renderWithOpener();
    act(() => shellStore.openOutline());
    await user.click(within(screen.getByRole('dialog', { name: 'Course outline' })).getByRole('link', { name: 'Curriculum overview' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => shellStore.openOutline());
    await user.click(within(screen.getByRole('dialog', { name: 'Course outline' })).getByRole('link', { name: /^Tier 3: Advanced\W/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(shellStore.getState().outlineOpen).toBe(false);
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

describe('outline helpers', () => {
  it('draws the current row as the raised surface with a 2 px accent marker, and others plain', () => {
    expect(outlineRowClass(true)).toMatch(/border-l-2/);
    expect(outlineRowClass(true)).toMatch(/border-primary/);
    expect(outlineRowClass(true)).toMatch(/bg-muted/);
    expect(outlineRowClass(false)).toMatch(/border-transparent/);
    expect(outlineRowClass(false)).not.toMatch(/(^|\s)bg-muted/);
  });

  function scrollBox(currentTop: number) {
    const container = document.createElement('div');
    const current = document.createElement('a');
    current.setAttribute('aria-current', 'page');
    container.appendChild(current);
    Object.defineProperty(container, 'clientHeight', { value: 300 });
    Object.defineProperty(current, 'offsetHeight', { value: 40 });
    container.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    current.getBoundingClientRect = () => ({ top: 100 + currentTop - container.scrollTop }) as DOMRect;
    return container;
  }

  it('scrolls the current item into view, a third of the way down', () => {
    const container = scrollBox(1000);
    revealCurrentItem(container);
    expect(container.scrollTop).toBe(900);
  });

  it('snaps the scroll position to the top of a whole row, so no row is cut in half at the top edge', () => {
    const container = scrollBox(1000);
    // A 40 px row from 880 to 920 straddles the unsnapped target (900).
    const row = document.createElement('a');
    container.insertBefore(row, container.firstChild);
    row.getBoundingClientRect = () => ({ top: 100 + 880 - container.scrollTop }) as DOMRect;
    revealCurrentItem(container);
    expect(container.scrollTop).toBe(880);
  });

  it('leaves the scroll position alone when the current item is visible, or there is none', () => {
    const container = scrollBox(120);
    revealCurrentItem(container);
    expect(container.scrollTop).toBe(0);
    expect(() => revealCurrentItem(null)).not.toThrow();
    expect(() => revealCurrentItem(document.createElement('div'))).not.toThrow();
  });
});
