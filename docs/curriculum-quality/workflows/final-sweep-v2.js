export const meta = {
  name: 'final-sweep-v2',
  description: 'Final 6b sweep on the v2 pattern: a read-only accuracy and pedagogy review of each whole lesson, then a fix, a closing check and a delta accuracy check only for lessons that fail',
  whenToUse: 'Phase 6b, run fresh (never resume wf_010d0167-550). Build args with make-sweep-args.py, then run Workflow({scriptPath, args}).',
  phases: [
    { title: 'Review', detail: 'accuracy and pedagogy lenses over the whole lesson, read-only', model: 'opus' },
    { title: 'Fix', detail: 'only lessons with an S1 or S2; the fixer snapshots the file first; at most two rounds', model: 'opus' },
    { title: 'Closing check', detail: 'each lens verifies its own findings and the fix diff, read-only', model: 'opus' },
    { title: 'Delta check', detail: 'accuracy of everything that differs from the first snapshot, read-only', model: 'opus' },
  ],
}
// ARGS: { root, snap, label, lessons: [{ file, tier, module, title }] } from make-sweep-args.py.
// The main loop runs on Fable; every agent here names its model, so no worker inherits it.
const A = typeof args !== 'undefined' && args ? args : null
if (!A || !A.root || !A.snap || !A.lessons || !A.lessons.length) throw new Error('args must be { root, snap, label, lessons }: build them with make-sweep-args.py')
const ROOT = A.root
const SNAP = A.snap
const LABEL = A.label || 'final-sweep-v2'
const SRC = '/Users/Rakesh/.claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/sources'
const MODEL = { review: 'opus', fix: 'opus', check: 'opus', delta: 'opus' }
const MAX_FIX_ROUNDS = 2

// Shared context: the v2 CONTEXT (visual-enrichment.js CONTEXT plus make-6a-run.py QUALITY), adapted from
// "review the visuals just added" to "review the whole lesson as it stands".
const CONTEXT = `Repo ${ROOT}: Next.js curriculum site teaching SystemVerilog, UVM and AMBA from junior to expert (lessons are MDX under content/curriculum/, rendered by src/app/(learning)/curriculum/[...slug]/page.tsx with the components map in src/components/mdx/). This is the final sweep: all 112 lessons are written, enriched with visuals and reviewed, and each one now gets a fresh review of the whole lesson as it stands; only lessons that fail are fixed. DO NOT REMOVE CONTENT: you may re-flow or split paragraphs, but every correct fact, example, code block, quiz question and link stays.
House rules: docs/curriculum-quality/README.md (brief) and plan.md §4 (definition of done); the lesson's card in docs/curriculum-quality/curriculum-spine.md (module intent, must-cover, misconceptions, pinned elements §3.5, terminology §5); docs/visual-learning/visual-language.md (kit components ArchitectureDiagram / TimingDiagram / SequenceDiagram, the §7 checklist, §9 layout warnings). Lesson order and prerequisites: content/curriculum/curriculum.manifest.json. Every claim must be accurate (verify facts against the primary sources in ${SRC}/: t1_lrm_clean.txt IEEE 1800-2023, uvm_lrm.txt IEEE 1800.2-2020, ahb5.txt IHI0033C, arm_ahb.txt IHI0033B.b, arm_axi.txt IHI0022E, arm_apb.txt IHI0024C, arm_axis.txt IHI0051A; search with Python, they are long single lines). Every visual is titled and captioned, accessible (role/name, text alternative), readable at 390 px, and must teach, not decorate. Lesson text styling is automatic (docs/planning/site-design-refresh-2026-11-10/DESIGN.md section 12), so add no styling classes or wrappers of your own.
Never run git add/commit/stash/checkout/reset, generators, builds or servers. Other agents edit other lessons in parallel.
QUALITY BAR (the owner's requirements; every agent applies them):
1. Accuracy: every normative SystemVerilog, UVM or AMBA claim matches the primary sources. Cite the clause. Record uncertainty and simulator limitations instead of inventing a citation.
2. Completeness: nothing the lesson taught is lost, and every core concept has a visual.
3. Junior to expert: the core path stays readable for a junior, with depth in the expert sections, and no term is used before it is defined.
4. Visuals: they teach, not decorate; they are accessible and readable at 390 px.
5. Easy navigation: heading anchors, links, the template order and in-page reveals keep working, so a learner can find any rule again quickly.
More sources: PSS 3.0 is accellera_pss30.txt and CHI E.b is arm_chi_eb.txt in the same folder. The Accellera uvm-core 2020.3.1 reference implementation is in /Users/Rakesh/Downloads/1800.2-2020.3.1 (read-only): use it for behaviour the standard leaves to the implementation, and say so in the text. Other standards (IEEE 1801, SCE-MI, RISC-V, cocotb/pyuvm docs) via WebFetch of official pages; never invent clause numbers.`

