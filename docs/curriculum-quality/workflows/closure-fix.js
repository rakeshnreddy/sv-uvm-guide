export const meta = {
  name: 'closure-fix',
  description: 'Fix the cross-lesson findings the closure analysis confirmed: one fixer and one independent checker per finding, in batches that share no files',
  phases: [
    { title: 'Fix', detail: 'one fixer per confirmed finding; snapshots first; no content removed', model: 'opus' },
    { title: 'Check', detail: 'independent read-only check of each fix against the sources and both lessons; one more fix round if needed', model: 'opus' },
  ],
}

// TEMPLATE. Before running, replace every __NAME__ placeholder:
//   __ROOT__      the repository checkout            __SRC__       the folder with the standards' text (never committed)
//   __UVM_HOME__  the uvm-core 1800.2-2020 release   __OUT__, __WT__, __SCR__  scratch folders outside the repository
//   __ROUND__, __KNOWN__, __BATCHES__, __META__, __LESSONS__, __LABEL__, __DO_TOOLING__, __KINDS__  run data (JSON literals)
// See RESTART.md ("Start here") for the order of work and the measured costs.

const ROOT = '__ROOT__'
const SRC = '__SRC__'
const OUT = __OUT__
const BATCHES = __BATCHES__
const META = __META__

const BASE = `You work in the repository ${ROOT} (branch curriculum-quality-program), a course that teaches SystemVerilog, UVM and the AMBA protocols. Lessons are MDX files under content/curriculum; labs are under content/curriculum/labs; quizzes, flashcards and route data live under content and src.
A closure analysis compared the lessons with each other and walked the three learning routes. Three independent skeptics then tried to refute each finding; the ones that survived are being fixed now, one agent per finding. Other agents are fixing other findings in other files at this moment, and one more workflow is editing src/components/mdx/lazy-mdx-interactives.ts and its test.
Rules:
- Do not commit, push, stash, reset or switch branches. Never edit TASKS.md. Do not run next build, npm run build, npm ci or npm install, the Playwright test runner, or generators (npm run generate:*). Do not restart the dev server on port 3000.
- Make targeted edits only (exact replacements); never rewrite a whole file. If you must edit a file that is not named in your finding, re-read it right before each edit, because another agent may be editing another part of it.
- Remove no content. A "duplicate" finding is fixed by keeping both treatments, making them agree, saying in the secondary one which lesson owns the topic, and linking the two (the owner's standing rule is that no lesson content is removed); it is not fixed by deleting a section.
- Verify every normative claim you write against the primary sources: ${SRC}/t1_lrm_clean.txt (IEEE 1800-2023), ${SRC}/uvm_lrm.txt (IEEE 1800.2-2020), the AMBA specifications in ${SRC} (arm_apb.txt, arm_ahb.txt, ahb5.txt, arm_axi.txt, arm_axis.txt, arm_chi_eb.txt), the PSS standards there, and the uvm-core reference implementation at __UVM_HOME__/src. Quote at most a short phrase with its clause number. If the sources do not settle a point, say so in the lesson's own cautious words rather than inventing a citation.
- Lesson text takes no styling classes; keep the page standard in docs/curriculum-quality/plan.md section 1.2 and the topic ownership rule in section 1.3. Links to lessons use the form the lesson already uses.
- Write plainly in lessons and in your report: short sentences, no hype.`

const VALIDATE = `Validation, run from ${ROOT}, for the kinds of file you changed:
- a lesson .mdx: node scripts/check-mdx.mjs --render <file> (0 errors), and grep the tests for strings you changed (grep -rn "<a distinctive phrase>" tests src/lib | head) and run any test that pins them;
- quiz, flashcard, route or other data and TypeScript under src or content: npx tsc --noEmit, and npx vitest --run on the test files that cover what you changed (find them with grep);
- SystemVerilog under content/curriculum/labs or a lesson code block tagged "// compile": npm run test:sv (PATH must include $HOME/.local/verilator/bin; UVM_HOME=__UVM_HOME__); nothing that compiled before may fail now;
- a lab's README or lab.json: node scripts/check-mdx.mjs if it validates labs (run it with no file argument only if that is quick), and the lab manifest tests (grep tests for the lab id).`

