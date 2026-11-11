import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PublicHeader, { PUBLIC_CONTAINER } from '@/components/layout/PublicHeader';
import { SITE_NAME } from '@/lib/site-links';
import PrivacyPolicyPage from '@/app/(public)/privacy-policy/page';
import TermsOfServicePage from '@/app/(public)/terms-of-service/page';

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', systemTheme: 'light', setTheme: vi.fn() }),
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/privacy-policy' }));

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

afterEach(() => {
  cleanup();
});

describe.each([
  ['Privacy policy', PrivacyPolicyPage],
  ['Terms of service', TermsOfServicePage],
])('%s page (G30-SIDE-V06)', (title, Page) => {
  it('links back to the site from the public header, and adds no site header of its own', () => {
    // The (public) layout renders PublicHeader above the page.
    render(
      <>
        <PublicHeader />
        <Page />
      </>,
    );
    const header = screen.getByTestId('public-header');
    expect(within(header).getByRole('link', { name: 'Curriculum' })).toHaveAttribute('href', '/curriculum');
    expect(within(header).getByRole('link', { name: 'SV/UVM Hub home' })).toHaveAttribute('href', '/');
    // The page itself carries no wordmark link; only the layout's header does.
    expect(screen.getAllByRole('link', { name: 'SV/UVM Hub home' })).toHaveLength(1);
  });

  it('fills the viewport below the 56 or 64 px public header, not a full screen more', () => {
    const { container } = render(<Page />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame).toHaveClass('min-h-[calc(100vh-3.5rem)]', 'sm:min-h-[calc(100vh-4rem)]');
    expect(frame).not.toHaveClass('min-h-screen');
  });

  it('keeps its content in one main landmark under its own heading', () => {
    render(<Page />);
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('ends with the site footer and its site map', () => {
    render(<Page />);
    const footer = screen.getByRole('contentinfo');
    const siteMap = within(footer).getByRole('navigation', { name: 'Site map' });
    expect(within(siteMap).getByRole('link', { name: 'Curriculum' })).toHaveAttribute('href', '/curriculum');
    expect(within(siteMap).getByRole('link', { name: 'Practice hub' })).toHaveAttribute('href', '/practice');
    expect(within(footer).getByRole('link', { name: title })).toBeInTheDocument();
    expect(footer).toHaveTextContent('MIT licensed');
    expect(within(footer).getByRole('link', { name: 'Source on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/rakeshnreddy/sv-uvm-guide',
    );
    // The shortcuts dialog lives in the learning layout, so this page does not offer it.
    expect(within(footer).queryByRole('button', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });

  it('describes browser storage and points to the data controls in Settings', () => {
    render(<Page />);
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent(/local storage/i);
    expect(main).toHaveTextContent(/no account/i);
    const settingsLinks = within(main).getAllByRole('link', { name: 'Settings' });
    expect(settingsLinks.length).toBeGreaterThan(0);
    settingsLinks.forEach((link) => expect(link).toHaveAttribute('href', '/settings#data'));
    // Clearing site data, or a browser evicting it, deletes learner data: the page says so and suggests a backup.
    expect(main).toHaveTextContent(/clear(ing)? (this )?site(.s)? data/i);
    expect(main).toHaveTextContent(/backup/i);
    expect(within(main).getByText(/Last updated: October 2026/)).toBeInTheDocument();
  });

  it('no longer promises sign-in, account deletion, uptime or a community channel', () => {
    render(<Page />);
    const text = screen.getByRole('main').textContent ?? '';
    expect(text).not.toMatch(/single[- ]sign[- ]on/i);
    expect(text).not.toMatch(/session cookies/i);
    expect(text).not.toMatch(/keep you signed in/i);
    expect(text).not.toMatch(/delete your account|request deletion|purged|deactivate/i);
    expect(text).not.toMatch(/99\.5%|uptime;/i);
    expect(text).not.toMatch(/community channel/i);
    expect(text).not.toMatch(/verified partners/i);
    expect(text).not.toMatch(/telemetry is retained/i);
  });
});

describe('legal page metadata', () => {
  it('uses the shared labels and never types the site name by hand', async () => {
    const privacy = await import('@/app/(public)/privacy-policy/page');
    const terms = await import('@/app/(public)/terms-of-service/page');
    expect(privacy.metadata.title).toBe('Privacy policy');
    expect(terms.metadata.title).toBe('Terms of service');
    expect(privacy.metadata.description).toContain(SITE_NAME);
    expect(terms.metadata.description).toContain(SITE_NAME);
  });

  it('starts the page content on the same left edge as the header wordmark', () => {
    const { container } = render(<PrivacyPolicyPage />);
    const frame = container.querySelector('[data-testid="info-page"]') as HTMLElement;
    for (const cls of PUBLIC_CONTAINER.split(' ')) expect(frame).toHaveClass(cls);
  });
});

describe('Privacy policy content', () => {
  it('says what stays in this browser, that nothing is sent, and keeps the contact address', () => {
    render(<PrivacyPolicyPage />);
    const main = screen.getByRole('main');
    for (const item of [
      /lesson progress/i,
      /the lessons you opened and the days you studied/i,
      /flashcard reviews/i,
      /teach-it-back/i,
      /lab code/i,
      /quiz/i,
    ]) {
      expect(main).toHaveTextContent(item);
    }
    expect(main).toHaveTextContent(/never sent to the site/i);
    expect(main).toHaveTextContent(/theme preference is stored locally/i);
    expect(main).toHaveTextContent(/no cookies for signing in/i);
    expect(main).toHaveTextContent(/no AI service and no community forum are active/i);
    expect(within(main).getByRole('link', { name: 'privacy@sv-uvm-guide.dev' })).toHaveAttribute(
      'href',
      'mailto:privacy@sv-uvm-guide.dev',
    );
  });
});