const GUARD = (role) => `TREE RULES: ${role} Nobody runs next build, npm run build, npm run cf:build, npm ci, a dev server or the Playwright test runner (npx playwright, npm run test:e2e, or any file under tests/e2e/). Nobody commits, pushes or stashes. Nobody edits TASKS.md. The primary source texts are copyrighted: read them only where they are listed above, and never copy them into the repository beyond a short quotation with its clause number.`
const READONLY = GUARD('You are READ-ONLY: do not create, edit or delete any file in the repository.')

// From the v2 WEAK list: the defects reviewers found most often. The test rule is adapted for this sweep.
const WEAK = `- Predictions: nothing visible before the reveal (a title, caption, summary text, figure or the next sentence) gives the answer away; the prompt states every fact needed to answer; the answer, its figure and its table sit inside the same <details>.
- Raw SVG: every stroked path has fill="none"; text fits its box and the viewBox, and no line runs through it; text is about 9 px or more at 390 px (a viewBox about 340 to 360 wide with font size 10 or more); repeated spaces collapse, so do not rely on them; ids are unique; role="img" with an aria-label that matches the picture; colours work in light and dark (currentColor or the kit's classes).
- Kit diagrams: never combine numbered={true} with hand-written numbers; columnWidth is 130 or more; labels fit their nodes; a decision shows every outcome; node kinds and edge styles mean what visual-language.md says; a waveform caption states its x-axis.
- Exactness: names, values and printed strings match the lesson's own code and output; code inside a figure really produces what the figure shows; no claim goes beyond the standard (cite the clause, and say "in the Accellera reference implementation" when that is the source); literal logs and code stay verbatim, with no annotations inside them.
- Recall cards and tables state each rule exactly, with its conditions. A quiz's correct option is not always first or longest.
- A quoted <Word> inside a prop string is read as a tag by the coverage audit: write it another way.
- No repetition: do not restate a table or figure the lesson already has; place each visual before or beside the text it explains; use no term before the lesson defines it.
- Embed only components registered in src/components/mdx/lazy-mdx-interactives.ts, with props and preset ids that exist in their committed source (git show HEAD:<path>).`

const SEV = `Severity: S1 = wrong or misleading: teaches something false, a wrong answer key, code that cannot work as claimed, or a broken page or learner path. S2 = materially unclear or missing: a real defect a learner would hit, such as a wrong or unsupported citation, a must-cover item not taught, a term used before it is defined, a spoiled prediction, a contradiction with another lesson, a visual unreadable at 390 px, an accessibility failure, lost content. S3 = polish. Do not inflate polish to S2, and do not pass over a real S2. Report only real, specific, evidenced problems; no style preferences.`

