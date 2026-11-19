#!/bin/bash
# Generate the four figures into a candidate copy of the lesson, check that it parses, then move it into place.
set -euo pipefail
HERE=<scratch>/figures/art/f1a
WT=<repo>
REL=content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index.mdx
export NODE_PATH=<repo>/node_modules
CAND=$HERE/candidate/content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs
mkdir -p "$CAND"
OUT="$CAND/index.mdx" node "$HERE/gen4.cjs"
cd "$WT"
node scripts/check-mdx.mjs "$CAND/index.mdx" 2>&1 | tail -4
mv "$CAND/index.mdx" "$WT/$REL"
node scripts/check-mdx.mjs --render "$REL" 2>&1 | tail -4