const FIX_SCHEMA = { type: 'object', properties: { summary: { type: 'string' }, filesChanged: { type: 'array', items: { type: 'string' } }, validation: { type: 'string' }, notDone: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'filesChanged', 'validation', 'notDone'] }
const CHECK_SCHEMA = { type: 'object', properties: { resolved: { type: 'boolean' }, checked: { type: 'array', items: { type: 'string' } }, open: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['S1', 'S2', 'S3'] }, where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'where', 'problem', 'fix'] } } }, required: ['resolved', 'checked', 'open'] }

const special = id => (id === 'C10' ? `
This finding is about site behaviour, not lesson text: the Next and Previous links on a lesson page follow the manifest order and ignore the route the learner chose. Treat it as an engineering change. Read docs/curriculum-quality/plan.md section 1.1 (order and navigation), src/lib/learning-paths.ts, src/lib/learning-route-state.ts, src/lib/curriculum/lesson-context.ts, src/components/curriculum/LessonNextBlock.tsx, src/components/mdx/NextLesson.tsx and the tests that cover them (grep tests for "next" and "route", including tests/e2e). Choose the smallest change that makes a learner who has chosen a route follow that route from the lesson page, without changing anything for a learner with no route chosen and without breaking server rendering (the chosen route lives in the browser). Follow the React and Next.js patterns the files already use, keep it accessible, add unit tests for the new behaviour, and update any e2e spec text that the change makes untrue (do not run the Playwright runner). If the skeptics' verdicts in the finding file propose a narrower fix (for example a visible "next on your route" link beside the existing ones), prefer the narrower one. Say exactly what a learner sees before and after.` : '')

