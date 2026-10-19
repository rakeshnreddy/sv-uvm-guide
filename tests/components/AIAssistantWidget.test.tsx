import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import AIAssistantWidget from '../../src/components/widgets/AIAssistantWidget';
import LearningLayout from '../../src/app/(learning)/layout';

const mocks = vi.hoisted(() => ({
  /** Stands for "the aiTutor flag and accounts are on" (SITE_FEATURES.aiTutor). */
  siteAiTutor: false,
  /** Stands for "and a learner is signed in" (useServerFeature('aiTutor')). */
  signedInAiTutor: false,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { displayName: 'Tester' } }),
}));

// The real switches (every flag off) unless a test turns the AI tutor on.
vi.mock('@/lib/site-features', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/site-features')>();
  return {
    ...actual,
    get SITE_FEATURES() {
      return { ...actual.SITE_FEATURES, aiTutor: mocks.siteAiTutor || actual.SITE_FEATURES.aiTutor };
    },
  };
});

vi.mock('@/lib/persistence/target', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/persistence/target')>();
  return {
    ...actual,
    useServerFeature: (feature: Parameters<typeof actual.useServerFeature>[0]) =>
      (feature === 'aiTutor' && mocks.signedInAiTutor) || actual.useServerFeature(feature),
  };
});

// The layout's other islands are not under test here.
vi.mock('@/components/providers/ClientProviders', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/layout/MainLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/components/layout/KeyboardShortcuts', () => ({
  default: () => null,
}));

describe('AIAssistantWidget', () => {
  beforeEach(() => {
    mocks.siteAiTutor = false;
    mocks.signedInAiTutor = false;
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ reply: 'ok' }) }) as any,
    ));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('by default (accounts and the AI tutor off)', () => {
    it('renders nothing and sends no request', () => {
      const { container } = render(<AIAssistantWidget />);

      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByRole('button', { name: /open ai assistant/i })).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('is not mounted by the (learning) layout', () => {
      render(
        <LearningLayout>
          <p>Lesson</p>
        </LearningLayout>,
      );

      expect(screen.getByText('Lesson')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /open ai assistant/i })).toBeNull();
    });

    it('stays hidden for a signed-out visitor even when the layout mounts it', () => {
      mocks.siteAiTutor = true;
      render(
        <LearningLayout>
          <p>Lesson</p>
        </LearningLayout>,
      );

      expect(screen.queryByRole('button', { name: /open ai assistant/i })).toBeNull();
    });

    it('keeps the button out of the gate module: it loads only as a lazy chunk', () => {
      const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      const gate = source('src/components/widgets/AIAssistantWidget.tsx');
      const layout = source('src/app/(learning)/layout.tsx');

      expect(gate).toMatch(/dynamic\(\(\) => import\("\.\/AIAssistantLauncher"\)/);
      expect(gate).not.toMatch(/^import .*AIAssistant(Launcher|Dialog)/m);
      expect(gate).not.toContain('lucide-react');
      expect(gate).not.toContain('Open AI assistant');
      expect(layout).not.toMatch(/^import .*AIAssistant(Launcher|Dialog)/m);
      expect(source('src/components/widgets/AIAssistantLauncher.tsx')).toContain('aria-label="Open AI assistant"');
    });
  });

  describe('with the AI tutor on and a learner signed in', () => {
    beforeEach(() => {
      mocks.siteAiTutor = true;
      mocks.signedInAiTutor = true;
    });

    it('is mounted by the (learning) layout, with the button loaded lazily', async () => {
      render(
        <LearningLayout>
          <p>Lesson</p>
        </LearningLayout>,
      );

      expect(
        await screen.findByRole('button', { name: /open ai assistant/i }, { timeout: 5_000 }),
      ).toBeInTheDocument();
    });

    it('includes page title, route, and selected text in request', async () => {
      document.title = 'Test Title';
      window.history.pushState({}, '', '/test-route');
      vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'selected text' } as any);
      (window.HTMLElement as any).prototype.scrollIntoView = vi.fn();

      render(<AIAssistantWidget />);

      const openButton = await screen.findByRole('button', { name: /open ai assistant/i }, { timeout: 5_000 });
      await userEvent.click(openButton);

      const textarea = await screen.findByRole(
        'textbox',
        { name: /message to ai tutor/i },
        { timeout: 5_000 },
      );
      await userEvent.type(textarea, 'Hello there');

      const sendButton = screen.getByRole('button', { name: /send message/i });
      await userEvent.click(sendButton);

      const fetchMock = fetch as unknown as Mock;
      expect(fetchMock).toHaveBeenCalled();
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.pageContext).toEqual({
        title: 'Test Title',
        route: '/test-route',
        selectedText: 'selected text',
      });
    });
  });
});
