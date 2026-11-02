#!/usr/bin/env python3
"""Run lesson authoring or fix rounds with Gemini 4 Argon through the Antigravity CLI (agy).

Argon writes; this driver runs the checks, because agy's headless mode refuses shell commands and no
blanket permission is granted. Claude reviews the result separately (gemini-review.js) and
checkpoint-release.sh remains the only way to main. Each lesson runs on the pilot worktree's branch, and the
driver commits and pushes after every stage so no work is lost.

  gemini-lesson.py author --worktree W --base COMMIT --plans plans.json --extra extra.txt --out DIR [--catalog catalog.json]
  gemini-lesson.py polish --worktree W --base COMMIT --plans plans.json --extra extra.txt --out DIR  (the model reviews and fixes its own work)
  gemini-lesson.py fix    --worktree W --base COMMIT --findings findings.json --round N --extra extra.txt --out DIR

plans.json maps lesson file -> audit plan; findings.json maps lesson file -> list of "Sev line - problem -> fix".
"""
import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import threading
import time
from pathlib import Path

MODEL = "gemini-4-argon-high"
SOURCES = str(Path.home() / ".claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/sources")
SCRIPT = Path(__file__).resolve().parent / "visual-enrichment.js"
SCHEMA = {
    "type": "object",
    "properties": {
        "file": {"type": "string"},
        "added": {"type": "array", "items": {"type": "string"}},
        "skipped": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["file", "added", "skipped"],
}
GIT_LOCK = threading.Lock()
# What Claude's reviewers kept finding in Argon's pilot lessons (F2B, F2E): say it up front to save fix rounds.
ARGON_LESSONS = """KNOWN WEAK SPOTS, check each before you finish:
- Prefer the diagram kit (ArchitectureDiagram, DiagramFigure and friends) over hand-drawn SVG. Any figure must stay legible at 390 px: no text below about 11 px after scaling, and node labels must fit their boxes.
- Hand-drawn SVG text must be centred on what it labels and must not overlap lines or other text.
- A predict-then-check prompt must not be answered by the title, caption, table or figure above it. Put the reveal after the prompt.
- Recall cards and tables must be exact: do not mix 4-state and 2-state results, and show what the code in the lesson really produces.
- A new element must teach something at that point. Do not repeat a table the lesson already has, and keep the page uncluttered."""
SELF_REVIEW = """Go through every element you added, one at a time:
1. ACCURACY. Open the primary source for every fact a visual, table, caption or recall card states, and compare the words. Check that code in a figure would really produce what the figure shows, that numbers and strings match the lesson's own worked examples, that names match the lesson's variables, and that nothing claims more than the standard says.
2. SVG. Every path that is a line needs fill="none". Lines must not run through text. Text must fit inside its box and the viewBox, and stay readable at 390 px. Repeated spaces collapse in SVG text. Arrows must start and end where the flow does.
3. DIAGRAM KIT. numbered sequence diagrams must not also carry hand-written numbers. Edge labels and node kinds must mean what the visual language says, and a decision needs all its outcomes.
4. TEACHING. A prediction must not be answered by anything visible before its reveal, and must give all the facts needed to answer it. A quiz's correct option must not always come first or be the longest. Drop nothing, but merge or move any element that only repeats a nearby one.
5. KEEP. Every original comment, line of code, log line and fact stays exactly as it was; do not add annotations inside literal logs."""
AUDIT = ("First audit the lesson: read it fully, its spine card in docs/curriculum-quality/curriculum-spine.md and its "
         "neighbours for context. Find the text-heavy stretches (long prose with no visual, code, table or interactive) "
         "and every core concept with no picture. Then make the additions: first reuse what exists (catalog below: embed "
         "an interactive with the right preset, or link a practice page), then new kit diagrams, tables, step reveals, "
         "predict-then-check prompts and a summary visual. Aim for a visual or interactive element at least every few "
         "paragraphs in teaching sections, without cluttering. The notes below come from an earlier read-only audit: "
         "verify each idea and keep only what teaches. Their 'needs' are planned components, so build on them only "
         "with what exists today.")


def shared_context(worktree, extra):
    """The same CONTEXT the Claude authors get, read from visual-enrichment.js so the two cannot drift."""
    text = SCRIPT.read_text()
    body = re.search(r"const CONTEXT = `(.*?)`\n", text, re.S).group(1)
    body = body.replace("${ROOT}", worktree).replace("${SRC}", SOURCES)
    return f"{body}\n{extra}"


def run(cmd, cwd, env=None, timeout=900):
    full_env = {**os.environ, **(env or {})}
    result = subprocess.run(cmd, cwd=cwd, env=full_env, capture_output=True, text=True, timeout=timeout)
    return result.returncode, result.stdout + result.stderr


def gates(worktree, file):
    """The enrichment VALIDATE step, run by the driver. Returns a list of failure texts."""
    failures = []
    code, out = run(["node", "scripts/check-mdx.mjs", "--render", file], worktree)
    if code != 0 or not re.search(r"Checked \d+ file\(s\): 0 error\(s\), 0 warning\(s\)", out):
        failures.append("check-mdx --render failed:\n" + out[-2500:])
    code, out = run(["npx", "vitest", "run", "tests/lib/diagram-kit-content.test.ts"], worktree,
                    {"DIAGRAM_KIT_REPORT": "1", "NODE_OPTIONS": "--require @prisma/client"})
    hits = [line for line in out.splitlines() if file in line]
    # Lessons edit in parallel, so a finding in another lesson must not fail this one.
    other_lesson_only = code != 0 and not hits and "new diagram finding" in out
    if (code != 0 and not other_lesson_only) or hits:
        failures.append("diagram-kit check reports:\n" + ("\n".join(hits)[:2500] or out[-2000:]))
    return failures


def out_of_scope(worktree, allowed, base):
    code, out = run(["git", "status", "--porcelain"], worktree)
    changed = [line[3:] for line in out.splitlines() if line.strip()]
    return [f for f in changed if f not in allowed and f != "node_modules"]


def call_argon(prompt, worktree, out_dir, tag, model=MODEL):
    schema_path = Path(out_dir) / "agy-author-schema.json"
    schema_path.write_text(json.dumps(SCHEMA))
    start = time.time()
    result = subprocess.run(
        ["agy", "--print", prompt, "--model", model, "--mode", "accept-edits", "--add-dir", SOURCES,
         "--json-schema", str(schema_path), "--output-format", "json", "--print-timeout", "0"],
        cwd=worktree, capture_output=True, text=True,
    )
    (Path(out_dir) / f"{tag}.raw.json").write_text(result.stdout)
    (Path(out_dir) / f"{tag}.err.txt").write_text(result.stderr[-4000:])
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"status": "BAD_OUTPUT", "error": (result.stderr or result.stdout)[-800:],
                "seconds": round(time.time() - start)}
    return {"status": data.get("status"), "report": data.get("structured_output"), "usage": data.get("usage"),
            "seconds": round(time.time() - start), "conversation": data.get("conversation_id")}


