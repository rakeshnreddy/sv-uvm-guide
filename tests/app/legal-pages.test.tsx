import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PrivacyPolicyPage from '@/app/(public)/privacy-policy/page';
import TermsOfServicePage from '@/app/(public)/terms-of-service/page';

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
  ['Privacy Policy', PrivacyPolicyPage],
  ['Terms of Service', TermsOfServicePage],
])('%s page (G30-SIDE-V06)', (title, Page) => {
  it('links back to the site from its header', () => {
    render(<Page />);
    // The page frame's header comes first; InfoPage adds its own header inside the article.
    const header = screen.getAllByRole('banner')[0];
    expect(within(header).getByRole('link', { name: 'Back to the curriculum' })).toHaveAttribute('href', '/curriculum');
    expect(within(header).getByRole('link', { name: 'SV/UVM Hub home' })).toHaveAttribute('href', '/');
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
    expect(within(siteMap).getByRole('link', { name: 'Curriculum overview' })).toHaveAttribute('href', '/curriculum');
    expect(within(siteMap).getByRole('link', { name: 'Practice hub' })).toHaveAttribute('href', '/practice');
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

describe('Privacy Policy content', () => {
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