const FINDING = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: ['S1', 'S2', 'S3'] },
    location: { type: 'string', description: 'section heading and line number in the lesson' },
    quote: { type: 'string', description: 'the exact lesson text at fault, quoted (or "missing: ..." for an absence)' },
    source: { type: 'string', description: 'accuracy: the source document and clause (e.g. "IEEE 1800-2023 9.4.2"), or "uvm-core 2020.3.1 <file>:<line>"; pedagogy: the spine card, house rule or linked lesson relied on' },
    problem: { type: 'string' },
    fix: { type: 'string', description: 'the exact change: replacement text, or what to insert and where' },
  },
  required: ['severity', 'location', 'quote', 'source', 'problem', 'fix'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: FINDING },
    priorNotes: {
      type: 'array',
      description: 'every earlier S3 note found for this lesson under your lens',
      items: { type: 'object', properties: { note: { type: 'string' }, stillApplies: { type: 'boolean' } }, required: ['note', 'stillApplies'] },
    },
    coverage: { type: 'string', description: 'what you read in full, and which sources and linked lessons you checked' },
  },
  required: ['findings', 'priorNotes', 'coverage'],
}
const FIX_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    snapshot: { type: 'string', description: 'the snapshot path you wrote before editing' },
    applied: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, change: { type: 'string' } }, required: ['id', 'change'] } },
    refuted: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, evidence: { type: 'string' } }, required: ['id', 'evidence'] } },
    skipped: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' } }, required: ['id', 'reason'] } },
    testsEdited: { type: 'array', items: { type: 'string' }, description: 'test files changed, each with the pinned string updated' },
    validation: { type: 'string', description: 'each command run and its result' },
  },
  required: ['file', 'snapshot', 'applied', 'refuted', 'skipped', 'testsEdited', 'validation'],
}
const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    checked: { type: 'array', items: { type: 'string' }, description: 'one line per earlier finding id: resolved, refutation accepted, or still open, with the reason' },
    open: { type: 'array', items: FINDING, description: 'findings still open (restated) and any new problem the change introduced' },
  },
  required: ['checked', 'open'],
}

