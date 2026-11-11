import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CurriculumOverview from '@/components/curriculum/CurriculumOverview';
import LessonOrientation from '@/components/curriculum/LessonOrientation';
import { routeOpeningModules, routeStartTier } from '@/components/curriculum/RouteChooser';
import { glassCardHover, primaryAction, tierChip } from '@/components/curriculum/overview-ui';
import HeroSection from '@/components/home/HeroSection';
import type { HomeStats } from '@/components/home/home-stats';
import PracticeHub, { PRACTICE_GLASS_CARDS, practiceItemTier } from '@/components/practice/PracticeHub';
import { curriculumData } from '@/lib/curriculum-data';
import { getLessonContext } from '@/lib/curriculum/lesson-context';
import { PLANNED_MODULES, buildCurriculumOverview } from '@/lib/curriculum-overview';
import { readLessonMinutes, readManifestTiers } from '@/lib/curriculum-scan';
import { getAllLabs } from '@/lib/lab-registry';
import { resolveMilestones, resolveRoutes } from '@/lib/learning-paths';
import { getPracticeLabItems } from '@/lib/practice-links';
import { tierOfModuleCode } from '@/lib/tier-colors';

/*
 * Colour and glass on the pages (DESIGN.md section 11): glass on the cards over
 * the colour field, quiet glass further down, the tier colour on everything
 * that belongs to one tier, and the primary sheen on the one filled action.
 */

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const labs = getAllLabs();
const tiers = buildCurriculumOverview({
  data: curriculumData,
  tiers: readManifestTiers(),
  minutesByLesson: readLessonMinutes(curriculumData),
  labs,
  nextOf: () => undefined,
});
const routes = resolveRoutes(curriculumData, { labs });
const milestones = resolveMilestones(labs);

beforeEach(() => localStorage.clear());

describe('shared classes', () => {
  it('gives the one filled action the primary sheen, without the old hover fill', () => {
    expect(primaryAction.split(' ')).toContain('sheen-primary');
    expect(primaryAction).not.toContain('hover:bg-primary/90');
    expect(primaryAction).toContain('forced-colors:border-[ButtonText]');
  });

  it('keeps hover and focus feedback on quiet glass cards and tier chips', () => {
    expect(glassCardHover).toContain('hover:bg-muted');
    expect(glassCardHover).toContain('has-[:focus-visible]:ring-2');
    expect(tierChip.split(' ')).toEqual(expect.arrayContaining(['glass-quiet', 'border-tier-current-border', 'min-h-[40px]']));
  });
});

describe('/curriculum overview', () => {
  it('starts each route card at its first tier: Junior in tier 1, Practitioner in tier 2, Expert in tier 4', () => {
    const byId = Object.fromEntries(routes.map((route) => [route.id, routeStartTier(route)]));
    expect(byId).toEqual({ junior: 1, practitioner: 2, expert: 4 });
    for (const route of routes) {
      const opening = routeOpeningModules(route);
      expect(opening.length, route.id).toBeGreaterThan(0);
      expect(opening.length, route.id).toBeLessThanOrEqual(3);
    }
  });

  it('makes the route cards quiet glass with the tier edge, and shows their first modules as tinted tags', () => {
    render(<CurriculumOverview tiers={tiers} routes={routes} milestones={milestones} planned={PLANNED_MODULES} />);
    for (const [id, tier] of [['junior', '1'], ['practitioner', '2'], ['expert', '4']] as const) {
      const card = document.getElementById(`route-${id}`)!;
      expect(card, id).toHaveClass('glass-quiet', 'tier-edge');
      expect(card, id).not.toHaveClass('glass');
      expect(card, id).toHaveAttribute('data-tier', tier);
      expect(card.className, id).not.toMatch(/\bbg-card\b/);
      const tags = within(within(card).getByTestId('route-opening-modules')).getAllByText((_, el) => el?.hasAttribute('data-signal-tag') ?? false);
      expect(tags.length, id).toBeGreaterThan(0);
      tags.forEach((tag) => expect(tag).toHaveAttribute('data-tier'));
    }
    // Nothing on the page blurs: with the header and a menu the route cards would pass three blurred layers.
    expect(document.querySelectorAll('.glass')).toHaveLength(0);
    const ladder = screen.getByRole('heading', { name: 'The milestone ladder' }).closest('section')!;
    expect(ladder).toHaveClass('glass-quiet');
    // Milestone ids are signal tags and stay neutral.
    const m0 = within(ladder).getAllByText('M0').find((el) => el.hasAttribute('data-signal-tag'))!;
    expect(m0).not.toHaveAttribute('data-tier');
  });

  it('scopes every tier section to its tier: the step mark, the top edge and quiet-glass module cards', () => {
    render(<CurriculumOverview tiers={tiers} routes={routes} milestones={milestones} planned={PLANNED_MODULES} />);
    for (const n of [1, 2, 3, 4]) {
      const section = document.getElementById(`t${n}`)!;
      expect(section).toHaveAttribute('data-tier', String(n));
      expect(section).toHaveClass('tier-edge');
      const step = within(section.querySelector('h3')!).getByTestId('tier-step');
      expect(step).toHaveAttribute('aria-hidden', 'true');
      expect(step).toHaveClass('tier-step');
    }
    // Tier 1 is open by default: its module cards are quiet glass with their own tier.
    const cards = document.getElementById('t1')!.querySelectorAll('article');
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((card) => {
      expect(card).toHaveClass('glass-quiet', 'tier-edge');
      expect(card).toHaveAttribute('data-tier', '1');
      expect(card).not.toHaveClass('glass');
    });
  });

  it('puts the four tier jump links in the page header and the stack cards on quiet glass', async () => {
    const { default: CurriculumPage } = await import('@/app/(learning)/curriculum/page');
    const html = renderToStaticMarkup(<CurriculumPage />);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nav = doc.querySelector('[data-page-header] nav[aria-label="Tiers"]')!;
    expect(nav).not.toBeNull();
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['#t1', '#t2', '#t3', '#t4']);
    expect(links.map((a) => a.getAttribute('data-tier'))).toEqual(['1', '2', '3', '4']);
    links.forEach((a) => expect(a.querySelector('.tier-step')?.getAttribute('aria-hidden')).toBe('true'));
    const stack = doc.querySelectorAll('#verification-stack li');
    expect(stack.length).toBeGreaterThan(0);
    stack.forEach((li) => expect(li.classList.contains('glass-quiet')).toBe(true));
  }, 120_000);
});

