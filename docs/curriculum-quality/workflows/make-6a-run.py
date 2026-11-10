#!/usr/bin/env python3
"""Write a ready-to-run copy of visual-enrichment-v2.js with its arguments embedded.

  make-6a-run.py --out run.js --snap DIR <module> [<module> ...]
      6a for every lesson of those modules that progress.json does not list as enriched. The author plans from the
      saved audit (data/lesson-plans-2026-10-28.json) and the saved catalog (data/visual-catalog.json).
  make-6a-run.py --out run.js --snap DIR --review-only --files-from list.txt --saved data/6a-cloud-2026-11-05.json
                 [--fix-applied <tag> ...]
      Review-and-fix only, for lessons that are already authored. A lens whose last saved review failed starts from
      those findings: with --fix-applied <tag> (for example I-SV-1/polymorphism-pitfalls) the fix is already in the
      file and the reviewer verifies it; otherwise a fixer runs first.

  make-6a-run.py --out run.js --snap DIR --embed <component-id>[,<id>...] --usage a.json [b.json ...]
      Embed pass: one author per lesson that the backlog planned these released components for, then the usual
      review rounds on that diff. --usage files hold the builders' mdxUsage notes ({"fixers": {...}} or a journal save).

Run the result with Workflow({scriptPath}). Workers default to Opus 5.5 (--model to change); the lead stays on Fable.
The shared context comes from visual-enrichment.js so the two cannot drift.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "data"
ROOT = str(HERE.parent.parent.parent)
SRC = str(Path.home() / ".claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/sources")
QUALITY = """QUALITY BAR (the owner's requirements; every agent applies them):
1. Accuracy: every normative SystemVerilog, UVM or AMBA claim matches the primary sources. Cite the clause. Record uncertainty and simulator limitations instead of inventing a citation.
2. Completeness: nothing the lesson taught is lost, and every core concept has a visual.
3. Junior to expert: the core path stays readable for a junior, with depth in the expert sections, and no term is used before it is defined.
4. Visuals: they teach, not decorate; they are accessible and readable at 390 px.
5. Easy navigation: heading anchors, links, the template order and in-page reveals keep working, so a learner can find any rule again quickly.
More sources: PSS 3.0 is accellera_pss30.txt and CHI E.b is arm_chi_eb.txt in the same folder. The Accellera uvm-core 2020.3.1 reference implementation is in /Users/Rakesh/Downloads/1800.2-2020.3.1 (read-only): use it for behaviour the standard leaves to the implementation, and say so in the text."""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("modules", nargs="*")
    parser.add_argument("--out", required=True)
    parser.add_argument("--snap", required=True, help="folder outside the repo for the fixers' snapshots")
    parser.add_argument("--model", default="opus")
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument("--review-only", action="store_true")
    parser.add_argument("--files-from")
    parser.add_argument("--saved")
    parser.add_argument("--fix-applied", nargs="*", default=[])
    parser.add_argument("--embed")
    parser.add_argument("--usage", nargs="*", default=[])
    parser.add_argument("--note", default="", help="embed mode: one more sentence for every task")
    args = parser.parse_args()

    v1 = (HERE / "visual-enrichment.js").read_text()
    context = re.search(r"const CONTEXT = `(.*?)`\n", v1, re.S).group(1).replace("${ROOT}", ROOT).replace("${SRC}", SRC)
    all_lessons = json.loads(re.search(r"const ALL_LESSONS = (\[.*?\])\n", v1, re.S).group(1))
    progress = json.loads((DATA / "progress.json").read_text())
    plans = {}
    for p in json.loads((DATA / "lesson-plans-2026-10-28.json").read_text())["lessons"]:
        key = p["file"] if p["file"].startswith("content/") else "content/curriculum/" + p["file"]
        plans[key] = {"textHeavy": p.get("textHeavy"), "staticVisuals": p.get("staticVisuals"),
                      "needs": [{"where": n.get("where"), "concept": n.get("concept")} for n in p.get("needs", [])]}

    tasks = {}
    if args.embed:
        backlog = {c["id"]: c for c in json.loads((DATA / "components-backlog-2026-10-28.json").read_text())["components"]}
        usage = {}
        for path in args.usage:
            blob = json.loads(Path(path).read_text())
            for key, val in (blob.get("fixers") or blob).items():
                m = re.match(r"(?:fix|build):([a-z0-9-]+)(?::|$)", key)
                if m and isinstance(val, dict) and val.get("mdxUsage"):
                    usage[m.group(1)] = val["mdxUsage"]
        by_file = {}
        for cid in args.embed.split(","):
            for line in backlog[cid].get("lessons", []):
                by_file.setdefault("content/curriculum/" + line.split(" > ")[0].strip(), []).append((cid, backlog[cid]["name"], line))
        for f, rows in by_file.items():
            ids = sorted({cid for cid, _, _ in rows})
            tasks[f] = (f"EMBED PASS for {f}. These interactive components were released after this lesson was enriched. Embed each one at its "
                        "planned place, using only props and preset ids that exist in its committed source (read it with git show HEAD:<path>, "
                        "and check the builder's usage notes below against it).\nPLANNED EMBEDS (line numbers have shifted; find each section by "
                        "its heading):\n" + "\n".join(f"- {name}: {line}" for _, name, line in rows)
                        + "\nBUILDER USAGE NOTES:\n" + "\n".join(f"{cid}: {str(usage.get(cid, 'none saved; read the component source'))[:2500]}" for cid in ids)
                        + "\nRules: keep every existing figure, table, sentence, code block and quiz. Put the interactive right after the predict "
                        "prompt or text it serves, with one or two sentences that say what to try and what to notice. Never let it reveal the "
                        "answer to a prediction that comes before it. When an existing embed of the same component only gains props, edit that "
                        "tag in place. Skip a planned embed that does not fit the lesson as it is now, and say why in skipped. Make no other "
                        "change to the lesson." + (" " + args.note if args.note else ""))
        picked = [l for l in all_lessons if l["file"] in tasks]
    elif args.review_only:
        wanted = [f.strip() for f in Path(args.files_from).read_text().split() if f.strip()]
        picked = [l for l in all_lessons if l["file"] in wanted]
        missing = set(wanted) - {l["file"] for l in picked}
        if missing:
            sys.exit(f"not in the lesson list: {sorted(missing)}")
    else:
        picked = [l for l in all_lessons if l["module"] in args.modules and l["file"] not in progress["lessonsEnriched"]]
    modules = sorted({l["module"] for l in picked})
    helper = subprocess.run([sys.executable, str(HERE / "make-workflow-args.py"), "6a", *modules], capture_output=True, text=True, check=True)
    extra = json.loads(helper.stdout)["extraContext"].split("- Earlier read-only audit")[0].rstrip()

    saved = {}
    if args.saved:
        for run in json.loads(Path(args.saved).read_text())["runs"].values():
            saved.update(run)
    lessons = []
    for l in picked:
        tag = f"{l['module'].split('_')[0]}/{l['lesson']}"
        item = {"file": l["file"], "module": l["module"], "lesson": l["lesson"], "track": l.get("track"), "start": "author",
                "plan": plans.get(l["file"])}
        if l["file"] in tasks:
            item["task"] = tasks[l["file"]]
            item["plan"] = None
        if args.review_only:
            item["start"] = "review"
            item["plan"] = None
            audit = saved.get(f"audit:{tag}")
            if audit:
                item["priorReport"] = {"plannedAdditions": [f"{a.get('where')}: {a.get('what')}"[:220] for a in audit.get("additions", [])][:14]}
            last = {}
            for key, review in saved.items():
                m = re.fullmatch(rf"review:{re.escape(tag)}:(\w+):r(\d+)", key)
                if m and int(m.group(2)) >= last.get(m.group(1), (0, None))[0]:
                    last[m.group(1)] = (int(m.group(2)), review)
            failed = {lens: r["findings"] for lens, (_, r) in last.items() if not r.get("pass")}
            if failed:
                item["priorFindings"] = failed
                if tag not in args.fix_applied:
                    item["start"] = "fix"
                    item["startFindings"] = [f for fs in failed.values() for f in fs]
        lessons.append(item)
    if not lessons:
        sys.exit("nothing to do: every lesson of these modules is already in progress.json")

    catalog = json.dumps(json.loads((DATA / "visual-catalog.json").read_text()), ensure_ascii=False, separators=(",", ":"))[:45000]
    data = {"root": ROOT, "snapDir": args.snap, "maxRounds": args.rounds,
            "models": {k: args.model for k in ("author", "fix", "accuracy", "pedagogy", "delta")},
            "context": f"{context}\n{QUALITY}\n{extra}", "catalogText": catalog, "lessons": lessons}
    script = (HERE / "visual-enrichment-v2.js").read_text()
    marker = re.search(r"^const DATA = .*// EMBED.*$", script, re.M)
    script = script[:marker.start()] + "const DATA = " + json.dumps(data, ensure_ascii=False) + script[marker.end():]
    Path(args.out).write_text(script)
    print(args.out, len(script), [(f"{l['module'].split('_')[0]}/{l['lesson']}", l["start"], sorted(l.get("priorFindings", {}))) for l in lessons])


if __name__ == "__main__":
    main()
