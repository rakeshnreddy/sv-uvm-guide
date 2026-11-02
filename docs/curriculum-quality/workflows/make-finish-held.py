#!/usr/bin/env python3
"""Write a Claude Workflow that finishes components held on a backup branch, from their saved findings.

  make-finish-held.py --worktree W --findings open-findings.json --ids a,b,c --out finish.js

W must already hold the components' files. Each component gets one fixer per round, one accuracy reviewer per data
group (what made ScenarioSorter converge), and a learning reviewer, for at most --rounds rounds. A single integrator
then registers the clean ones. Reviewers and fixers read and run everything inside W, so the main tree stays free.
"""
import argparse
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = r"""export const meta = {
  name: 'finish-held-components',
  description: 'Finish components held with open findings: fix, review per data group, register the clean ones',
  phases: [{ title: 'Finish', detail: 'fixer, per-group accuracy reviewers and a learning reviewer, per component' }, { title: 'Integrate', detail: 'one integrator registers the clean components' }],
}
const DATA = __DATA__
const CONTEXT = __CONTEXT__
const READONLY = 'You are READ-ONLY: do not create, edit or delete any file.'
const WHERE = `Work ONLY in the worktree ${DATA.worktree}: cd there first for every command, and read and edit files there, never in another checkout.`
const FIX_SCHEMA = {
  type: 'object',
  properties: {
    files: { type: 'array', items: { type: 'string' } },
    mdxUsage: { type: 'string' },
    loader: { type: 'string', description: 'the exact line for the loaders map, checked against the real export' },
    validation: { type: 'string' },
    notes: { type: 'string' },
    dataGroups: { type: 'array', items: { type: 'string' }, description: '2 to 6 independently checkable groups of rules, presets or scenarios, each naming the identifiers and the standard sections it covers' },
  },
  required: ['files', 'mdxUsage', 'loader', 'validation', 'dataGroups'],
}
const REVIEW_SCHEMA = { type: 'object', properties: { pass: { type: 'boolean' }, findings: { type: 'array', items: { type: 'string' } } }, required: ['pass', 'findings'] }
const INTEGRATE_SCHEMA = { type: 'object', properties: { registered: { type: 'array', items: { type: 'string' } }, notRegistered: { type: 'array', items: { type: 'string' } }, checks: { type: 'string' } }, required: ['registered', 'notRegistered', 'checks'] }
const validate = (c) => `VALIDATE (only your files; other fixers work in parallel, so ignore errors in files that are not yours):
- NODE_OPTIONS='--require @prisma/client' npx vitest run ${c.files.filter((f) => f.startsWith('tests/')).join(' ')}
- npx eslint ${c.files.join(' ')}
- npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E '${c.files.map((f) => f.replace(/[.]/g, '\\.')).join('|')}' must print nothing`
const fixPrompt = (c, findings, round) => `${CONTEXT}
${WHERE}
Fix round ${round} for component "${c.name}". Edit ONLY: ${c.files.join(', ')}. Earlier rounds did not converge, so fix the cause of each finding rather than its symptom, and check nearby items for the same mistake. Verify each finding before you act on it; if one is wrong, say why in notes instead of changing correct behaviour.
FINDINGS:
${findings.join('\n')}
SPEC: ${JSON.stringify(c.spec).slice(0, 8000)}
${validate(c)}
All of this component's tests must pass before you finish.
RETURN files, mdxUsage (example tags with props for each preset), loader, validation, notes, and dataGroups: split what the model teaches into 2 to 6 groups a reviewer can check on its own.`
const accuracyPrompt = (c, group, fix) => `${CONTEXT}
${WHERE}
${READONLY} Accuracy review of component "${c.name}" (files: ${c.files.join(', ')}). Review ONLY this data group: ${group}
Check every rule, label, step and explanation in the group against the primary sources (search them and name the section), and confirm the tests pin it. A wrong model teaches a wrong mental model, so any deviation is S1. Report only problems you confirmed in the sources or by running the model; mark anything else as a question at S3.
Fixer's notes: ${String(fix.notes || '').slice(0, 2000)}
RETURN pass=true only if no S1/S2 problem remains in this group; findings as "Sev file:line - problem -> fix".`
const learningPrompt = (c, fix) => `${CONTEXT}
${WHERE}
${READONLY} Learning and UX review of component "${c.name}" (files: ${c.files.join(', ')}). Fixer's notes: ${String(fix.notes || '').slice(0, 2000)}
SPEC: ${JSON.stringify(c.spec).slice(0, 8000)}
Does it teach the concept better than prose: a clear goal, a prediction before the reveal, feedback that explains why, presets that match each lesson? Check accessibility (keyboard, names, live text, focus), the 390 px layout, reduced motion, themes, performance and test quality. ${validate(c)}
RETURN pass=true only if no S1/S2 problem remains; findings as "Sev file:line - problem -> fix".`
const serious = (f) => /^\s*S[12]\b/.test(String(f))
phase('Finish')
const done = await pipeline(DATA.components, async (c) => {
  let findings = c.open
  let groups = null
  let lastFix = null
  let failingLearning = true
  let open = []
  for (let round = 1; round <= DATA.rounds; round += 1) {
    const fix = await agent(fixPrompt(c, findings, round), { label: `fix:${c.id}:r${round}`, phase: 'Finish', schema: FIX_SCHEMA })
    if (!fix) return { id: c.id, status: 'fixer-died', open: findings }
    lastFix = fix
    if (!groups) groups = fix.dataGroups
    const jobs = groups.map((g) => ({ kind: 'accuracy', g }))
    if (failingLearning) jobs.push({ kind: 'learning', g: 'learning' })
    const reviews = await parallel(jobs.map((j, i) => () => agent(
      j.kind === 'accuracy' ? accuracyPrompt(c, j.g, fix) : learningPrompt(c, fix),
      { label: `review:${c.id}:${j.kind}${j.kind === 'accuracy' ? i + 1 : ''}:r${round}`, phase: 'Finish', schema: REVIEW_SCHEMA },
    )))
    const failed = jobs.map((j, i) => ({ j, r: reviews[i] })).filter((x) => !x.r || !x.r.pass)
    const allFindings = reviews.filter(Boolean).flatMap((r) => r.findings)
    open = allFindings
    if (!failed.length) return { id: c.id, name: c.name, status: 'clean', files: c.files, fix: lastFix, s3: allFindings.filter((f) => !serious(f)) }
    groups = failed.filter((x) => x.j.kind === 'accuracy').map((x) => x.j.g)
    failingLearning = failed.some((x) => x.j.kind === 'learning')
    findings = failed.flatMap((x) => (x.r ? x.r.findings : [`S2 - the ${x.j.kind} reviewer returned no result: re-check ${x.j.g}`]))
  }
  return { id: c.id, name: c.name, status: 'escalate', files: c.files, fix: lastFix, open: findings, s3: open.filter((f) => !serious(f)) }
})
const results = done.filter(Boolean)
const clean = results.filter((r) => r.status === 'clean')
log(`clean: ${clean.map((r) => r.id).join(', ') || 'none'}; escalated: ${results.filter((r) => r.status !== 'clean').map((r) => r.id).join(', ') || 'none'}`)
phase('Integrate')
const integration = clean.length ? await agent(`${CONTEXT}
${WHERE}
You are the single integrator. Register each component below in src/components/mdx/lazy-mdx-interactives.ts (its name) and in the loaders map of src/components/mdx/LazyMdxInteractive.tsx (the fixer's loader line, checked against the real export). A component that already exists on main keeps its entry. Edit only those two files, plus tests that pin the registry (grep tests/ for lazyMdxInteractiveNames and the loaders map) if they need the new names. Then run: npx tsc --noEmit; npx eslint src/components/mdx; NODE_OPTIONS='--require @prisma/client' npx vitest run tests/components tests/lib tests/curriculum/mdx-render-smoke.test.tsx. Fix registry problems; do not change the components. If one cannot be registered, leave it out and say why.
COMPONENTS: ${JSON.stringify(clean.map((r) => ({ id: r.id, name: r.name, files: r.files, loader: r.fix.loader }))).slice(0, 20000)}
RETURN registered, notRegistered (with why), checks (commands and results).`, { label: 'integrate', phase: 'Integrate', schema: INTEGRATE_SCHEMA }) : null
return { results: results.map((r) => ({ id: r.id, status: r.status, files: r.files, mdxUsage: r.fix ? r.fix.mdxUsage : '', open: r.open || [], s3: r.s3 || [] })), integration }
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--worktree", required=True)
    parser.add_argument("--findings", required=True)
    parser.add_argument("--ids", required=True)
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    data_dir = HERE.parent / "data"
    backlog = {c["id"]: c for c in json.loads((data_dir / "components-backlog-2026-10-28.json").read_text())["components"]}
    open_by_id = {r["id"]: r.get("open", []) for r in json.loads(Path(args.findings).read_text())["results"]}
    text = (HERE / "visual-components.js").read_text()
    context = re.search(r"const CONTEXT = `(.*?)`\n", text, re.S).group(1)
    context = context.replace("${ROOT}", args.worktree).replace("${SRC}", str(Path.home() / ".claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/sources"))
    components = []
    for cid in args.ids.split(","):
        c = backlog[cid]
        components.append({"id": cid, "name": c["name"], "files": c["files"], "open": open_by_id[cid],
                           "spec": {k: c.get(k) for k in ("concept", "lessons", "spec", "modelRules", "kind", "extends")}})
    data = {"worktree": args.worktree, "rounds": args.rounds, "components": components}
    script = TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False)).replace("__CONTEXT__", json.dumps(context, ensure_ascii=False))
    Path(args.out).write_text(script)
    print(args.out, len(script), [(c["id"], len(c["open"])) for c in components])


if __name__ == "__main__":
    main()
