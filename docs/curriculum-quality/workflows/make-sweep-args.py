#!/usr/bin/env python3
"""Print the JSON args object for final-sweep-v2.js.

  make-sweep-args.py --snap DIR [--label NAME] [--tiers T2_Intermediate,T3_Advanced]
                     [--exclude-from FILE] [--only-from FILE] [--root DIR] > args.json

Lessons, their order, tier, module and title come from src/lib/curriculum-data.tsx (written by
scripts/generate-curriculum-data.ts from the manifest and each lesson's frontmatter), so the list is exactly the
lesson pages the site serves. --exclude-from and --only-from take repository-relative lesson paths, one per line
(blank lines and lines starting with # are ignored). The lesson count goes to stderr.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def read_list(path):
    lines = [l.strip() for l in Path(path).read_text().splitlines()]
    return {l for l in lines if l and not l.startswith("#")}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tiers", help="comma-separated tier folder names (default: all)")
    parser.add_argument("--exclude-from", help="file of lesson paths to leave out")
    parser.add_argument("--only-from", help="file of lesson paths to keep (all others are left out)")
    parser.add_argument("--snap", required=True, help="folder outside the repository for the fixers' snapshots")
    parser.add_argument("--label", default="final-sweep-v2")
    parser.add_argument("--root", help="repository top level (default: git rev-parse --show-toplevel)")
    args = parser.parse_args()

    root = Path(args.root or subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=HERE, capture_output=True,
                                            text=True, check=True).stdout.strip()).resolve()
    snap = Path(args.snap).expanduser().resolve()
    if snap == root or root in snap.parents:
        sys.exit(f"--snap must be outside the repository: {snap}")

    source = (root / "src/lib/curriculum-data.tsx").read_text()
    m = re.search(r"export const curriculumData: Module\[\] = (\[.*?\n\]);\n", source, re.S)
    if not m:
        sys.exit("could not find curriculumData in src/lib/curriculum-data.tsx")
    tiers = json.loads(m.group(1))

    wanted_tiers = set(args.tiers.split(",")) if args.tiers else None
    if wanted_tiers:
        unknown = wanted_tiers - {t["slug"] for t in tiers}
        if unknown:
            sys.exit(f"unknown tier folder(s): {sorted(unknown)}")
    exclude = read_list(args.exclude_from) if args.exclude_from else set()
    only = read_list(args.only_from) if args.only_from else None

    lessons, served, missing = [], set(), []
    for tier in tiers:
        for section in tier["sections"]:
            for topic in section["topics"]:
                file = f"content/curriculum/{tier['slug']}/{section['slug']}/{topic['slug']}.mdx"
                served.add(file)
                if not (root / file).is_file():
                    missing.append(file)
                    continue
                if wanted_tiers and tier["slug"] not in wanted_tiers:
                    continue
                if file in exclude or (only is not None and file not in only):
                    continue
                lessons.append({"file": file, "tier": tier["slug"], "module": section["slug"], "title": topic["title"]})
    if missing:
        sys.exit(f"curriculum data names lessons with no MDX file (regenerate it): {missing}")
    for name, chosen in (("--exclude-from", exclude), ("--only-from", only or set())):
        stray = sorted(chosen - served)
        if stray:
            print(f"warning: {name} lists paths that are not served lessons: {stray}", file=sys.stderr)
    on_disk = {str(p.relative_to(root)) for p in (root / "content/curriculum").glob("T*/**/*.mdx")}
    if on_disk - served:
        print(f"warning: MDX files the site does not serve (left out): {sorted(on_disk - served)}", file=sys.stderr)

    print(json.dumps({"root": str(root), "snap": str(snap), "label": args.label, "lessons": lessons}, ensure_ascii=False, indent=1))
    counts = {}
    for l in lessons:
        counts[l["tier"]] = counts.get(l["tier"], 0) + 1
    print(f"{len(lessons)} lesson(s): {json.dumps(counts)}", file=sys.stderr)


if __name__ == "__main__":
    main()