describe('lesson header', () => {
  it('tints the tier tag in the tier colour; milestones stay neutral', () => {
    const context = getLessonContext(['T3_Advanced', 'A-UVM-6_Scoreboards_and_Reference_Models', 'index'])!;
    render(<LessonOrientation context={context} title="Scoreboards" readingMinutes={5} />);
    const eyebrow = document.querySelector('[data-page-header-eyebrow]')!;
    const [tierTag] = Array.from(eyebrow.querySelectorAll('[data-signal-tag]'));
    expect(tierTag).toHaveTextContent('T3');
    expect(tierTag).toHaveAttribute('data-tier', '3');
    screen.getByTestId('lesson-milestones').querySelectorAll('[data-signal-tag]').forEach((tag) => {
      expect(tag).not.toHaveAttribute('data-tier');
    });
  });
});

describe('practice hub', () => {
  it('takes a card\'s tier from the module that teaches it', () => {
    for (const item of getPracticeLabItems(labs)) {
      const [lesson] = item.lessons;
      expect(practiceItemTier(item), item.id).toBe(lesson ? tierOfModuleCode(lesson.code) : undefined);
    }
  });

  it('puts every card on quiet glass, so the hub never passes three blurred layers', () => {
    render(<PracticeHub />);
    expect(PRACTICE_GLASS_CARDS).toBe(0);
    expect(document.querySelectorAll('.glass')).toHaveLength(0);
    const labsRegion = screen.getByRole('region', { name: 'Labs' });
    const labCards = Array.from(labsRegion.querySelectorAll(':scope > div > ul > li'));
    labCards.slice(0, PRACTICE_GLASS_CARDS).forEach((li) => expect(li).toHaveClass('glass'));
    labCards.slice(PRACTICE_GLASS_CARDS).forEach((li) => expect(li).toHaveClass('glass-quiet'));
    // A card with a teaching lesson in a tier carries that tier and its edge.
    const tiered = document.querySelectorAll('li[data-tier]');
    expect(tiered.length).toBeGreaterThan(0);
    tiered.forEach((li) => expect(li).toHaveClass('tier-edge'));
  });
});

describe('landing hero', () => {
  const stats: HomeStats = { lessonCount: 112, labCount: 20, tierCount: 4 };

  it('lets the colour field show behind the hero: real glass on its card, quiet glass on its three highlights', () => {
    const { container } = render(<HeroSection {...stats} />);
    expect(container.querySelector('section')).not.toHaveClass('bg-background');
    expect(screen.getByTestId('home-hero-card')).toHaveClass('glass');
    const highlights = screen.getAllByRole('term').map((term) => term.parentElement!);
    expect(highlights).toHaveLength(3);
    highlights.forEach((card) => expect(card).toHaveClass('glass-quiet'));
    // The hero card is the page's one blurred card.
    expect(container.querySelectorAll('.glass')).toHaveLength(1);
    // The filled action is the Button's default variant, which carries the sheen.
    expect(screen.getByRole('link', { name: 'Find your level' })).toHaveClass('sheen-primary');
  });
});