def process(file, first_prompt, args, stage):
    tag = stage + "-" + re.sub(r"[^A-Za-z0-9]+", "-", file.split("curriculum/")[-1])
    calls, prompt = [], first_prompt
    failures = []
    for attempt in range(3):  # the first pass, then up to two rounds on check failures
        call = call_argon(prompt, args.worktree, args.out, f"{tag}-a{attempt}", args.model)
        calls.append(call)
        # A dropped stream can end an otherwise finished turn with status ERROR; the edits are on disk, so the
        # checks and Claude's review decide. Anything else (for example a quota error) stops this lesson.
        raw = (Path(args.out) / f"{tag}-a{attempt}.raw.json").read_text()
        if call["status"] != "SUCCESS" and "stream was interrupted" not in raw:
            return {"file": file, "state": "argon-failed", "calls": calls}
        with GIT_LOCK:  # the checks read the shared tree
            failures = gates(args.worktree, file)
        if not failures:
            break
        prompt = (f"You edited {file}, and the automated checks failed. Edit ONLY this file to fix them, without "
                  "removing any content. You cannot run shell commands; the checks run again when you finish.\n\n"
                  + "\n\n".join(failures))
    code, stat = run(["git", "diff", "--numstat", args.base, "--", file], args.worktree)
    return {"file": file, "state": "passed-checks" if not failures else "checks-failing",
            "failures": failures, "numstat": stat.strip(), "calls": calls,
            "report": next((c["report"] for c in reversed(calls) if c.get("report")), None)}


