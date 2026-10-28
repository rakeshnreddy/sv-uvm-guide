#!/usr/bin/env python3
"""Build Workflow `args` for the next 6a and components runs from the saved data, so a new session
does not repeat the 112 lesson audits or the backlog phase.

  python3 docs/curriculum-quality/workflows/make-workflow-args.py 6a F1C_Why_SystemVerilog F2D_Reusable_Code_and_Parallelism
      -> args for visual-enrichment.js: { modules, extraContext } with each lesson's saved audit plan,
         the components on main that the backlog planned for these lessons, and what not to embed.
  python3 docs/curriculum-quality/workflows/make-workflow-args.py components 8
      -> args for visual-components.js: { backlog, skip, buildCap }, the next 8 unbuilt components.

Prints the JSON to stdout; pass it verbatim as the Workflow tool's `args`. Update data/progress.json after
each release (built components, enriched lessons).
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
BACKLOG = json.loads((DATA / "components-backlog-2026-10-28.json").read_text())
PLANS = json.loads((DATA / "lesson-plans-2026-10-28.json").read_text())["lessons"]
PROGRESS = json.loads((DATA / "progress.json").read_text())
BUILT = set(PROGRESS["componentsBuilt"])


def enrichment_args(modules):
    names = {c["id"]: c["name"] for c in BACKLOG["components"]}
    notes = [
        "LEAD NOTES (from docs/curriculum-quality/data, saved 2026-10-28):",
        "- Components on main that the backlog planned for these lessons (embed them where they fit; verify every "
        "preset or deck exists in the component source before embedding):",
    ]
    for c in BACKLOG["components"]:
        if c["id"] not in BUILT:
            continue
        uses = [u for u in c.get("lessons", []) if any(m in u for m in modules)]
        for u in uses:
            notes.append(f"  - {c['name']}: {u}")
    unbuilt = sorted({names[c["id"]] for c in BACKLOG["components"] if c["id"] not in BUILT})
    notes.append("- NOT on main, do not embed: " + ", ".join(unbuilt) + ".")
    notes.append("- If a lesson embeds a ScenarioSorter deck, add the embed to the pin in "
                 "tests/lib/scenario-sorter-decks.test.ts.")
    notes.append("- Earlier read-only audit of each lesson (verify each idea, keep only what teaches; line numbers "
                 "may have shifted):")
    for p in PLANS:
        if not any(f"/{m}/" in p["file"] for m in modules):
            continue
        if p["file"] in PROGRESS["lessonsEnriched"]:
            notes.append(f"  {p['file']}: ALREADY ENRICHED, do not re-run 6a on it.")
            continue
        notes.append(f"  {p['file']}:")
        notes.append("    TEXT-HEAVY: " + json.dumps(p.get("textHeavy"), ensure_ascii=False)[:3000])
        notes.append("    STATIC VISUALS: " + json.dumps(p.get("staticVisuals"), ensure_ascii=False)[:5000])
    skip = [f for f in PROGRESS["lessonsEnriched"] if any(f"/{m}/" in f for m in modules)]
    return {"modules": modules, "skipFiles": skip, "extraContext": "\n".join(notes)}


def components_args(cap):
    todo = [c for c in BACKLOG["components"] if c["id"] not in BUILT][:cap]
    return {"backlog": {"components": todo, "deferred": []}, "skip": sorted(BUILT), "buildCap": cap}


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in ("6a", "components"):
        sys.exit(__doc__)
    if sys.argv[1] == "6a":
        print(json.dumps(enrichment_args(sys.argv[2:]), ensure_ascii=False))
    else:
        print(json.dumps(components_args(int(sys.argv[2])), ensure_ascii=False))
