#!/usr/bin/env python3
"""Prepare a checkpoint release: guard the tree, update progress.json and the ScenarioSorter embed pin, write the list.

  prep-release.py --label checkpoint-17 --list OUT.txt [--components id,id] [--extra path ...] [<lesson.mdx> ...]

Lessons are marked in lessonsEnriched with the label, components move from componentsHeldOnBackup to componentsBuilt.
The pin in tests/lib/scenario-sorter-decks.test.ts gains the deck embeds found in the listed lessons; an embed that
a listed lesson lost stops the release. Then run checkpoint-release.sh with OUT.txt.
"""
import argparse
import datetime
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PIN = "tests/lib/scenario-sorter-decks.test.ts"
PROGRESS = "docs/curriculum-quality/data/progress.json"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("lessons", nargs="*")
    parser.add_argument("--label", required=True)
    parser.add_argument("--list", required=True)
    parser.add_argument("--components", default="")
    parser.add_argument("--extra", nargs="*", default=[])
    args = parser.parse_args()
    if not (ROOT / ".gitignore").exists():
        sys.exit(".gitignore is missing: git checkout HEAD -- .gitignore")
    staged = subprocess.run(["git", "diff", "--cached", "--name-only"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    if any(s.startswith("node_modules") or s.startswith(".env") for s in staged):
        sys.exit("node_modules or .env is staged: unstage it first")
    files = list(args.lessons) + list(args.extra)
    for f in files:
        if not (ROOT / f).exists():
            sys.exit(f"missing: {f}")

    progress = json.loads((ROOT / PROGRESS).read_text())
    for f in args.lessons:
        progress["lessonsEnriched"][f] = args.label
    held = progress.get("componentsHeldOnBackup", {})
    for cid in filter(None, args.components.split(",")):
        progress["componentsBuilt"][cid] = args.label
        if cid in held.get("ids", []):
            held["ids"].remove(cid)
    progress["updated"] = datetime.date.today().isoformat()
    (ROOT / PROGRESS).write_text(json.dumps(progress, indent=1, ensure_ascii=False) + "\n")

    test = (ROOT / PIN).read_text()
    block = re.search(r"expect\(decks\)\.toEqual\(\[\n(.*?)\n    \]\);", test, re.S)
    pinned = re.findall(r'"([^"]+)"', block.group(1))
    keep = [p for p in pinned if p.rsplit(" ", 1)[0] not in args.lessons]
    found = []
    for f in args.lessons:
        for tag in re.findall(r"<ScenarioSorter\b[^>]*>", (ROOT / f).read_text(), re.S):
            deck = re.search(r'deck="([^"]+)"', tag)
            if deck:
                found.append(f"{f} {deck.group(1)}")
    lost = [p for p in pinned if p.rsplit(" ", 1)[0] in args.lessons and p not in found]
    if lost:
        sys.exit(f"a released lesson lost a pinned ScenarioSorter embed: {lost}")
    new = sorted(set(keep + found))
    if new != pinned:
        body = "\n".join(f'      "{p}",' for p in new)
        (ROOT / PIN).write_text(test[:block.start(1)] + body + test[block.end(1):])
        files.append(PIN)
        print("pin: added", sorted(set(new) - set(pinned)))
    out = sorted(set(files + [PROGRESS]))
    Path(args.list).write_text("\n".join(out) + "\n")
    print(args.list, len(out), "files;", len(args.lessons), "lessons marked", args.label)


if __name__ == "__main__":
    main()
