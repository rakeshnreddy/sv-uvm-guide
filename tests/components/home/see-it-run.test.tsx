import React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InViewMount } from '@/components/home/InViewMount';
import { HERO_SCENARIO_ID, LIVE_MODEL_HREF, buildSchedulerFrameAt } from '@/components/home/scheduler-frame';
import SeeItRunSection, { SEE_IT_RUN_TITLE, seeItRunInstruction } from '@/components/home/SeeItRunSection';
import { SEE_IT_RUN_SLOT_CLASS, SEE_IT_RUN_SLOT_HEIGHTS } from '@/components/home/SeeItRunLive';
import { appRouteExists } from '../../fixtures/site-routes';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');
  type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };
  const MockLink = ReactModule.forwardRef<HTMLAnchorElement, LinkProps>(({ href, children, prefetch: _prefetch, ...rest }, ref) => (
    <a ref={ref} href={href} {...rest}>
      {children}
    </a>
  ));
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

// Stands in for the visualizer's chunk; the import only resolves when the slot mounts it.
const loaded = vi.fn();
vi.mock('@/components/visuals/TimeSlotTraceVisualizer', () => {
  loaded();
  return {
    __esModule: true,
    default: ({ scenario, scenarios, controlsPlacement }: { scenario: string; scenarios: string[]; controlsPlacement?: string }) => (
      <section aria-label="Time slot trace" data-scenario={scenario} data-scenarios={scenarios.join(',')} data-controls={controlsPlacement} />
    ),
  };
});

/** An IntersectionObserver the test drives: `intersect()` reports every observed element in view. */
class FakeObserver {
  static instances: FakeObserver[] = [];
  elements: Element[] = [];
  options: IntersectionObserverInit | undefined;
  constructor(
    private callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.options = options;
    FakeObserver.instances.push(this);
  }
  observe(element: Element) {
    this.elements.push(element);
  }
  unobserve() {}
  disconnect() {
    this.elements = [];
  }
  takeRecords() {
    return [];
  }
  intersect() {
    this.callback(
      this.elements.map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver,
    );
  }
}

const frame = buildSchedulerFrameAt(HERO_SCENARIO_ID, 0);
const lesson = { code: 'F3C', title: 'Delta Cycles and Race Conditions', href: LIVE_MODEL_HREF };

beforeEach(() => {
  FakeObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('"See it run"', () => {
  it('has a plain heading, one line of instruction with the model\'s step count, and a link to the lesson that teaches it', () => {
    render(<SeeItRunSection scenario={HERO_SCENARIO_ID} frame={frame} lesson={lesson} />);
    const section = screen.getByRole('region', { name: SEE_IT_RUN_TITLE });
    expect(within(section).getByRole('heading', { level: 2, name: 'See it run' })).toBeInTheDocument();
    expect(section).toHaveTextContent(seeItRunInstruction(frame.stepCount));
    expect(seeItRunInstruction(frame.stepCount)).toContain(`${frame.stepCount} scheduler steps`);
    const link = screen.getByTestId('see-it-run-lesson');
    expect(link).toHaveAttribute('href', LIVE_MODEL_HREF);
    expect(link).toHaveTextContent(lesson.title);
    expect(appRouteExists(LIVE_MODEL_HREF)).toBe(true);
    // The "Taught in" line wraps and is capped at the viewport less its gutters, so 320 px never scrolls sideways.
    expect(link.parentElement).toHaveClass('flex-wrap', 'max-w-[calc(100vw-2rem)]');
    expect(link).toHaveClass('min-w-0');
  });

  it('server-renders the opening frame and the lesson link in the slot, never the visualizer', () => {
    const html = renderToStaticMarkup(<SeeItRunSection scenario={HERO_SCENARIO_ID} frame={frame} lesson={lesson} />);
    expect(html).toContain('data-testid="see-it-run-fallback"');
    expect(html).toContain('data-state="waiting"');
    expect(html).toContain(`step 1 of ${frame.stepCount}:`);
    expect(html).toContain(`href="${LIVE_MODEL_HREF}"`);
    expect(html).not.toContain('Time slot trace');
  });

  it('mounts the visualizer on the hero\'s scenario only once the slot is in view, and keeps the slot\'s reserved height', async () => {
    loaded.mockClear();
    render(<SeeItRunSection scenario={HERO_SCENARIO_ID} frame={frame} lesson={lesson} />);
    const slot = screen.getByTestId('see-it-run-slot');
    expect(slot).toHaveAttribute('data-state', 'waiting');
    expect(screen.getByTestId('see-it-run-fallback')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Time slot trace' })).not.toBeInTheDocument();
    expect(loaded).not.toHaveBeenCalled();

    await act(async () => {
      FakeObserver.instances.forEach((observer) => observer.intersect());
    });
    const live = await screen.findByRole('region', { name: 'Time slot trace' });
    expect(slot).toHaveAttribute('data-state', 'mounted');
    expect(live).toHaveAttribute('data-scenario', HERO_SCENARIO_ID);
    expect(live).toHaveAttribute('data-scenarios', HERO_SCENARIO_ID);
    // "Press Play or use the step arrows": the controls sit at the top of the model, in view with the heading.
    expect(live).toHaveAttribute('data-controls', 'top');
    expect(loaded).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('see-it-run-fallback')).not.toBeInTheDocument();
    // The same box before and after: the reservation is on the slot, not on what is in it.
    expect(slot.className).toContain('[@media(scripting:enabled)]:min-h-[var(--slot-h)]');
  });

  it('reserves the measured heights, only where scripts run', () => {
    const { base, sm, two, lg } = SEE_IT_RUN_SLOT_HEIGHTS;
    expect(SEE_IT_RUN_SLOT_CLASS).toBe(
      `[--slot-h:${base}px] sm:[--slot-h:${sm}px] min-[820px]:[--slot-h:${two}px] lg:[--slot-h:${lg}px] [@media(scripting:enabled)]:min-h-[var(--slot-h)]`,
    );
    expect(base).toBeGreaterThan(sm);
    expect(sm).toBeGreaterThan(two);
  });
});

describe('InViewMount', () => {
  it('shows the fallback until the slot is in view, then the children, and stops observing', async () => {
    render(
      <InViewMount fallback={<p>Frame</p>} rootMargin="0px 0px 160px 0px" data-testid="slot">
        <p>Live</p>
      </InViewMount>,
    );
    expect(screen.getByText('Frame')).toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
    const [observer] = FakeObserver.instances;
    expect(observer.options?.rootMargin).toBe('0px 0px 160px 0px');
    await act(async () => observer.intersect());
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByText('Frame')).not.toBeInTheDocument();
    expect(observer.elements).toEqual([]);
  });

  it('mounts straight away where the browser has no IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(
      <InViewMount fallback={<p>Frame</p>}>
        <p>Live</p>
      </InViewMount>,
    );
    expect(await screen.findByText('Live')).toBeInTheDocument();
  });
});
