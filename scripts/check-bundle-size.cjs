#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const baselinePath = path.resolve(repoRoot, process.env.BUNDLE_BASELINE_PATH ?? 'docs/bundle-baseline.json');
const statsPath = path.resolve(repoRoot, process.env.BUNDLE_ANALYZER_REPORT ?? '.next/analyze/client.json');

const args = process.argv.slice(2);
const updateBaseline = args.includes('--update');

if (!fs.existsSync(statsPath)) {
  console.error(
    `Bundle stats not found at ${statsPath}. Run with ANALYZE=true npm run build before invoking this script.`,
  );
  process.exit(1);
}

const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));

const computeTotals = () => {
  const initialChunks = stats.filter((item) =>
    Object.values(item.isInitialByEntrypoint ?? {}).some(Boolean),
  );

  const initialClientGzipBytes = initialChunks.reduce((sum, item) => sum + item.gzipSize, 0);
  return { initialClientGzipBytes };
};

const computeEntrypointSize = (entrypoint) =>
  stats
    .filter((item) => item.isInitialByEntrypoint && item.isInitialByEntrypoint[entrypoint])
    .reduce((sum, item) => sum + item.gzipSize, 0);

if (updateBaseline) {
  const existing = fs.existsSync(baselinePath)
    ? JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
    : { entrypointBudgets: {}, tolerance: { percent: 5, absoluteBytes: 51200 } };

  const entrypointBudgets = existing.entrypointBudgets ?? {};
  const entrypoints = Object.keys(entrypointBudgets);
  if (entrypoints.length === 0) {
    console.error(
      'No entrypoint budgets defined in the baseline. Seed docs/bundle-baseline.json before using --update.',
    );
    process.exit(1);
  }

  const updatedEntrypoints = Object.fromEntries(
    entrypoints.map((entrypoint) => {
      const baselineEntry = entrypointBudgets[entrypoint] ?? {};
      return [
        entrypoint,
        {
          ...baselineEntry,
          gzipBytes: computeEntrypointSize(entrypoint),
        },
      ];
    }),
  );

  const updatedBaseline = {
    ...existing,
    generatedAt: new Date().toISOString(),
    totals: computeTotals(),
    entrypointBudgets: updatedEntrypoints,
  };

  fs.writeFileSync(baselinePath, `${JSON.stringify(updatedBaseline, null, 2)}\n`);
  console.log(`Updated bundle baseline written to ${baselinePath}`);
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error(`Missing baseline at ${baselinePath}. Run with --update to generate it.`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const totals = computeTotals();

const toleranceDefaults = baseline.tolerance ?? {};
const getAllowance = (baselineBytes, overrides = {}) => {
  const percent = overrides.percent ?? toleranceDefaults.percent ?? 0;
  const absolute = overrides.absoluteBytes ?? toleranceDefaults.absoluteBytes ?? 0;
  const percentAllowance = Math.ceil((baselineBytes * percent) / 100);
  return baselineBytes + Math.max(absolute, percentAllowance);
};

const violations = [];

if (baseline.totals?.initialClientGzipBytes != null) {
  const allowed = getAllowance(baseline.totals.initialClientGzipBytes, baseline.totals);
  if (totals.initialClientGzipBytes > allowed) {
    violations.push(
      `Total initial client bundle (${totals.initialClientGzipBytes} B) exceeds allowance (${allowed} B).`,
    );
  }
}

const entrypointBudgets = baseline.entrypointBudgets ?? {};
for (const [entrypoint, budget] of Object.entries(entrypointBudgets)) {
  if (typeof budget.gzipBytes !== 'number') {
    console.warn(`Skipping ${entrypoint}: missing gzipBytes baseline.`);
    continue;
  }

  const actual = computeEntrypointSize(entrypoint);
  const allowed = getAllowance(budget.gzipBytes, budget.tolerance);
  if (actual > allowed) {
    violations.push(
      `${entrypoint} bundle size ${actual} B exceeds allowance ${allowed} B (baseline ${budget.gzipBytes} B).`,
    );
  }
}

if (violations.length > 0) {
  console.error('Bundle size check failed:\n- ' + violations.join('\n- '));
  process.exit(1);
}

console.log('Bundle size check passed.');
console.log(
  JSON.stringify(
    {
      totals,
      checkedEntrypoints: Object.keys(entrypointBudgets).reduce((acc, entrypoint) => {
        acc[entrypoint] = computeEntrypointSize(entrypoint);
        return acc;
      }, {}),
    },
    null,
    2,
  ),
);

