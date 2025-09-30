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
      console.warn(`\n[playwright-setup] ${message}. This step can require elevated permissions.\n`);
    } else {
      console.error(`\n[playwright-setup] ${message}.`);
      process.exit(result.status ?? 1);
    }
  }
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
