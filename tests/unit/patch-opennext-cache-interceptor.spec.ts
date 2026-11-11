// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  PatchSourceError,
  isPatched,
  patchSource,
} from '../../scripts/patch-opennext-cache-interceptor.mjs';

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve(__dirname, '../../scripts/patch-opennext-cache-interceptor.mjs');

// Trimmed copy of the relevant lines of @opennextjs/aws 3.9.12
// dist/core/routing/cacheInterceptor.js.
const UPSTREAM_FIXTURE = [
  '    localizedPath = localizedPath.replace(/\\/$/, "");',
  '    localizedPath = decodePathParams(localizedPath);',
  '    const isISR = Object.keys(PrerenderManifest?.routes ?? {}).includes(localizedPath ?? "/") ||',
  '        Object.values(PrerenderManifest?.dynamicRoutes ?? {}).some((dr) => new RegExp(dr.routeRegex).test(localizedPath));',
  '    if (isISR) {',
  '        const cachedData = await globalThis.incrementalCache.get(localizedPath ?? "/index");',
  '    }',
].join('\n');

describe('patchSource', () => {
  it('rewrites both fallbacks so an empty path means "/" and "/index"', () => {
    const { code, changed, applied } = patchSource(UPSTREAM_FIXTURE);
    expect(changed).toBe(true);
    expect(applied).toHaveLength(2);
    expect(code).toContain('.includes(localizedPath || "/")');
    expect(code).toContain('incrementalCache.get(localizedPath || "/index")');
    expect(code).not.toContain('localizedPath ?? "/');
    expect(isPatched(code)).toBe(true);
    expect(isPatched(UPSTREAM_FIXTURE)).toBe(false);
  });

  it('is a no-op on already patched source', () => {
    const once = patchSource(UPSTREAM_FIXTURE).code;
    const twice = patchSource(once);
    expect(twice.changed).toBe(false);
    expect(twice.applied).toEqual([]);
    expect(twice.code).toBe(once);
  });

  it('completes a half-patched source', () => {
    const half = UPSTREAM_FIXTURE.replace('localizedPath ?? "/")', 'localizedPath || "/")');
    const { code, applied } = patchSource(half);
    expect(applied).toEqual(['incremental-cache key']);
    expect(isPatched(code)).toBe(true);
  });

  it('fails loudly on unknown source', () => {
    const changedUpstream = UPSTREAM_FIXTURE.replace('localizedPath ?? "/index"', 'cacheKey');
    expect(() => patchSource(changedUpstream)).toThrow(PatchSourceError);
    expect(() => patchSource(changedUpstream)).toThrow(/source changed/);
    expect(() => patchSource('export const nothing = 1;')).toThrow(PatchSourceError);
  });

  it('fails on ambiguous source with the expression twice', () => {
    expect(() => patchSource(`${UPSTREAM_FIXTURE}\n${UPSTREAM_FIXTURE}`)).toThrow(PatchSourceError);
  });
});

describe('patch script CLI', () => {
  let dir: string;
  let target: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'patch-opennext-'));
    const pkgDir = path.join(dir, 'node_modules/@opennextjs/aws');
    mkdirSync(path.join(pkgDir, 'dist/core/routing'), { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), '{"name":"fixture"}');
    writeFileSync(path.join(pkgDir, 'package.json'), '{"name":"@opennextjs/aws","version":"3.9.12"}');
    target = path.join(pkgDir, 'dist/core/routing/cacheInterceptor.js');
    writeFileSync(target, UPSTREAM_FIXTURE);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // The suite runs with NODE_OPTIONS='--require @prisma/client', which a child in a temp directory cannot resolve.
  const childEnv = { ...process.env };
  delete childEnv.NODE_OPTIONS;
  const run = (args: string[] = []) => execFileAsync('node', [scriptPath, ...args], { cwd: dir, env: childEnv });

  it('--check fails before patching, apply patches, then --check passes and re-apply is a no-op', async () => {
    await expect(run(['--check'])).rejects.toMatchObject({
      stderr: expect.stringContaining('is not patched'),
    });

    const first = await run();
    expect(first.stdout).toContain('patched');
    expect(isPatched(readFileSync(target, 'utf8'))).toBe(true);

    const second = await run();
    expect(second.stdout).toContain('already patched');

    const check = await run(['--check']);
    expect(check.stdout).toContain('OK');
  });

  it('--check-output accepts only a built middleware bundle that carries the patch', async () => {
    await expect(run(['--check-output'])).rejects.toMatchObject({
      stderr: expect.stringContaining('not found'),
    });
    const bundleDir = path.join(dir, '.open-next/middleware');
    mkdirSync(bundleDir, { recursive: true });
    const bundle = path.join(bundleDir, 'handler.mjs');
    writeFileSync(bundle, UPSTREAM_FIXTURE);
    await expect(run(['--check-output'])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('does not contain the cache interception patch'),
    });
    writeFileSync(bundle, patchSource(UPSTREAM_FIXTURE).code);
    const ok = await run(['--check-output']);
    expect(ok.stdout).toContain('contains the patch');
  });

  it('exits non-zero with a clear message when the source text is unknown', async () => {
    writeFileSync(target, 'export async function cacheInterceptor() {}');
    await expect(run()).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('source changed'),
    });
    await expect(run(['--check'])).rejects.toMatchObject({ code: 1 });
  });
});
