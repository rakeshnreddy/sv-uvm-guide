// @vitest-environment node
import { createRequire } from 'node:module';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

/*
 * The client-import guard in .eslintrc.json (GD10): a 'use client' module, and
 * any file under src/components or src/hooks (client modules can import those),
 * must not import src/server/**, @/lib/auth, @/lib/prisma, @/lib/lab-assets,
 * @/lib/flashcard-decks or @/generated/lab-registry. Type-only imports are
 * erased at build time, so they are allowed.
 *
 * Each case lints a snippet with the repo's own config, as if it lived at
 * `filePath`; the file does not need to exist.
 */

interface LintMessage {
  ruleId: string | null;
  message: string;
  fatal?: boolean;
}
interface LintResult {
  messages: LintMessage[];
}
interface ESLintInstance {
  lintText(code: string, options: { filePath: string }): Promise<LintResult[]>;
}
type ESLintConstructor = new (options: { cwd: string; useEslintrc: boolean }) => ESLintInstance;

// ESLint 8 ships no type declarations, so it is loaded through require with the narrow shape above.
const requireCjs = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '..');

let eslint: ESLintInstance;

beforeAll(() => {
  const { ESLint } = requireCjs('eslint') as { ESLint: ESLintConstructor };
  eslint = new ESLint({ cwd: ROOT, useEslintrc: true });
});

/** The guard's messages for `code` linted as `filePath`; parse errors fail the test. */
async function guardMessages(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, filePath) });
  const fatal = result.messages.find((message) => message.fatal);
  if (fatal) throw new Error(`Could not lint ${filePath}: ${fatal.message}`);
  return result.messages.filter((message) => message.ruleId === 'no-restricted-syntax').map((message) => message.message);
}

const CLIENT = '"use client";\n';
const SERVER_ONLY = [
  '@/server/persistence-gate',
  '@/server/simulation/types',
  '@/lib/auth',
  '@/lib/prisma',
  '@/lib/lab-assets',
  '@/lib/flashcard-decks',
  '@/generated/lab-registry',
];

describe("client-import guard: 'use client' modules", () => {
  it.each(SERVER_ONLY)('rejects a value import of %s', async (source) => {
    const messages = await guardMessages('src/lib/guard-example.tsx', `${CLIENT}import { thing } from "${source}";\nexport default thing;\n`);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/^Server-only code in a 'use client' module \(GD10\)/);
  });

  it('rejects side-effect imports, re-exports and dynamic imports, with single quotes too', async () => {
    const code = [
      "'use client';",
      "import '@/server/persistence-gate';",
      "export { getDeckCards } from '@/lib/flashcard-decks';",
      "export * from '@/generated/lab-registry';",
      "export async function load() { return import('@/lib/lab-assets'); }",
      '',
    ].join('\n');
    expect(await guardMessages('src/app/(learning)/example/ExampleClient.tsx', code)).toHaveLength(4);
  });

  it('rejects relative and src/ paths to the same modules', async () => {
    const code = [
      CLIENT,
      'import { a } from "../auth";',
      'import { b } from "../../server/labs";',
      'import { c } from "../generated/lab-registry";',
      'import { d } from "src/lib/prisma";',
      'export const all = [a, b, c, d];',
      '',
    ].join('\n');
    expect(await guardMessages('src/lib/persistence/guard-example.ts', code)).toHaveLength(4);
  });

  it('allows type-only imports and client-safe neighbours', async () => {
    const code = [
      CLIENT,
      'import type { SimulatorBackend } from "@/server/simulation/types";',
      'export type { Session } from "@/lib/auth";',
      'import { LAB_PROGRESS_NOTE } from "@/lib/lab-registry";',
      'import { SITE_FEATURES } from "@/lib/site-features";',
      'import { useAuth } from "@/contexts/AuthContext";',
      'import "server-only";',
      'export const backend: SimulatorBackend = "icarus";',
      'export const all = [LAB_PROGRESS_NOTE, SITE_FEATURES, useAuth];',
      '',
    ].join('\n');
    expect(await guardMessages('src/lib/guard-example.tsx', code)).toEqual([]);
  });

  it('leaves server modules outside src/components and src/hooks alone', async () => {
    const code = 'import { getDeckCards } from "@/lib/flashcard-decks";\nimport { prisma } from "@/lib/prisma";\nexport const all = [getDeckCards, prisma];\n';
    expect(await guardMessages('src/app/(learning)/example/page.tsx', code)).toEqual([]);
    expect(await guardMessages('src/lib/guard-example.ts', code)).toEqual([]);
  });

  it("ignores a 'use client' string that is not the file's directive", async () => {
    const code = 'import { prisma } from "@/lib/prisma";\n"use client";\nexport default prisma;\n';
    expect(await guardMessages('src/lib/guard-example.ts', code)).toEqual([]);
  });
});

describe('client-import guard: src/components and src/hooks', () => {
  it.each([
    ['src/components/example/ServerExample.tsx', 'import { getDeckCards } from "@/lib/flashcard-decks";\nexport default getDeckCards;\n'],
    ['src/components/example/ClientExample.tsx', `${CLIENT}import { authOptions } from "@/lib/auth";\nexport default authOptions;\n`],
    ['src/hooks/useGuardExample.ts', 'export const load = () => import("@/server/labs");\n'],
    ['src/hooks/useGuardExample.ts', 'export { GENERATED_LAB_MANIFESTS } from "@/generated/lab-registry";\n'],
  ])('rejects %s even without a directive', async (filePath, code) => {
    const messages = await guardMessages(filePath, code);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/^Server-only code under src\/components or src\/hooks \(GD10\)/);
  });

  it('allows type-only imports there', async () => {
    const code = 'import type { SimulatorBackend } from "@/server/simulation/types";\nexport const backend: SimulatorBackend = "icarus";\n';
    expect(await guardMessages('src/components/example/Typed.tsx', code)).toEqual([]);
  });

  it('does not apply to tests kept next to components', async () => {
    const code = 'import { authOptions } from "@/lib/auth";\nexport default authOptions;\n';
    expect(await guardMessages('src/components/example/__tests__/Example.test.tsx', code)).toEqual([]);
  });
});

describe('next-auth/react guard (GD7) still holds', () => {
  it('rejects next-auth/react in a component and allows it in SessionProvider', async () => {
    const code = 'import { useSession } from "next-auth/react";\nexport default useSession;\n';
    const [component] = await eslint.lintText(code, { filePath: path.join(ROOT, 'src/components/example/Session.tsx') });
    expect(component.messages.map((message) => message.ruleId)).toContain('no-restricted-imports');
    const [provider] = await eslint.lintText(code, { filePath: path.join(ROOT, 'src/components/providers/SessionProvider.tsx') });
    expect(provider.messages.map((message) => message.ruleId)).not.toContain('no-restricted-imports');
  });
});
