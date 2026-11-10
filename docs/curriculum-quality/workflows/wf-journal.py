#!/usr/bin/env python3
"""Read a Workflow run's journal without loading it into the lead's context.

  wf-journal.py status <runId> [<runId> ...]   one line per lesson or component: each agent's outcome, in order
  wf-journal.py save <runId> <out.json> [--trim]   every finished agent's result, keyed by its label (--trim: verdicts and findings only)
  wf-journal.py open <runId>                   S1/S2 findings of each subject's last failed reviews
"""
import collections
import glob
import json
import re
import sys
from pathlib import Path

BASE = str(Path.home() / ".claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/*/subagents/workflows") + "/"


def load(run):
    paths = glob.glob(BASE + run + "/journal.jsonl")
    if not paths:
        sys.exit(f"no journal for {run}")
    labels, results, order = {}, {}, []
    for line in open(paths[0]):
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        if d.get("type") == "started":
            labels[d.get("agentId")] = d.get("label") or "?"
            order.append(d.get("agentId"))
        elif d.get("type") == "result":
            results[d.get("agentId")] = d.get("result")
    return labels, results, order


def counts(result):
    c = collections.Counter(str(f).strip()[:2] for f in (result or {}).get("findings", []))
    return ",".join(f"{k}:{c[k]}" for k in ("S1", "S2", "S3") if c[k])


def main():
    mode = sys.argv[1]
    if mode == "save":
        labels, results, _ = load(sys.argv[2])
        out = {labels[a]: r for a, r in results.items()}
        if "--trim" in sys.argv:  # what later passes need: verdicts, findings, what was skipped
            keep = ("pass", "findings", "skipped", "notes", "notRegistered")
            out = {k: {x: (str(y)[:1500] if isinstance(y, str) else y) for x, y in r.items() if x in keep} for k, r in out.items() if isinstance(r, dict)}
        Path(sys.argv[3]).write_text(json.dumps(out, indent=1, ensure_ascii=False))
        print(sys.argv[3], len(results), "results")
        return
    for run in sys.argv[2:]:
        labels, results, order = load(run)
        subjects = collections.OrderedDict()
        for a in order:
            parts = labels[a].split(":")
            subject = parts[1] if len(parts) > 1 else parts[0]
            step = parts[0][:3] + (":" + ":".join(parts[2:]) if len(parts) > 2 else "")
            r = results.get(a, "RUNNING")
            if r == "RUNNING":
                state = "…"
            elif r is None:
                state = "DIED"
            elif isinstance(r, dict) and "pass" in r:
                state = ("P" if r["pass"] else "F") + (f"({counts(r)})" if counts(r) else "")
            else:
                state = "ok"
            subjects.setdefault(subject, []).append((step, state, r))
        print(f"{run}: {len(results)} of {len(order)} agents done")
        for subject, steps in subjects.items():
            if mode == "status":
                print(f"  {subject}: " + " ".join(f"{s}={st}" for s, st, _ in steps))
            else:
                last = {}
                for s, st, r in steps:
                    if isinstance(r, dict) and "pass" in r:
                        last[re.sub(r":r\d+$|:\d+$", "", s)] = r
                for s, r in last.items():
                    if not r["pass"]:
                        for f in r["findings"]:
                            if str(f).strip()[:2] in ("S1", "S2"):
                                print(f"  {subject} [{s}] {str(f)[:420]}")


if __name__ == "__main__":
    main()