const tagOf = (l) => `${l.module.split('_')[0]}/${l.file.split('/').pop().replace(/\.mdx$/, '')}`
const flat = (l) => l.file.replace(/^content\/curriculum\//, '').replace(/\.mdx$/, '').replace(/\//g, '__')
const snapOf = (l, n) => `${SNAP}/${flat(l)}.r${n}.mdx`
const serious = (fs) => (fs || []).filter((f) => f.severity === 'S1' || f.severity === 'S2')
const s3 = (fs) => (fs || []).filter((f) => f.severity === 'S3')
const show = (f) => `[${f.id}] ${f.severity} at ${f.location} - ${f.problem}\n    quote: ${f.quote}\n    source: ${f.source}\n    fix: ${f.fix}`
const list = (fs, max) => fs.map(show).join('\n').slice(0, max)
const short = (f) => `${f.id || ''} ${f.severity} ${f.location}: ${f.problem}`.trim().slice(0, 180)

const LENS = {
  accuracy: `LENS accuracy. Check every normative SystemVerilog, UVM and AMBA claim, clause citation, code sample, waveform, table, quiz answer and interactive preset in the whole lesson against the primary sources: search the source and name the clause for each rule you check; re-verify each citation the lesson gives. Code must be legal (IEEE 1800-2023, uvm-core 2020.3.1) and do what the text says; printed output must be what that code prints; signal names, directions, edges, timing, API names, order of operations and numbers must agree between text, code and figures. Where the standard is silent or tools differ, the lesson must say so (uncertainty, simulator limitations, "in the Accellera reference implementation"); never accept or propose an invented citation. Read the lessons this one links to (content/curriculum/...) and its prerequisites in the manifest: a statement that contradicts what they teach is a finding, with both locations.`,
  pedagogy: `LENS pedagogy. Check the whole lesson as a learner meets it: the four layers appear in order (Quick Take, Build Your Mental Model, Make It Work, Push Further) and are right-sized for a junior, a practitioner and an expert; prerequisites in the manifest are respected and nothing relies on a later lesson; each term is defined before it is used, with the spine §5 terminology; an example comes before the rule it illustrates; every prediction comes before its reveal and nothing gives it away; interactives and figures sit where they help and are introduced with what to try and what to notice; the level is right for the tier; the must-cover items and misconceptions on the spine card are actually taught, not just mentioned; Practice & Reinforce and References & Next Topics are present and useful; links, <NextLesson />, <BeforeYouStart />, LabLinks and interview-bank links point to the right places; nothing is duplicated or contradictory, and nothing a learner needs is missing (a step, a picture of a core concept, a worked example, a debrief); wording is plain.`,
}

const priorNotesStep = (l, lens) => {
  const tag = tagOf(l)
  const keys = lens === 'accuracy' ? `k.startswith('review:${tag}:accuracy:') or k.startswith('delta:${tag}:')` : `k.startswith('review:${tag}:pedagogy:')`
  return `EARLIER S3 NOTES. Earlier reviews left S3 notes on this lesson in the saved run journals docs/curriculum-quality/data/runs/*.json (JSON keyed by agent label, for example "review:${tag}:${lens}:r1"). Find them by searching for "${tag}" and "${l.file}": grep -l -e "${tag}" -e "${l.file}" docs/curriculum-quality/data/runs/*.json, then for example python3 -c "import json,glob; [print(f, k, json.dumps(v)[:6000]) for f in glob.glob('docs/curriculum-quality/data/runs/*.json') for k, v in json.load(open(f)).items() if ${keys}]". For each S3 note under your lens, say in priorNotes whether it still applies to the lesson as it stands; if it does, also report it in findings at its true severity.`
}

const reviewPrompt = (l, lens) => `${CONTEXT}

${READONLY}

You review ${l.file} ("${l.title}", module ${l.module}, ${l.tier}) as it stands now. Read the whole lesson, its spine card and its neighbours in the manifest.
${LENS[lens]}
Known weak points to check (reviewers found these most often):
${WEAK}
${priorNotesStep(l, lens)}
${SEV}
Each finding gives the severity, the location, the evidence (a quotation from the lesson and${lens === 'accuracy' ? ' the source and clause' : ' the rule, spine card or linked lesson it relies on'}), the problem and the exact fix.
RETURN findings (include the S3s: they are saved for later; an empty list is fine), priorNotes and coverage.`

const validate = (l, firstSnap) => `VALIDATE (run from ${ROOT}; other agents edit other lessons in parallel, so judge only what concerns your file):
- node scripts/check-mdx.mjs --render ${l.file} reports 0 errors and 0 warnings.
- DIAGRAM_KIT_REPORT=1 NODE_OPTIONS='--require @prisma/client' npx vitest run tests/lib/diagram-kit-content.test.ts shows no finding in ${l.file}.
- NODE_OPTIONS='--require @prisma/client' npx vitest run tests/qa/curriculumCoverageAudit.spec.ts names no tag or link from ${l.file}.
- Tests that pin this lesson still pass: find them with grep -rl "$(basename $(dirname ${l.file}))" tests/ --exclude-dir=e2e (also grep for the lesson's file name) and run each matching *.test.ts(x) or *.spec.ts(x) with NODE_OPTIONS='--require @prisma/client' npx vitest run <test>. Never run anything under tests/e2e/. If a test fails only because it pins a string you deliberately changed, update that string in the test and nothing else; otherwise change the lesson, not the test.
- diff -u ${firstSnap} ${ROOT}/${l.file} shows no removed correct fact, example, code line, comment, quiz question or link (only corrections, additions and re-flow).`

const fixPrompt = (l, findings, n) => `${CONTEXT}

${GUARD('You are the fixer: edit ONLY this lesson file, plus a test file that pins a string you changed.')}

Fix pass ${n} for ${l.file} ("${l.title}", ${l.tier}). FIRST snapshot it: mkdir -p ${SNAP} && cp ${ROOT}/${l.file} ${snapOf(l, n)}
Check each finding below against the source before you act on it. A finding you can show to be wrong goes in refuted with your evidence (the source and clause, or the lesson text that already answers it), and you leave that text alone. Apply the smallest correct change for every S1 and S2, and for any S3 that is a clearly correct one-line improvement; list every other S3 in skipped with the reason. Fix the cause, and check the rest of the file for the same mistake. Never remove correct content: every correct fact, example, code line, comment, log line, quiz question and link stays. Add no styling classes or wrappers. Introduce no unverified citation.
FINDINGS:
${list(findings, 14000)}
Before you return, re-check your changes against this list, because reviewers reject these every time:
${WEAK}
${validate(l, snapOf(l, 1))}
RETURN file, snapshot, applied (finding id and the change, with its heading or line), refuted (id and evidence), skipped (id and reason), testsEdited, validation.`

const fixerReport = (fix, ids) => {
  if (!fix) return 'no report'
  const keep = (xs) => xs.filter((x) => ids.includes(x.id))
  return JSON.stringify({ applied: keep(fix.applied), refuted: keep(fix.refuted), skipped: keep(fix.skipped), testsEdited: fix.testsEdited }).slice(0, 6000)
}

const checkPrompt = (l, lens, mine, fix, n) => `${CONTEXT}

${READONLY}

CLOSING CHECK ${n}, lens ${lens}, for ${l.file} ("${l.title}", ${l.tier}). A fixer has just worked on this lesson. Its snapshot from before the fix is ${snapOf(l, n)}: run diff -u ${snapOf(l, n)} ${ROOT}/${l.file}.
Your lens, for reference (in this check apply it only to your earlier findings and to the changed regions): ${LENS[lens]}
Check only two things. (1) Each of your lens's earlier findings below is resolved, correctly, against the source. Where the fixer refuted a finding, judge its evidence: accept a correct refutation; restate the finding in open if the refutation is wrong. A skipped S3 is not a failure. (2) The change introduced nothing new under your lens: check every changed or added line, and confirm no correct content was lost. Outside the changed regions raise nothing new.
${mine.length ? `YOUR EARLIER FINDINGS:\n${list(mine, 9000)}\nFIXER'S REPORT ON THEM: ${fixerReport(fix, mine.map((f) => f.id))}` : 'Your lens had no S1 or S2 here; check only (2).'}
${SEV}
RETURN checked (one line per earlier finding id) and open (findings still open, restated in full, plus any new problem; an empty list if all is well).`

const deltaPrompt = (l, prior) => `${CONTEXT}

${READONLY}

DELTA ACCURACY CHECK for ${l.file} ("${l.title}", ${l.tier}). Fixes were applied to this lesson. Run diff -u ${snapOf(l, 1)} ${ROOT}/${l.file} (the first snapshot, before any fix) and check every sentence, label, number, printed string, caption, citation and code line that differs: each is sourced and correct against the primary sources and agrees with the rest of the lesson (name the clause). Confirm no correct content was lost. Review only what that diff touches.
${prior.length ? `A fixer has worked on these earlier delta findings; verify each is resolved:\n${list(prior, 6000)}` : ''}
${SEV}
RETURN checked (one line per changed region or earlier finding) and open (problems that remain; an empty list if all is well).`

// ---- per-lesson stages ----
const LENSES = ['accuracy', 'pedagogy']
const errorOut = (st, note) => ({ ...st, status: 'error', open: [note] })

async function review(l) {
  const tag = tagOf(l)
  const st = { l, tag, rounds: 0, counter: { A: 0, P: 0 }, refuted: [], s3Open: [], open: [], findings: [], status: null }
  const rs = await parallel(LENSES.map((lens) => () => agent(reviewPrompt(l, lens), { label: `sweep-review:${tag}:${lens}`, phase: 'Review', schema: REVIEW_SCHEMA, model: MODEL.review })))
  const dead = LENSES.filter((lens, i) => !rs[i])
  if (dead.length) return errorOut(st, `the ${dead.join(' and ')} reviewer returned no result`)
  LENSES.forEach((lens, i) => {
    const p = lens === 'accuracy' ? 'A' : 'P'
    rs[i].findings.forEach((f) => { st.counter[p] += 1; st.findings.push({ ...f, id: `${p}${st.counter[p]}`, lens }) })
  })
  st.s1 = st.findings.filter((f) => f.severity === 'S1').length
  st.s2 = st.findings.filter((f) => f.severity === 'S2').length
  if (!serious(st.findings).length) return { ...st, status: 'clean', s3Open: s3(st.findings) }
  return st
}

async function fixAndClose(st) {
  if (st.status) return st
  const l = st.l
  let toFix = st.findings
  for (let n = 1; n <= MAX_FIX_ROUNDS; n += 1) {
    st.rounds = n
    const fix = await agent(fixPrompt(l, toFix, n), { label: `sweep-fix:${st.tag}:r${n}`, phase: 'Fix', schema: FIX_SCHEMA, model: MODEL.fix })
    if (!fix) return errorOut(st, `fixer r${n} returned no result`)
    const appliedIds = fix.applied.map((x) => x.id)
    st.refuted.push(...fix.refuted.map((x) => x.id))
    st.s3Open = st.s3Open.filter((f) => !appliedIds.includes(f.id))
    st.s3Open.push(...s3(toFix).filter((f) => !appliedIds.includes(f.id) && !fix.refuted.some((x) => x.id === f.id)))
    const checks = await parallel(LENSES.map((lens) => () => agent(
      checkPrompt(l, lens, serious(toFix).filter((f) => f.lens === lens), fix, n),
      { label: `sweep-check:${st.tag}:${lens}:r${n}`, phase: 'Closing check', schema: CHECK_SCHEMA, model: MODEL.check },
    )))
    const dead = LENSES.filter((lens, i) => !checks[i])
    if (dead.length) return errorOut(st, `the ${dead.join(' and ')} closing check r${n} returned no result`)
    const open = []
    LENSES.forEach((lens, i) => {
      const p = lens === 'accuracy' ? 'A' : 'P'
      checks[i].open.forEach((f) => { st.counter[p] += 1; open.push({ ...f, id: `${p}${st.counter[p]}`, lens }) })
    })
    st.s3Open.push(...s3(open))
    if (!serious(open).length) return { ...st, closed: true }
    if (n === MAX_FIX_ROUNDS) return { ...st, status: 'escalate', open: serious(open).map(short) }
    toFix = serious(open)
  }
  return st
}

async function delta(st) {
  if (st.status) return st
  const l = st.l
  let d = await agent(deltaPrompt(l, []), { label: `sweep-delta:${st.tag}:1`, phase: 'Delta check', schema: CHECK_SCHEMA, model: MODEL.delta })
  if (!d) return errorOut(st, 'the delta check returned no result')
  const ids = (fs) => fs.map((f) => { st.counter.A += 1; return { ...f, id: `A${st.counter.A}`, lens: 'accuracy' } })
  let open = ids(d.open)
  st.s3Open.push(...s3(open))
  if (!serious(open).length) return { ...st, status: 'fixed' }
  const n = st.rounds + 1
  st.rounds = n
  const fix = await agent(fixPrompt(l, serious(open), n), { label: `sweep-fix:${st.tag}:r${n}-delta`, phase: 'Fix', schema: FIX_SCHEMA, model: MODEL.fix })
  if (!fix) return errorOut(st, `fixer r${n} (delta) returned no result`)
  st.refuted.push(...fix.refuted.map((x) => x.id))
  d = await agent(deltaPrompt(l, serious(open)), { label: `sweep-delta:${st.tag}:2`, phase: 'Delta check', schema: CHECK_SCHEMA, model: MODEL.delta })
  if (!d) return errorOut(st, 'the delta recheck returned no result')
  open = ids(d.open)
  st.s3Open.push(...s3(open))
  if (serious(open).length) return { ...st, status: 'escalate', open: serious(open).map(short) }
  return { ...st, status: 'fixed' }
}

function finish(st, l) {
  const r = {
    file: l.file,
    status: st ? st.status || 'error' : 'error',
    rounds: st ? st.rounds : 0,
    s1: st && st.s1 !== undefined ? st.s1 : 0,
    s2: st && st.s2 !== undefined ? st.s2 : 0,
    s3Open: st ? st.s3Open.length : 0,
    refuted: st ? new Set(st.refuted).size : 0,
    open: st ? st.open : ['the lesson stage threw'],
  }
  log(`${tagOf(l)}: ${r.status}, ${r.rounds} fix round(s), S1 ${r.s1}, S2 ${r.s2}, S3 open ${r.s3Open}, refuted ${r.refuted}${r.open.length ? `; open: ${r.open.length}` : ''}`)
  return r
}

log(`${LABEL}: final sweep over ${A.lessons.length} lesson(s); workers ${JSON.stringify(MODEL)}; snapshots in ${SNAP}`)
const results = (await pipeline(A.lessons, (l) => review(l), (st) => fixAndClose(st), (st) => delta(st), (st, l) => finish(st, l)))
  .map((r, i) => r || finish(null, A.lessons[i]))
const byStatus = { clean: 0, fixed: 0, escalate: 0, error: 0 }
results.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1 })
log(`${LABEL} done: ${JSON.stringify(byStatus)}`)
// Compact on purpose: the journal keeps every finding, S3 list, fixer report and check (read it with wf-journal.py).
return { label: LABEL, byStatus, lessons: results.map((r) => ({ ...r, file: r.file.replace('content/curriculum/', '') })) }
