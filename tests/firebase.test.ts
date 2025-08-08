import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { initSpy } = vi.hoisted(() => {
  return { initSpy: vi.fn() };
});

vi.mock('firebase/app', () => ({
  initializeApp: initSpy,
  getApps: () => [],
  getApp: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({})) }));

const setEnv = () => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'test-sender';
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'test-app-id';
};

const clearEnv = () => {
  delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  delete process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  delete process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  delete process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
};

describe('firebase initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    initSpy.mockReset();
  });

  afterEach(() => {
    clearEnv();
  });

  it('initializes Firebase with environment config', async () => {
    setEnv();
    const mod = await import('@/lib/firebase');

    expect(initSpy).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test-project',
      storageBucket: 'test.appspot.com',
      messagingSenderId: 'test-sender',
      appId: 'test-app-id'
    });
    expect(mod.db).toBeDefined();
    expect(mod.auth).toBeDefined();
  });

  it('falls back to mock config when env vars missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await import('@/lib/firebase');

    expect(initSpy).toHaveBeenCalledWith({
      apiKey: 'MOCK_API_KEY',
      authDomain: 'mock-project-id.firebaseapp.com',
      projectId: 'mock-project-id',
      storageBucket: 'mock-project-id.appspot.com',
      messagingSenderId: 'MOCK_MESSAGING_SENDER_ID',
      appId: 'MOCK_APP_ID',
      measurementId: 'MOCK_MEASUREMENT_ID'
    });
    expect(mod.db).toBeDefined();
    expect(mod.auth).toBeDefined();
    warnSpy.mockRestore();
  });
});
