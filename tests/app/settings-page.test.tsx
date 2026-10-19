import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsPage, * as settingsPageModule from '@/app/(learning)/settings/page';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { __resetStorageForTests } from '@/lib/learner-store/storage';

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('notFound() must not be called');
  }),
  requireSession: vi.fn(),
}));

// Every flag off, as on the deployed site (isFeatureEnabled and featureFlags agree).
vi.mock('@/tools/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/tools/featureFlags')>();
  const off = Object.fromEntries(Object.keys(actual.featureFlags).map((flag) => [flag, false]));
  return { ...actual, featureFlags: Object.freeze(off), isFeatureEnabled: () => false };
});

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/settings',
}));

vi.mock('@/lib/auth', () => ({
  requireSession: mocks.requireSession,
}));

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const PAGE_SOURCE = path.resolve(__dirname, '../../src/app/(learning)/settings/page.tsx');
const originalFetch = global.fetch;

beforeEach(() => {
  window.localStorage.clear();
  __resetStorageForTests();
  __resetRecordsForTests();
  mocks.notFound.mockClear();
  mocks.requireSession.mockClear();
  global.fetch = vi.fn(() => Promise.reject(new Error('/settings must not call the network'))) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('/settings page module', () => {
  it('renders with every flag off, without notFound, a session or a request', async () => {
    render(<SettingsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Your learning data' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Download a backup (JSON)' })).toBeInTheDocument();
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.requireSession).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('takes no props and is titled Settings', () => {
    expect(SettingsPage.length).toBe(0);
    expect(settingsPageModule.metadata.title).toBe('Settings');
    expect(settingsPageModule.dynamic).not.toBe('force-dynamic');
  });

  it('server-renders the static shell without reading storage', () => {
    window.localStorage.setItem('curriculumProgress', JSON.stringify({ F1A: { completedLessons: ['index'] } }));
    const getItem = vi.spyOn(window.localStorage, 'getItem');

    const html = renderToStaticMarkup(<SettingsPage />);

    expect(html).toContain('Your learning data');
    expect(html).toContain('id="data"');
    expect(html).toContain('Stored only in this browser');
    expect(getItem).not.toHaveBeenCalled();
  });

  it('has no notFound, session, database, force-dynamic or feature-flag code in its source', () => {
    const source = fs.readFileSync(PAGE_SOURCE, 'utf8');
    expect(source).not.toMatch(/prisma/i);
    expect(source).not.toMatch(/force-dynamic/);
    expect(source).not.toMatch(/isFeatureEnabled|featureFlags/);
    expect(source).not.toMatch(/notFound|requireSession|@\/lib\/auth/);
    expect(source).toMatch(/<SettingsPageClient \/>/);
  });
});

// ensure components using the legacy JSX runtime can resolve React
(globalThis as typeof globalThis & { React?: typeof React }).React = React;
