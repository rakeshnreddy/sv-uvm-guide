#!/usr/bin/env python3
"""Write a Claude Workflow that finishes components held with open findings.

  make-finish-held.py --worktree W --ids a,b,c --out finish.js --findings open-findings.json
      Fresh pass: a fixer works from each id's open findings and names the data groups; every group is reviewed.
  make-finish-held.py --worktree W --ids a,b,c --out finish.js --resume cloud-r1.json --base COMMIT
                      [--fix-done a,b] [--mid-edit c]
      Resume after a review round: only the data groups (and the learning lens) that failed in the saved reviews are
      reviewed again. --fix-done ids already hold the next fix, so they start at review; --mid-edit ids had a fixer
      stopped partway. COMMIT is the state the saved reviews saw, the base of the final regression check.

  make-finish-held.py --worktree W --ids a,b,c --out build.js --build
      Build new components from their backlog specs: a builder first, then every data group is reviewed. The ids
      must not share a file. The regression check covers what changed after the first full review.

W must already hold the components' files (a worktree from origin/main plus the held files). Per component: one fixer
per round, one accuracy reviewer per failing data group (what made ScenarioSorter converge) and a learning reviewer,
for at most --rounds rounds, then a regression check of everything changed since the base. A single integrator then
registers the clean ones. Fixers and reviewers run on Opus and the integrator on Sonnet; the lead stays on Fable.
"""
import argparse
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = r"""export const meta = {
  name: 'finish-held-components',
  description: 'Build or finish interactive components on fixed worker models: build or fix, review each data group, regression-check, register the clean ones',
  phases: [
    { title: 'Finish', detail: 'builder or fixer, per-group accuracy reviewers and a learning reviewer, per component', model: 'opus' },
    { title: 'Regression', detail: 'everything changed since the last whole-component review still agrees with the sources', model: 'opus' },
    { title: 'Integrate', detail: 'one integrator registers the clean components', model: 'sonnet' },
  ],
}
const DATA = __DATA__
const CONTEXT = __CONTEXT__
const M = DATA.models
const READONLY = 'You are READ-ONLY: do not create, edit or delete any file.'
const WHERE = `Work ONLY in the worktree ${DATA.worktree}: cd there first for every command, and read and edit files there, never in another checkout.`
const SEV = 'Severity: S1 = the model or its text teaches something false. S2 = a real defect a learner would hit. S3 = polish. Do not inflate polish to S2, and do not pass over a real S2. Write each finding as "Sev file:line - problem -> fix".'
const FIX_PROPS = {
  files: { type: 'array', items: { type: 'string' } },
  mdxUsage: { type: 'string' },
  loader: { type: 'string', description: 'the exact line for the loaders map, checked against the real export' },
  validation: { type: 'string' },
  notes: { type: 'string' },
  dataGroups: { type: 'array', items: { type: 'string' }, description: '2 to 6 independently checkable groups of rules, presets or scenarios, each naming the identifiers and the standard sections it covers' },
}
const FIX_SCHEMA = { type: 'object', properties: FIX_PROPS, required: ['files', 'mdxUsage', 'loader', 'validation', 'notes'] }
const BUILD_SCHEMA = { type: 'object', properties: FIX_PROPS, required: ['files', 'mdxUsage', 'loader', 'validation', 'notes', 'dataGroups'] }
const REVIEW_SCHEMA = { type: 'object', properties: { pass: { type: 'boolean' }, findings: { type: 'array', items: { type: 'string' } } }, required: ['pass', 'findings'] }
const INTEGRATE_SCHEMA = { type: 'object', properties: { registered: { type: 'array', items: { type: 'string' } }, notRegistered: { type: 'array', items: { type: 'string' } }, checks: { type: 'string' } }, required: ['registered', 'notRegistered', 'checks'] }
const sev = (f, levels) => levels.some((s) => String(f).trim().startsWith(s))
const snapDir = (c, n) => `${DATA.snapDir}/${c.id}/before-fix-${n}`
const snapCmd = (c, n) => `for f in ${c.files.join(' ')}; do mkdir -p "${snapDir(c, n)}/$(dirname $f)"; cp "$f" "${snapDir(c, n)}/$f" 2>/dev/null; done`
const snapDiff = (c, n) => `for f in ${c.files.join(' ')}; do diff -u "${snapDir(c, n)}/$f" "$f"; done`
const validate = (c) => `VALIDATE (only your files; other agents work on other components in parallel, so ignore errors in files that are not yours):
- NODE_OPTIONS='--require @prisma/client' npx vitest run ${c.files.filter((f) => f.startsWith('tests/')).join(' ')}
- npx eslint ${c.files.join(' ')}
- npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E '${c.files.map((f) => f.replace(/[.]/g, '\\.')).join('|')}' must print nothing`
const TRAPS = `- Every sentence the component can show is generated from the model's result or pinned to it by a test, so text and model cannot disagree.
- Edge cases (x and z, zero, negative, overflow, empty, the largest and smallest values) are handled as the standard says, or excluded with a visible note.
- No statement is stronger than the clause it cites. Where the standard leaves a choice to the tool, the text says so instead of stating one outcome.
- Numbers and strings in examples are computed by the model, not typed by hand.
- A prediction is never answered by anything visible before its reveal.`
const buildPrompt = (c) => `${CONTEXT}
${WHERE}
You are the builder for interactive component "${c.name}" (${c.spec.dimension || '2D'}, ${c.spec.kind}${c.spec.extends ? `, extends ${c.spec.extends}` : ''}). Create or edit ONLY these files: ${c.files.join(', ')}. Do not touch the shared registry files or any lesson: an integrator registers the component, and a later pass embeds it.
SPEC: ${JSON.stringify(c.spec).slice(0, 12000)}
Build it to the house standard:
- The semantics live in the pure model (no React). Implement each rule from the primary source, name its clause in a comment, and unit-test it with the clause in the test title.
- The component is a client component with a default export, named props, and one preset per lesson use. It is keyboard operable, has an accessible name and a text alternative (a live region or a described summary), respects prefers-reduced-motion, fits 390 px without sideways scroll, and works in light and dark themes. Reuse the visual-system primitives (src/components/visual-system/) the way DecisionLab, SubroutineLab and TimescaleLab do.
- Use predict-then-reveal where the spec asks for a prediction, with feedback that explains why.
- Component tests cover the interactions and the reveal behaviour, not implementation details.
- For an extension of an existing component, keep every existing preset, prop and test working: lessons already embed it.
Before you return, check what reviewers found in earlier components:
${TRAPS}
${validate(c)}
RETURN files, mdxUsage (example tags with props for each preset, and the lesson section each is for), loader (the exact line for the loaders map, in the style of the existing ones), validation, notes, and dataGroups: split what the model teaches into 2 to 6 groups a reviewer can check on its own, each naming its identifiers and the standard sections it covers.`
const fixPrompt = (c, findings, label, n, midEdit) => `${CONTEXT}
${WHERE}
Fix pass ${label} for component "${c.name}". Edit ONLY: ${c.files.join(', ')}. FIRST snapshot the files: ${snapCmd(c, n)}
${midEdit ? 'The previous fixer was stopped partway through these findings, so some are already fixed and some edits may be half-done: run the tests first, and check each finding against the current code before you change anything. ' : ''}Fix the cause of each finding rather than its symptom, and check nearby items for the same mistake. Verify each finding before you act on it; if one is wrong, say why in notes instead of changing correct behaviour. Never weaken or delete a test to make a fix pass.
FINDINGS:
${findings.join('\n').slice(0, 16000)}
SPEC: ${JSON.stringify(c.spec).slice(0, 8000)}
Before you return, re-check your changes against these:
${TRAPS}
${validate(c)}
All of this component's tests must pass before you finish.
RETURN files, mdxUsage (example tags with props for each preset), loader, validation, notes.`
const accuracyPrompt = (c, group, fix, prior, closingN) => `${CONTEXT}
${WHERE}
${READONLY} Accuracy review of component "${c.name}" (files: ${c.files.join(', ')}). Review ONLY this data group: ${group.text}
Check every rule, label, step and explanation in the group against the primary sources (search them and name the section), and confirm the tests pin it. A wrong model teaches a wrong mental model, so any deviation is S1. Report only problems you confirmed in the sources or by running the model; mark anything else as a question at S3.
${closingN && prior.length
    ? `CLOSING ROUND. Earlier rounds reviewed this group in full. Verify that each finding below is resolved, and check what the last fix changed (${snapDiff(c, closingN)}) for new problems. Outside those changes report only an S1 you confirmed by running the model.\n${prior.join('\n').slice(0, 7000)}`
    : prior.length ? `A fixer has worked on these earlier findings for this group. Verify each is resolved, then review the group freshly:\n${prior.join('\n').slice(0, 7000)}` : ''}
Builder's or fixer's notes: ${String((fix && fix.notes) || '').slice(0, 2000)}
${SEV}
RETURN pass=true only if no S1/S2 problem remains in this group; findings.`
const learningPrompt = (c, fix, prior) => `${CONTEXT}
${WHERE}
${READONLY} Learning and UX review of component "${c.name}" (files: ${c.files.join(', ')}). Builder's or fixer's notes: ${String((fix && fix.notes) || '').slice(0, 2000)}
SPEC: ${JSON.stringify(c.spec).slice(0, 8000)}
Does it teach the concept better than prose: a clear goal, a prediction before the reveal, feedback that explains why, presets that match each lesson, a path from junior to expert? Check accessibility (keyboard, names, live text, focus), the 390 px layout, reduced motion, themes, performance and test quality.
${prior.length ? `A fixer has worked on these earlier findings. Verify each is resolved, then review freshly:\n${prior.join('\n').slice(0, 7000)}` : ''}
${validate(c)}
${SEV}
RETURN pass=true only if no S1/S2 problem remains; findings.`
const regressPrompt = (c, prior, diffCmd, what) => `${CONTEXT}
${WHERE}
${READONLY} Regression check for component "${c.name}". The last review of the WHOLE component saw ${what}; since then only the failing data groups were reviewed again. Run: ${diffCmd}
For every changed rule, label, explanation, preset and test expectation, confirm against the primary sources that it is right (name the section), and that no test was weakened or deleted to make a fix pass. Then run the validation commands.
${prior.length ? `A fixer has worked on these earlier regression findings; verify each is resolved:\n${prior.join('\n').slice(0, 6000)}` : ''}
${validate(c)}
${SEV}
RETURN pass=true only if no S1/S2 problem remains; findings.`

async function finish(c) {
  const base = { id: c.id, name: c.name, files: c.files }
  let findings = c.open
  let groups = c.groups || null
  let learning = c.learning !== false
  let prior = c.prior || {}
  let fix = c.lastFix || null
  let fixes = 0
  const s3 = []
  let rounds = 0
  if (c.build) {
    fix = await agent(buildPrompt(c), { label: `build:${c.id}`, phase: 'Finish', schema: BUILD_SCHEMA, model: M.fix })
    if (!fix) return { ...base, status: 'builder-died', rounds, open: [] }
    groups = (fix.dataGroups || []).map((text, i) => ({ n: i + 1, text }))
  }
  for (let round = 1; round <= DATA.rounds; round += 1) {
    rounds = round
    if (!(round === 1 && (c.skipFirstFix || c.build))) {
      fixes += 1
      const f = await agent(fixPrompt(c, findings, `r${round}`, fixes, round === 1 && c.midEdit), { label: `fix:${c.id}:r${round}`, phase: 'Finish', schema: FIX_SCHEMA, model: M.fix })
      if (!f) return { ...base, status: 'fixer-died', rounds, open: findings }
      fix = f
      if (!groups) groups = (f.dataGroups || []).map((text, i) => ({ n: i + 1, text }))
    }
    const closingN = fixes > 0 && (DATA.closing || (round === DATA.rounds && round > 2)) ? fixes : 0
    const jobs = groups.map((g) => ({ key: `accuracy${g.n}`, kind: 'accuracy', g }))
    if (learning) jobs.push({ key: 'learning', kind: 'learning' })
    const reviews = await parallel(jobs.map((j) => () => agent(
      j.kind === 'accuracy' ? accuracyPrompt(c, j.g, fix, prior[j.key] || [], closingN) : learningPrompt(c, fix, prior[j.key] || []),
      { label: `review:${c.id}:${j.key}:r${round}`, phase: 'Finish', schema: REVIEW_SCHEMA, model: M[j.kind] },
    )))
    jobs.forEach((j, i) => { if (reviews[i] && reviews[i].pass) s3.push(...reviews[i].findings.filter((f) => sev(f, ['S3']))) })
    const failed = jobs.map((j, i) => ({ j, r: reviews[i] })).filter((x) => !x.r || !x.r.pass)
    if (!failed.length) { findings = []; break }
    findings = failed.flatMap((x) => (x.r ? x.r.findings : [`S2 - the ${x.j.key} reviewer returned no result: re-check it`]))
    if (round === DATA.rounds) return { ...base, status: 'escalate', rounds, fix, open: findings, s3 }
    groups = failed.filter((x) => x.j.kind === 'accuracy').map((x) => x.j.g)
    learning = failed.some((x) => x.j.kind === 'learning')
    prior = {}
    failed.forEach((x) => { prior[x.j.key] = x.r ? x.r.findings : [] })
  }
  // With a git base, check everything changed since it; for a fresh build, everything changed since the first full review.
  if (DATA.base || fixes > 0) {
    const diffCmd = DATA.base ? `git diff ${DATA.base} -- ${c.files.join(' ')}` : snapDiff(c, 1)
    const what = DATA.base ? `commit ${DATA.base}` : `the files as snapshotted in ${snapDir(c, 1)}`
    let g = await agent(regressPrompt(c, [], diffCmd, what), { label: `regress:${c.id}:1`, phase: 'Regression', schema: REVIEW_SCHEMA, model: M.accuracy })
    if (!g || !g.pass) {
      const open = g ? g.findings : ['S2 - the regression check returned no result: re-verify every change since the last whole-component review']
      fixes += 1
      const f = await agent(fixPrompt(c, open, 'regression', fixes, false), { label: `fix:${c.id}:regress`, phase: 'Regression', schema: FIX_SCHEMA, model: M.fix })
      if (!f) return { ...base, status: 'fixer-died', rounds, fix, open, s3 }
      fix = f
      g = await agent(regressPrompt(c, open, diffCmd, what), { label: `regress:${c.id}:2`, phase: 'Regression', schema: REVIEW_SCHEMA, model: M.accuracy })
      if (!g || !g.pass) return { ...base, status: 'escalate', rounds, fix, open: g ? g.findings : open, s3 }
    }
    s3.push(...g.findings.filter((f) => sev(f, ['S3'])))
  }
  return { ...base, status: 'clean', rounds, fix, s3 }
}

phase('Finish')
const results = (await parallel(DATA.components.map((c) => () => finish(c)))).map((r, i) => r || { id: DATA.components[i].id, status: 'crashed' })
const clean = results.filter((r) => r.status === 'clean')
log(`clean: ${clean.map((r) => r.id).join(', ') || 'none'}; not clean: ${results.filter((r) => r.status !== 'clean').map((r) => `${r.id} (${r.status})`).join(', ') || 'none'}`)
phase('Integrate')
const integration = clean.length ? await agent(`${CONTEXT}
${WHERE}
You are the single integrator. Register each component below in src/components/mdx/lazy-mdx-interactives.ts (its name) and in the loaders map of src/components/mdx/LazyMdxInteractive.tsx (the builder's loader line, checked against the real export). A component that is already registered keeps its entry. Edit only those two files, plus tests that pin the registry (grep tests/ for lazyMdxInteractiveNames and the loaders map) if they need the new names. Then run: npx tsc --noEmit; npx eslint src/components/mdx; NODE_OPTIONS='--require @prisma/client' npx vitest run tests/components tests/lib tests/curriculum/mdx-render-smoke.test.tsx. Fix registry problems; do not change the components. If one cannot be registered, leave it out and say why.
COMPONENTS: ${JSON.stringify(clean.map((r) => ({ id: r.id, name: r.name, files: r.files, loader: r.fix ? r.fix.loader : '' }))).slice(0, 20000)}
RETURN registered, notRegistered (with why), checks (commands and results).`, { label: 'integrate', phase: 'Integrate', schema: INTEGRATE_SCHEMA, model: M.integrate, effort: 'medium' }) : null
// Compact on purpose: the lead reads details (open findings, S3 residue, notes) from the run journal with wf-journal.py.
return {
  results: results.map((r) => ({ id: r.id, status: r.status, rounds: r.rounds || 0, openS1S2: (r.open || []).filter((f) => sev(f, ['S1', 'S2'])).length, s3: (r.s3 || []).length })),
  integration: integration ? { registered: integration.registered, notRegistered: integration.notRegistered, checks: String(integration.checks).slice(0, 600) } : null,
}
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--worktree", required=True)
    parser.add_argument("--ids", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--findings")
    parser.add_argument("--resume")
    parser.add_argument("--base", default="HEAD")
    parser.add_argument("--fix-done", default="")
    parser.add_argument("--mid-edit", default="")
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument("--model", default="opus")
    parser.add_argument("--build", action="store_true", help="build the ids from their backlog specs")
    parser.add_argument("--snap", help="folder outside the repo for the fixers' snapshots (default: <worktree>-snap)")
    parser.add_argument("--closing", action="store_true", help="the accuracy reviewers verify the saved findings and the last fix only; commit the worktree first")
    args = parser.parse_args()
    data_dir = HERE.parent / "data"
    backlog = {c["id"]: c for c in json.loads((data_dir / "components-backlog-2026-10-28.json").read_text())["components"]}
    text = (HERE / "visual-components.js").read_text()
    context = re.search(r"const CONTEXT = `(.*?)`\n", text, re.S).group(1)
    context = context.replace("${ROOT}", args.worktree).replace("${SRC}", str(Path.home() / ".claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/sources"))
    context += ("\nQUALITY BAR (the owner's requirements): accuracy against the primary sources with the clause named; completeness; a path from "
                "junior to expert; visuals that teach and read at 390 px; easy navigation. Record uncertainty and simulator limits rather than "
                "inventing a citation. The Accellera uvm-core 2020.3.1 reference implementation is in /Users/Rakesh/Downloads/1800.2-2020.3.1 (read-only).")
    open_by_id = {r["id"]: r.get("open", []) for r in json.loads(Path(args.findings).read_text())["results"]} if args.findings else {}
    saved = json.loads(Path(args.resume).read_text()) if args.resume else None
    fix_done, mid_edit = set(filter(None, args.fix_done.split(","))), set(filter(None, args.mid_edit.split(",")))
    components = []
    for cid in args.ids.split(","):
        c = backlog[cid]
        item = {"id": cid, "name": c["name"], "files": c["files"], "open": open_by_id.get(cid, []),
                "spec": {k: c.get(k) for k in ("concept", "lessons", "spec", "modelRules", "kind", "extends")}}
        item["spec"]["dimension"] = c.get("dimension")
        if args.build:
            item["build"] = True
        if saved:
            texts = saved["fixers"][f"fix:{cid}:r1"]["dataGroups"]
            failed = {}
            for key, review in saved["reviews"].items():
                m = re.fullmatch(rf"review:{re.escape(cid)}:(\w+):r1", key)
                if m and not review["pass"]:
                    failed[m.group(1)] = review["findings"]
            item["groups"] = [{"n": int(k[8:]), "text": texts[int(k[8:]) - 1]} for k in sorted(failed) if k.startswith("accuracy")]
            item["learning"] = "learning" in failed
            item["prior"] = failed
            item["open"] = [f for fs in failed.values() for f in fs]
            item["skipFirstFix"] = cid in fix_done
            item["midEdit"] = cid in mid_edit
            last = saved["fixers"].get(f"fix:{cid}:r2" if cid in fix_done else f"fix:{cid}:r1", {})
            item["lastFix"] = {k: last.get(k, "") for k in ("notes", "loader", "mdxUsage")}
        components.append(item)
    if args.build:
        seen = {}
        for item in components:
            for f in item["files"]:
                if f in seen:
                    raise SystemExit(f"{item['id']} and {seen[f]} share {f}: build them in separate batches")
                seen[f] = item["id"]
    data = {"worktree": args.worktree, "rounds": args.rounds, "base": None if args.build else args.base, "closing": args.closing, "components": components,
            "snapDir": args.snap or args.worktree.rstrip("/") + "-snap",
            "models": {"fix": args.model, "accuracy": args.model, "learning": args.model, "integrate": "sonnet"}}
    script = TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False)).replace("__CONTEXT__", json.dumps(context, ensure_ascii=False))
    Path(args.out).write_text(script)
    print(args.out, len(script), [(c["id"], [g["n"] for g in c.get("groups") or []], c.get("learning"), "build" if c.get("build") else "review-first" if c.get("skipFirstFix") else "fix-first", len(c["open"])) for c in components])


if __name__ == "__main__":
    main()