async function handle(id) {
  const m = META[id]
  const F = `${OUT}/findings/${id}.json`
  const head = `Your finding is ${id} (${m.severity}, ${m.kind}); the full record, with the three skeptics' verdicts, their evidence and any better fix they proposed, is in ${F}. Read it first. Files it names: ${JSON.stringify(m.files)} (if one of these paths does not exist, find the lesson it means).`
  let fix = await agent(`${BASE}

YOUR TASK (fixer for one finding). ${head}${special(id)}
Steps:
1. Copy every file you are about to edit to ${OUT}/snap/${id}/ (keep the relative path) before your first edit.
2. Open each passage the finding names and read the section around it. Confirm the problem is still there (another fix may have changed a file since the analysis). Check the facts against the sources yourself.
3. Decide the fix: start from the finding's proposed fix and prefer a skeptic's better fix where one is given and sound. The lesson that owns the topic keeps the full, correct treatment; the other places are made to agree with it and link to it. For a route finding (prerequisite, hand-off, practice, gap) the fix is the smallest thing that removes the gap for a learner on that route: a short bridging explanation with a link, a corrected practice list, a corrected quiz key, a reordered step; say which you chose and why.
4. Search the whole course for other places that state the same wrong thing (grep content and src) and fix those too, or list them if they belong to another finding.
5. Apply the edits. Then validate.
${VALIDATE}
6. Diff each changed file against its snapshot and confirm that only what you meant to change changed and no content was lost.
Return: what you changed in each file (old and new wording in brief), the sources you checked, the validation results with counts, the files changed, and anything you did not do with the reason.`, { label: `fix:${id}`, phase: 'Fix', model: 'opus', schema: FIX_SCHEMA })
  if (!fix) return { id, status: 'error', note: 'fixer returned nothing' }
  const CHECK = extra => `${BASE}

YOUR TASK (independent checker for one fix, READ-ONLY: edit no file; write only under ${OUT}/check/${id}/). ${head}
A fixer has changed these files: ${JSON.stringify(fix.filesChanged)}. Snapshots from before its edits are under ${OUT}/snap/${id}/. Its report (do not trust it; check the files):
---
${fix.summary}
---
Check:
1. Diff each changed file against its snapshot. Is the finding resolved in every place it named, and does the course now say one consistent thing? Search the course again for the wrong statement (grep content and src); list any place still carrying it.
2. Is every changed or new sentence correct? Check each fact against the primary sources (clause and a short phrase). Does each cited clause say what the text attributes to it?
3. Was any content lost, or any other passage, link, quiz key or code sample made untrue by the change? For a duplicate finding both treatments must still be there, agreeing and linked.
4. For a route finding: follow the route as the learner would (the outlines are in ${OUT}/outline-<route>.md) and confirm the gap is closed at the point where the learner needs it, without creating a new forward reference.
5. Rerun the validation that applies to the changed files.
${VALIDATE}
${id === 'C10' ? '6. For this engineering change: read the diff as a code reviewer. Server rendering is unaffected, a learner with no chosen route sees exactly what they saw before, the new behaviour is covered by unit tests that fail without the change, accessibility is kept, and no e2e spec now states something untrue.' : ''}
${extra}
Set resolved to true only if nothing S1 or S2 is open. Severity: S1 = something wrong is still (or newly) told to the learner, or a gate fails; S2 = material (the finding only partly fixed, a place missed, content lost, a new inconsistency); S3 = small. Give where, the problem and a concrete fix for each.`
  let check = await agent(CHECK(''), { label: `check:${id}`, phase: 'Check', model: 'opus', schema: CHECK_SCHEMA })
  let rounds = 0
  const serious = c => (c ? c.open.filter(o => o.severity !== 'S3') : [{ severity: 'S2', where: 'checker', problem: 'returned nothing', fix: 'rerun' }])
  while (serious(check).length > 0 && rounds < 2) {
    rounds++
    const again = await agent(`${BASE}

YOUR TASK (second fixer for one finding). ${head}${special(id)}
A first fixer changed ${JSON.stringify(fix.filesChanged)} (snapshots of the originals are under ${OUT}/snap/${id}/; do not overwrite them; snapshot any further file you edit to ${OUT}/snap/${id}/). An independent checker found that the fix is not yet right:
${JSON.stringify(check ? check.open : [], null, 1)}
Resolve every S1 and S2, and each S3 unless you disagree (say why). Follow the same rules. Then validate.
${VALIDATE}
Return what you changed, the files changed in total (first fixer's and yours), the validation results, and anything not done.`, { label: `fix:${id}:r${rounds + 1}`, phase: 'Fix', model: 'opus', schema: FIX_SCHEMA })
    if (again) fix = { ...again, filesChanged: Array.from(new Set([...fix.filesChanged, ...again.filesChanged])) }
    check = await agent(CHECK(`This is recheck round ${rounds}. The earlier open items were:\n${JSON.stringify(check ? check.open.map(o => `${o.severity} ${o.where}: ${o.problem}`) : [], null, 1)}\nConfirm each is resolved and check everything again.`), { label: `check:${id}:r${rounds + 1}`, phase: 'Check', model: 'opus', schema: CHECK_SCHEMA })
  }
  const open = serious(check)
  return { id, severity: m.severity, kind: m.kind, status: open.length ? 'escalate' : rounds ? 'fixed-after-recheck' : 'fixed', rounds, filesChanged: fix.filesChanged, notDone: fix.notDone, open: open.map(o => `${o.severity} ${o.where}: ${o.problem}`), small: check ? check.open.filter(o => o.severity === 'S3').map(o => `${o.where}: ${o.problem}`) : [] }
}

const results = []
for (let b = 0; b < BATCHES.length; b++) {
  phase('Fix')
  const rs = await parallel(BATCHES[b].map(id => () => handle(id)))
  rs.forEach((r, i) => results.push(r || { id: BATCHES[b][i], status: 'error', note: 'handler failed' }))
  log(`batch ${b + 1}/${BATCHES.length}: ${rs.filter(r => r && r.status.startsWith('fixed')).length} fixed, ${rs.filter(r => r && r.status === 'escalate').length} escalated, ${rs.filter(r => !r || r.status === 'error').length} errors`)
}
const by = {}
for (const r of results) by[r.status] = (by[r.status] || 0) + 1
const files = Array.from(new Set(results.flatMap(r => r.filesChanged || []))).sort()
return { byStatus: by, results, files }