def commit_and_push(args, files, message):
    run(["git", "add", "--", *files], args.worktree)
    code, _ = run(["git", "diff", "--cached", "--quiet"], args.worktree)
    if code == 0:
        return "nothing to commit"
    run(["git", "commit", "-q", "--no-verify", "-m",
         message + "\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"], args.worktree)
    code, out = run(["git", "push", "-q", "-u", "origin", "HEAD"], args.worktree)
    return "pushed" if code == 0 else "push failed: " + out[-300:]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["author", "polish", "fix"])
    parser.add_argument("--worktree", required=True)
    parser.add_argument("--base", required=True)
    parser.add_argument("--extra", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--plans")
    parser.add_argument("--findings")
    parser.add_argument("--round", type=int, default=0)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--model", default=MODEL, help="any model from `agy models`; Argon needs AI credits, Flash does not")
    parser.add_argument("--catalog", help="author mode: catalog JSON; makes Argon audit the lesson itself first")
    args = parser.parse_args()
    Path(args.out).mkdir(parents=True, exist_ok=True)
    context = shared_context(args.worktree, Path(args.extra).read_text()) + "\n" + ARGON_LESSONS
    catalog = f"\nCATALOG: {Path(args.catalog).read_text()[:45000]}" if args.catalog else ""
    audit = AUDIT if args.catalog else ""
    no_shell = ("You have file read, search and edit tools but NO shell: do not try to run commands. A driver runs "
                "check-mdx --render and the diagram-kit check when you finish and gives you any failures. The primary "
                f"sources are in {SOURCES}. RETURN file, added (one line per change), skipped (with reason).")
    prompts = {}
    if args.mode == "author":
        stage = "author"
        for file, plan in json.loads(Path(args.plans).read_text()).items():
            prompts[file] = (
                f"{context}\n\nYou are the visual author for {file}. Edit ONLY this file. Implement the plan below "
                "(you may improve it), keeping every existing fact, example, code block, quiz question, link, heading "
                "anchor that other pages link to, the template structure and pinned elements (spine §3.5). Verify every "
                "fact a new visual shows against the primary sources or the lesson's own verified text. If an addition "
                "would need a component that does not exist, skip it and list it.\n"
                f"{audit}\nPLAN: {json.dumps(plan)[:18000]}{catalog}\n{no_shell}")
    elif args.mode == "polish":
        stage = "polish"
        for file in json.loads(Path(args.plans).read_text()):
            prompts[file] = (
                f"{context}\n\nSelf-review for {file}, which you changed since commit {args.base}. Read the whole file as a "
                "strict reviewer who assumes the author made mistakes, then fix what you find. Edit ONLY this file and "
                "remove no content.\n" + SELF_REVIEW + f"\n{no_shell}")
    else:
        stage = f"fix-r{args.round}"
        for file, findings in json.loads(Path(args.findings).read_text()).items():
            prompts[file] = (f"{context}\n\nFix round {args.round} for {file}. Edit ONLY this file. Resolve every "
                             "finding below without removing content.\nFINDINGS:\n" + "\n".join(findings)
                             + f"\n{no_shell}")
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(lambda f: process(f, prompts[f], args, stage), prompts))
    stray = out_of_scope(args.worktree, set(prompts), args.base)
    pushed = commit_and_push(args, list(prompts), f"Gemini pilot: {stage} on {len(prompts)} lesson(s), not yet reviewed clean")
    summary = {"stage": stage, "stray_files": stray, "pushed": pushed, "results": results}
    (Path(args.out) / f"{stage}.json").write_text(json.dumps(summary, indent=1))
    for r in results:
        calls = r.get("calls", [])
        print(r["file"].split("curriculum/")[-1], r["state"], "numstat", r.get("numstat"), "calls", len(calls),
              "seconds", sum(c.get("seconds", 0) for c in calls),
              "input_tokens", sum((c.get("usage") or {}).get("input_tokens", 0) for c in calls),
              "output_tokens", sum((c.get("usage") or {}).get("output_tokens", 0) for c in calls))
    print("stray files:", stray, "|", pushed)


if __name__ == "__main__":
    main()
