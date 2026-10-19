#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

function runPlaywrightCommand(args, { allowFailure = false, description } = {}) {
  const label = description ?? `playwright ${args.join(' ')}`;
  const result = spawnSync('npx', ['playwright', ...args], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    const message = `Failed to ${label}`;
    if (allowFailure) {
      console.warn(
        `\n[playwright-setup] ${message}. This step can require elevated permissions or additional system packages.\n` +
          '[playwright-setup] Refer to the README troubleshooting guide for the list of required libraries.\n'
      );
    } else {
      console.error(`\n[playwright-setup] ${message}.`);
      process.exit(result.status ?? 1);
    }
  } else {
    console.log(`[playwright-setup] Successfully ran ${label}.`);
  }
}

const truthy = (value) => /^(1|true|yes|on)$/i.test(String(value ?? '').trim());

// Deploy builds never run browsers: Cloudflare Workers Builds sets WORKERS_CI,
// Pages sets CF_PAGES. Installing there needs root and fails the build
// ("su: Authentication failure"), so skip the whole step. Also honour
// Playwright's own PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD switch.
const skipReason = truthy(process.env.WORKERS_CI)
  ? 'Cloudflare Workers Builds (WORKERS_CI)'
  : truthy(process.env.CF_PAGES)
    ? 'Cloudflare Pages (CF_PAGES)'
    : truthy(process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD)
      ? 'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'
      : null;

if (skipReason) {
  console.log(`[playwright-setup] Skipping Playwright browser install: ${skipReason}.`);
  process.exit(0);
}

const shouldInstallDeps =
  process.env.PLAYWRIGHT_SKIP_INSTALL_DEPS !== 'true' && process.platform === 'linux';

if (shouldInstallDeps) {
  runPlaywrightCommand(['install-deps'], {
    allowFailure: true,
    description: 'install system dependencies',
  });
} else {
  console.log('[playwright-setup] Skipping Playwright system dependency install.');
}

runPlaywrightCommand(['install'], { description: 'install browser binaries' });
