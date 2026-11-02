#!/usr/bin/env python3
"""Write a one-round Claude review workflow for lessons Argon wrote on a worktree branch.

  make-gemini-review.py --worktree W --base COMMIT --author author.json [--failing failing.json] --out review.js

The reviewers use visual-enrichment.js's own context and lenses, so Argon's lessons face the same bar as Claude's.
failing.json maps lesson file -> the lenses still failing; without it, both lenses run. Run the result with the
Workflow tool (scriptPath), then pass its failing findings to gemini-lesson.py fix.
With --claude-fix findings.json, a Claude fixer resolves those findings first and each lesson gets up to two
fix-and-review rounds: use it when the Gemini model stops converging.
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
  phases: [{ title: 'Review', detail: 'read-only; findings go back to the Gemini fixer' }, { title: 'Fix and review', detail: 'Claude fixer plus re-review, when asked for' }],
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
const FIX_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, changed: { type: 'array', items: { type: 'string' } }, skipped: { type: 'array', items: { type: 'string' } } }, required: ['file', 'changed', 'skipped'] }
const fixPrompt = (l, findings, round) => `${CONTEXT}

Work in the worktree ${DATA.worktree}: read and edit there, and run every command there, never in another checkout. Fix round ${round} for ${l.file}. Edit ONLY this file. Another model wrote these visuals and stopped converging, so fix the cause of each finding and check the rest of the file for the same mistake. Verify each finding first; if one is wrong, say so in skipped. Compare with the base (git -C ${DATA.worktree} diff ${DATA.base} -- ${l.file}) and restore any original fact, comment, code line or log line the earlier rounds changed or dropped.
FINDINGS:
${findings.join('\n')}
VALIDATE: node scripts/check-mdx.mjs --render ${l.file} (0 errors, 0 warnings); DIAGRAM_KIT_REPORT=1 NODE_OPTIONS='--require @prisma/client' npx vitest run tests/lib/diagram-kit-content.test.ts shows no finding in ${l.file}.
RETURN file, changed, skipped.`
if (DATA.fixes) {
  phase('Fix and review')
  const out = await pipeline(DATA.lessons, async (l) => {
    let findings = DATA.fixes[l.file] || []
    let lenses = ['accuracy', 'pedagogy']
    let reviews = []
    for (let round = 1; round <= 2; round += 1) {
      const fix = await agent(fixPrompt(l, findings, round), { label: `fix:${l.file.split('/').slice(-2).join('/')}:r${round}`, phase: 'Fix and review', schema: FIX_SCHEMA })
      if (!fix) return { file: l.file, status: 'fixer-died', open: findings }
      reviews = await parallel(lenses.map((lens) => () => agent(prompt(l, lens), { label: `review:${l.file.split('/').slice(-2).join('/')}:${lens}:c${round}`, phase: 'Fix and review', schema: REVIEW_SCHEMA })))
      const failing = lenses.filter((lens, i) => !reviews[i] || !reviews[i].pass)
      if (!failing.length) return { file: l.file, status: 'clean', lastFix: fix, s3: reviews.flatMap((r) => r.findings) }
      findings = reviews.filter((r) => r && !r.pass).flatMap((r) => r.findings)
      lenses = failing
    }
    return { file: l.file, status: 'escalate', open: findings }
  })
  return out
}
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
    parser.add_argument("--claude-fix", help="findings.json: a Claude fixer resolves these before each review")
    args = parser.parse_args()
    text = SCRIPT.read_text()
    context = re.search(r"const CONTEXT = `(.*?)`\n", text, re.S).group(1)
    context = context.replace("${ROOT}", args.worktree).replace("${SRC}", SOURCES)
    results = json.loads(Path(args.author).read_text())["results"]
    failing = json.loads(Path(args.failing).read_text()) if args.failing else None
    lessons = []
    for r in results:
        lenses = failing.get(r["file"], []) if failing is not None else ["accuracy", "pedagogy"]
        if args.claude_fix:
            lenses = ["accuracy", "pedagogy"]
        if lenses:
            lessons.append({"file": r["file"], "report": r.get("report"), "lenses": lenses})
    data = {"worktree": args.worktree, "base": args.base, "round": args.round, "lessons": lessons,
            "fixes": json.loads(Path(args.claude_fix).read_text()) if args.claude_fix else None}
    script = TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False)).replace("__CONTEXT__", json.dumps(context, ensure_ascii=False))
    Path(args.out).write_text(script)
    print(args.out, len(script), "lessons", [(l["file"].split("/")[-2], l["lenses"]) for l in lessons])


if __name__ == "__main__":
    main()
