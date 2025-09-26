#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const featureFlagEnv = {
  NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY: 'true',
  NEXT_PUBLIC_FEATURE_FLAG_TRACKING: 'true',
  NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION: 'true',
  NEXT_PUBLIC_FEATURE_FLAG_FAKE_COMMENTS: 'true',
  NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI: 'true',
  FEATURE_FLAGS_FORCE_ON: 'true',
};

const buildEnv = {
  ...process.env,
  ...featureFlagEnv,
};

let result = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  env: buildEnv,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const testEnv = {
  ...buildEnv,
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'dummy_secret_for_testing_purposes',
};

result = spawnSync('npx', ['playwright', 'test'], {
  stdio: 'inherit',
  env: testEnv,
});

process.exit(result.status ?? 0);
