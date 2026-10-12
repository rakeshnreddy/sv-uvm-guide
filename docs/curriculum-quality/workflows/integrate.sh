#!/bin/bash
# Usage: integrate.sh <filelist> [--prep <script>]
# Builds a clean worktree at HEAD, copies the listed files from the main tree
# (missing files are treated as deletions), optionally runs a prep script in
# the worktree, regenerates lab registry + curriculum data, runs the full suite,
# and prints failures. Does NOT commit; see integrate-commit.sh.
set -e
MAIN=/Users/Rakesh/Projects/sv-uvm-guide
SCR=${SCR:?set SCR to your session scratchpad directory}
WT=$SCR/wt-int
LIST=$1
cd $MAIN; git worktree remove --force $WT 2>/dev/null || true; git worktree add -q --detach $WT HEAD
while read f; do [ -z "$f" ] && continue; if [ -e "$MAIN/$f" ]; then mkdir -p "$WT/$(dirname "$f")"; cp "$MAIN/$f" "$WT/$f"; else rm -f "$WT/$f"; fi; done < $LIST
ln -s $MAIN/node_modules $WT/node_modules; for e in .env .env.local .env.test; do [ -f $MAIN/$e ] && cp $MAIN/$e $WT/$e; done
cd $WT
if [ "$2" = "--prep" ]; then bash "$3" || true; fi
node scripts/generate-lab-registry.mjs >/dev/null
npm run -s generate:curriculum >/dev/null 2>&1
npm run -s validate:flashcards
NODE_OPTIONS='--require @prisma/client' npx vitest run tests/curriculum-generator.test.ts -u --reporter=dot >/dev/null 2>&1 || true
NODE_OPTIONS='--require @prisma/client' npx vitest run --reporter=dot > $SCR/vitest-int.log 2>&1 || true
sed 's/\x1b\[[0-9;]*m//g' $SCR/vitest-int.log | grep -E "^ FAIL|Test Files|Tests " | sort -u
npx tsc --noEmit -p . 2>&1 | tail -3
