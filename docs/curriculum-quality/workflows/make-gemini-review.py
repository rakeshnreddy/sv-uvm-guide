#!/usr/bin/env python3
"""Write a one-round Claude review workflow for lessons Argon wrote on a worktree branch.

  make-gemini-review.py --worktree W --base COMMIT --author author.json [--failing failing.json] --out review.js

The reviewers use visual-enrichment.js's own context and lenses, so Argon's lessons face the same bar as Claude's.
failing.json maps lesson file -> the lenses still failing; without it, both lenses run. Run the result with the
Workflow tool (scriptPath), then pass its failing findings to gemini-lesson.py fix.
"""
import argparse
import json
import re
from pathlib import Path

SOURCES = str(Path.home() / ".claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/sources")
SCRIPT = Path(__file__).resolve().parent / "visual-enrichment.js"
TEMPLATE = r"""export const meta = {
  name: 'gemini-lesson-review',
  description: 'One Claude review round (accuracy and pedagogy lenses) of lessons Gemini Argon wrote on a worktree branch',
  phases: [{ title: 'Review', detail: 'read-only; findings go back to Argon for fixing' }],
}
const DATA = __DATA__
const CONTEXT = __CONTEXT__
const REVIEW_SCHEMA = {
  type: 'object',
  properties: { pass: { type: 'boolean' }, findings: { type: 'array', items: { type: 'string' } } },
  required: ['pass', 'findings'],
}
const prompt = (l, lens) => `${CONTEXT}

READ-ONLY. The lesson is in the worktree ${DATA.worktree}: read files there and run every command there (git -C, or cd first), never in another checkout. You review the visuals just added to ${l.file} (git -C ${DATA.worktree} diff ${DATA.base} -- ${l.file}). Author's report: ${JSON.stringify(l.report).slice(0, 3000)}
${lens === 'accuracy'
  ? 'LENS accuracy: every new diagram, table, waveform, interactive preset and caption must be factually correct against the primary sources and consistent with the lesson text (signal names, directions, edges/timing, API names, order of operations). Also confirm nothing was removed.'
  : 'LENS pedagogy and quality: each new element must help understanding or memory at that point (not decoration or repetition), be placed before or beside the text it explains, have an accurate title/caption that does not give away a prediction, be accessible, and read well at 390 px; check-mdx --render and the diagram-kit check must be clean; the page must not become cluttered.'}
RETURN pass=true only if no S1/S2 problem remains; findings as "Sev line - problem -> fix".`
phase('Review')
const jobs = DATA.lessons.flatMap((l) => l.lenses.map((lens) => ({ l, lens })))
const reviews = await parallel(jobs.map(({ l, lens }) => () => agent(prompt(l, lens), {
  label: `review:${l.file.split('/').slice(-2).join('/')}:${lens}:r${DATA.round}`, phase: 'Review', schema: REVIEW_SCHEMA,
})))
return jobs.map(({ l, lens }, i) => ({ file: l.file, lens, review: reviews[i] }))
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--worktree", required=True)
    parser.add_argument("--base", required=True)
    parser.add_argument("--author", required=True)
    parser.add_argument("--failing")
    parser.add_argument("--round", type=int, default=1)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    text = SCRIPT.read_text()
    context = re.search(r"const CONTEXT = `(.*?)`\n", text, re.S).group(1)
    context = context.replace("${ROOT}", args.worktree).replace("${SRC}", SOURCES)
    results = json.loads(Path(args.author).read_text())["results"]
    failing = json.loads(Path(args.failing).read_text()) if args.failing else None
    lessons = []
    for r in results:
        lenses = failing.get(r["file"], []) if failing is not None else ["accuracy", "pedagogy"]
        if lenses:
            lessons.append({"file": r["file"], "report": r.get("report"), "lenses": lenses})
    data = {"worktree": args.worktree, "base": args.base, "round": args.round, "lessons": lessons}
    script = TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False)).replace("__CONTEXT__", json.dumps(context, ensure_ascii=False))
    Path(args.out).write_text(script)
    print(args.out, len(script), "lessons", [(l["file"].split("/")[-2], l["lenses"]) for l in lessons])


if __name__ == "__main__":
    main()
