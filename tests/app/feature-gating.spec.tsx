import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

type FeatureFlagName = 'community' | 'tracking' | 'personalization' | 'fakeComments' | 'accountUI';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

interface LoadRouteOptions {
  flags?: Partial<Record<FeatureFlagName, boolean>>;
  defaultValue?: boolean;
  notFoundImpl?: () => never;
}

async function loadRoute<T>(modulePath: string, options: LoadRouteOptions = {}) {
  const { flags = {}, defaultValue = false, notFoundImpl } = options;

  vi.resetModules();

  vi.doMock('@/tools/featureFlags', () => ({
    __esModule: true,
    isFeatureEnabled: (flag: FeatureFlagName) => {
      const override = flags[flag];
      if (override !== undefined) {
        return override;
      }
      return defaultValue;
    },
  }));

  if (notFoundImpl) {
    vi.doMock('next/navigation', () => ({
      __esModule: true,
      notFound: notFoundImpl,
    }));
  }

  return import(modulePath) as Promise<T>;
}

afterEach(() => {
  cleanup();
  const maybeUnmockAll = (vi as unknown as { unmockAll?: () => void }).unmockAll;
  maybeUnmockAll?.();
  vi.resetModules();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('feature-flag gated routes', () => {
  const notFoundRoutes: Array<{ name: string; module: string; flag: FeatureFlagName }> = [
    { name: 'dashboard', module: '@/app/dashboard/page', flag: 'tracking' },
    { name: 'community', module: '@/app/community/page', flag: 'community' },
    { name: 'settings', module: '@/app/settings/page', flag: 'accountUI' },
  ];

  notFoundRoutes.forEach(({ name, module, flag }) => {
    it(`${name} throws notFound when ${flag} flag is disabled`, async () => {
      const notFound = vi.fn(() => {
        throw new Error('notFound');
      });

      const pageModule = await loadRoute<{ default: () => Promise<unknown> | unknown }>(module, {
        flags: { [flag]: false },
        defaultValue: true,
        notFoundImpl: notFound,
      });

      await expect(pageModule.default()).rejects.toThrow('notFound');
      expect(notFound).toHaveBeenCalledOnce();
    });

    it(`${name} renders content when ${flag} flag is enabled`, async () => {
      const notFound = vi.fn(() => {
        throw new Error('notFound');
      });

      const pageModule = await loadRoute<{ default: () => Promise<React.ReactElement> }>(module, {
        flags: { [flag]: true },
        defaultValue: false,
        notFoundImpl: notFound,
      });

      const element = await pageModule.default();

      expect(element).toBeDefined();
      expect(notFound).not.toHaveBeenCalled();
    });
  });

  it('projects page returns placeholder content when personalization flag is disabled', async () => {
    const pageModule = await loadRoute<{ default: () => Promise<React.ReactElement> }>(
      '@/app/projects/page',
      {
        defaultValue: false,
      },
    );

    const element = await pageModule.default();
    render(element);

    expect(
      screen.getByText(/Project workspaces will re-open once personalization features are prioritized./i),
    ).toBeInTheDocument();
  });

  it('notifications page shows placeholder when account UI flag is disabled', async () => {
    const pageModule = await loadRoute<{ default: () => Promise<React.ReactElement> }>(
      '@/app/notifications/page',
      {
        defaultValue: false,
      },
    );

    const element = await pageModule.default();
    render(element);

    expect(
      screen.getByText(/Notifications will launch once account preferences are wired up./i),
    ).toBeInTheDocument();
  });

  it('notifications page renders full feed when account UI flag is enabled', async () => {
    const pageModule = await loadRoute<{ default: () => Promise<React.ReactElement> }>(
      '@/app/notifications/page',
      {
        defaultValue: false,
        flags: { accountUI: true },
      },
    );

    const element = await pageModule.default();
    render(element);

    expect(screen.getByText(/Nice work finishing UVM Basics/i)).toBeInTheDocument();
    expect(screen.queryByText(/Notifications will launch once account preferences are wired up./i)).not.toBeInTheDocument();
  });
});
