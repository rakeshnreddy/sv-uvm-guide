#!/bin/bash
# Usage: integrate-commit.sh "<message>"  (after integrate.sh): copies every changed
# worktree file back to main and commits exactly those paths, then pushes.
set -e
MAIN=/Users/Rakesh/Projects/sv-uvm-guide
SCR=${SCR:?set SCR to your session scratchpad directory}
WT=$SCR/wt-int
cd $WT
git status --short --untracked-files=all | grep -v "node_modules\|\.env" | awk '{print $1" "$2}' > $SCR/int-status.txt
: > $SCR/int-paths.txt
while read st f; do echo "$f" >> $SCR/int-paths.txt; if [ "$st" = "D" ]; then rm -f "$MAIN/$f"; else mkdir -p "$MAIN/$(dirname "$f")"; cp "$WT/$f" "$MAIN/$f"; fi; done < $SCR/int-status.txt
cd $MAIN
git add -A --pathspec-from-file=$SCR/int-paths.txt
git diff --cached --stat | tail -1
git commit -q --no-verify -m "$1"
git push -q 2>&1 | tail -1
git log --oneline -1
git worktree remove --force $WT
