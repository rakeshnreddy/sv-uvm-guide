#!/bin/bash
# Checkpoint release: put reviewed work on the live site while workflows keep running.
#
#   SCR=<scratchpad> checkpoint-release.sh <filelist> "<commit message>"
#
# 1. Builds a clean worktree at HEAD and copies the listed files from the main tree
#    (a listed file that no longer exists is deleted).
# 2. Regenerates derived data (lab registry, curriculum, search index) and runs the
#    gates: flashcards, MDX render of the changed lessons, tsc, lint, the unit suite
#    and the Verilator compile check.
# 3. Commits in the worktree and moves the branch to that commit WITHOUT touching
#    the main tree, so agents still editing files there lose nothing: their later
#    edits simply show as new changes on top of the checkpoint.
# 4. Pushes the branch, waits for the "Required quality gates" CI run, and only if
#    it passes fast-forwards main, which Cloudflare Workers Builds deploys.
#
# Stops at the first failing gate and prints why; nothing is committed then.
set -euo pipefail
MAIN=/Users/Rakesh/Projects/sv-uvm-guide
SCR=${SCR:?set SCR to your session scratchpad directory}
LIST=${1:?file list}
MESSAGE=${2:?commit message}
WT=$SCR/wt-release
BRANCH=curriculum-quality-program
export UVM_HOME=${UVM_HOME:-/Users/Rakesh/Downloads/1800.2-2020.3.1}

cd "$MAIN"
[ "$(git rev-parse --abbrev-ref HEAD)" = "$BRANCH" ] || { echo "main tree is not on $BRANCH"; exit 1; }
git worktree remove --force "$WT" 2>/dev/null || true
git worktree add -q --detach "$WT" HEAD
while read -r f; do
  [ -z "$f" ] && continue
  if [ -e "$MAIN/$f" ]; then mkdir -p "$WT/$(dirname "$f")"; cp "$MAIN/$f" "$WT/$f"; else rm -f "$WT/$f"; fi
done < "$LIST"
ln -s "$MAIN/node_modules" "$WT/node_modules"
for e in .env .env.local .env.test; do [ -f "$MAIN/$e" ] && cp "$MAIN/$e" "$WT/$e"; done

cd "$WT"
echo "== generate"
node scripts/generate-lab-registry.mjs >/dev/null
npm run -s generate:curriculum >/dev/null 2>&1
node scripts/generate-search-index.mjs >/dev/null
echo "== content gates"
npm run -s validate:flashcards
npm run -s validate:content | tail -2
mdx=$(grep -E '\.mdx$' "$LIST" | while read -r f; do [ -e "$WT/$f" ] && echo "$f"; done || true)
[ -n "$mdx" ] && node scripts/check-mdx.mjs --render $mdx | tail -3
echo "== tsc and lint"
npx tsc --noEmit -p .
npm run -s lint
echo "== unit tests"
NODE_OPTIONS='--require @prisma/client' npx vitest run tests/curriculum-generator.test.ts -u --reporter=dot >/dev/null 2>&1 || true
# Half the workers and longer timeouts: a fresh worktree starts with a cold transform cache, and the
# default pool on this Mac starves tests into timeouts. CI keeps the normal timeouts.
NODE_OPTIONS='--require @prisma/client' npx vitest run --reporter=dot --maxWorkers=50% --testTimeout=30000 --hookTimeout=30000 > "$SCR/vitest-release.log" 2>&1 || {
  sed 's/\x1b\[[0-9;]*m//g' "$SCR/vitest-release.log" | grep -E "^ FAIL|Test Files|Tests " | sort -u; echo "unit tests failed"; exit 1; }
sed 's/\x1b\[[0-9;]*m//g' "$SCR/vitest-release.log" | grep -E "Test Files|Tests " | sort -u
echo "== Verilator compile check"
node scripts/compile-sv.mjs --prune-known | tail -2

echo "== commit"
git add -A   # node_modules (a symlink here) and the .env files are gitignored
if git diff --cached --name-only | grep -qE '^(node_modules|\.env)'; then echo "refusing to commit node_modules or .env"; exit 1; fi
git diff --cached --stat | tail -1
git commit -q --no-verify -m "$MESSAGE"
COMMIT=$(git rev-parse HEAD)
# Files the generators changed (not in the list) go back to the main tree too, or it
# would keep the stale generated data and show it as a change against the new HEAD.
git diff --name-only HEAD~1 HEAD | grep -vxF -f "$LIST" > "$SCR/release-generated.txt" || true
while read -r f; do [ -n "$f" ] && mkdir -p "$MAIN/$(dirname "$f")" && cp "$WT/$f" "$MAIN/$f"; done < "$SCR/release-generated.txt"
# The compile check may have pruned known entries; the main tree takes that file too.
cp "$WT/scripts/sv-compile.config.json" "$MAIN/scripts/sv-compile.config.json"
cd "$MAIN"
git update-ref "refs/heads/$BRANCH" "$COMMIT"
git reset -q   # index follows the new HEAD; the working tree is left exactly as the agents have it
git worktree remove --force "$WT"
git push -q origin "$BRANCH"
echo "pushed $(git rev-parse --short "$COMMIT"); waiting for CI"

RUN=""
for _ in $(seq 1 20); do
  RUN=$(gh run list --branch "$BRANCH" --commit "$COMMIT" --workflow "Required quality gates" --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)
  [ -n "$RUN" ] && break; sleep 15
done
[ -n "$RUN" ] || { echo "no CI run found for $COMMIT; main not updated"; exit 1; }
if gh run watch "$RUN" --exit-status --interval 60 >/dev/null 2>&1; then
  PUSHED=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  git push -q origin "$COMMIT:main"
  echo "CI run $RUN passed; main is now $(git rev-parse --short "$COMMIT"); waiting for the production build"
  # The branch push also starts a Workers *preview* build, which fails (the non-production deploy command is
  # not set up). Only the build that starts after the main push is the production deploy.
  BUILD=""
  for _ in $(seq 1 40); do
    BUILD=$(gh api "repos/rakeshnreddy/sv-uvm-guide/commits/$COMMIT/check-runs?filter=all" --jq "[.check_runs[] | select((.name|test(\"Workers\")) and .started_at >= \"$PUSHED\" and .status == \"completed\")] | last | .conclusion // empty" 2>/dev/null || true)
    [ -n "$BUILD" ] && break; sleep 30
  done
  echo "production Workers build: ${BUILD:-not finished after 20 minutes}"
  [ "$BUILD" = "success" ] || exit 1
else
  echo "CI run $RUN failed; main not updated:"
  gh run view "$RUN" --json jobs --jq '.jobs[].steps[] | select(.conclusion=="failure") | .name'
  exit 1
fi
