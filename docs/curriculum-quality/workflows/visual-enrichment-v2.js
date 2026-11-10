export const meta = {
  name: 'visual-enrichment-v2',
  description: 'Per-lesson visual enrichment on fixed worker models: author from the saved audit, two full review rounds, a closing verify round and a delta accuracy check',
  whenToUse: 'Phase 6a from 2026-11-10. Generate a ready-to-run copy with make-6a-run.py (arguments embedded), then run it with Workflow({scriptPath}).',
  phases: [
    { title: 'Author', detail: 'plan from the saved audit, add the visuals, self-review (no content removed)', model: 'opus' },
    { title: 'Review', detail: 'accuracy and pedagogy lenses: rounds 1 and 2 are full, the last round verifies the fixes only', model: 'opus' },
    { title: 'Fix', detail: 'resolve findings; the fixer snapshots the file first', model: 'opus' },
    { title: 'Delta check', detail: 'accuracy of everything changed after the accuracy lens last passed', model: 'opus' },
  ],
}
// DATA: { root, snapDir, maxRounds, models: { author, fix, accuracy, pedagogy, delta }, context, catalogText,
//   lessons: [{ file, module, lesson, track, plan, start: 'author' | 'fix' | 'review', startFindings, startLenses,
//               priorFindings: { <lens>: [...] }, priorReport, task }] }
// The main loop runs on Fable; every agent here names its model, so no worker inherits it.
const DATA = typeof args !== 'undefined' && args ? args : null // EMBED: make-6a-run.py replaces this line
if (!DATA || !DATA.lessons || !DATA.lessons.length) throw new Error('no lessons: generate this script with make-6a-run.py')
const M = DATA.models
const MAX = DATA.maxRounds || 3
const CONTEXT = DATA.context

const AUTHOR_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    added: { type: 'array', items: { type: 'string' } },
    skipped: { type: 'array', items: { type: 'string' } },
    validation: { type: 'string' },
    embeds: { type: 'array', items: { type: 'string' }, description: 'every interactive component tag embedded in the lesson now, with its props' },
  },
  required: ['file', 'added', 'skipped', 'validation', 'embeds'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: { pass: { type: 'boolean' }, findings: { type: 'array', items: { type: 'string' } } },
  required: ['pass', 'findings'],
}

const tag = (l) => `${l.module.split('_')[0]}/${l.lesson}`
const slug = (l) => l.file.replace(/^content\/curriculum\//, '').replace(/\.mdx$/, '').replace(/[^A-Za-z0-9]+/g, '-')
const snap = (l, n) => `${DATA.snapDir}/${slug(l)}.before-fix-${n}.mdx`
const sev = (f, levels) => levels.some((s) => String(f).trim().startsWith(s))

const WEAK = `- Predictions: nothing visible before the reveal (a title, caption, summary text, figure or the next sentence) gives the answer away; the prompt states every fact needed to answer; the answer, its figure and its table sit inside the same <details>.
- Raw SVG: every stroked path has fill="none"; text fits its box and the viewBox, and no line runs through it; text is about 9 px or more at 390 px (a viewBox about 340 to 360 wide with font size 10 or more); repeated spaces collapse, so do not rely on them; ids are unique; role="img" with an aria-label that matches the picture; colours work in light and dark (currentColor or the kit's classes).
- Kit diagrams: never combine numbered={true} with hand-written numbers; columnWidth is 130 or more; labels fit their nodes; a decision shows every outcome; node kinds and edge styles mean what visual-language.md says; a waveform caption states its x-axis.
- Exactness: names, values and printed strings match the lesson's own code and output; code inside a figure really produces what the figure shows; no claim goes beyond the standard (cite the clause, and say "in the Accellera reference implementation" when that is the source); literal logs and code stay verbatim, with no annotations inside them.
- Recall cards and tables state each rule exactly, with its conditions. A quiz's correct option is not always first or longest.
- A quoted <Word> inside a prop string is read as a tag by the coverage audit: write it another way.
- No repetition: do not restate a table or figure the lesson already has; place each visual before or beside the text it explains; use no term before the lesson defines it.
- Embed only components registered in src/components/mdx/lazy-mdx-interactives.ts, with props and preset ids that exist in their committed source (git show HEAD:<path>). Do not edit any test.`

const SEV = `Severity: S1 = teaches something false, or breaks the page. S2 = a real defect a learner would hit: a wrong or misleading detail, a spoiled prediction, a visual unreadable at 390 px, an accessibility failure, lost content. S3 = polish. Do not inflate polish to S2, and do not pass over a real S2. Write each finding as "Sev line - problem -> fix".`

const validate = (file) => `VALIDATE (run from ${DATA.root}; other agents edit other lessons in parallel, so judge only what concerns your file):
- node scripts/check-mdx.mjs --render ${file} reports 0 errors and 0 warnings.
- DIAGRAM_KIT_REPORT=1 NODE_OPTIONS='--require @prisma/client' npx vitest run tests/lib/diagram-kit-content.test.ts shows no finding in ${file}.
- NODE_OPTIONS='--require @prisma/client' npx vitest run tests/qa/curriculumCoverageAudit.spec.ts names no tag or link from ${file}.
- Tests that pin this lesson still pass: find them with grep -rl "$(basename $(dirname ${file}))" tests/ and run each with NODE_OPTIONS='--require @prisma/client' npx vitest run <test>. Never edit a test; change the lesson.
- git diff HEAD -- ${file} shows no removed fact, example, code line, comment, quiz question or link (only additions and re-flow).`

// A lesson may carry its own task (for example an embed pass) in place of the plan-and-write steps.
const STEPS = `STEP 1, plan. Read the lesson fully, its spine card in docs/curriculum-quality/curriculum-spine.md and its neighbours in the manifest. Find the text-heavy stretches (long prose with no visual, code, table or interactive) and every core concept with no picture. The AUDIT NOTES below come from an earlier read-only audit of this lesson: line numbers may have shifted, and "needs" lists interactive components that were wished for and mostly do not exist. Verify each idea and keep only what teaches. First reuse what exists (CATALOG: embed an interactive with a preset that exists, or link a practice page), then add kit diagrams, comparison tables, step reveals, predict-then-check prompts and a one-glance summary visual near Practice & Reinforce. Aim for a visual or interactive element at least every few paragraphs in teaching sections, without clutter.
STEP 2, write. Keep every existing fact, example, code block, comment, log line, quiz question, link, heading anchor that other pages link to, the template structure and the pinned elements (spine §3.5). Verify every fact a new visual shows against the primary sources or the lesson's own verified text. If an addition needs a component that does not exist, skip it and list it.`

const authorPrompt = (l) => `${CONTEXT}

You are the visual author for ${l.file} (module ${l.module}, ${l.track || 'core'}). Edit ONLY this file.
${l.task || STEPS}
STEP 3, self-review before you return, because reviewers reject these every time:
${WEAK}
${validate(l.file)}
AUDIT NOTES: ${JSON.stringify(l.plan || {}).slice(0, 16000)}
CATALOG: ${DATA.catalogText}
RETURN file, added (one line per visual, with its heading), skipped (with reason), validation (commands and results), embeds (every interactive component tag embedded in the lesson now, with its props).`

const LENS = {
  accuracy: 'LENS accuracy: every new diagram, table, waveform, interactive preset and caption must be factually correct against the primary sources and consistent with the lesson text (signal names, directions, edges and timing, API names, order of operations, numbers and printed strings). Search the sources and name the clause for each rule you check. Also confirm nothing was removed.',
  pedagogy: 'LENS pedagogy and quality: each new element must help understanding or memory at that point (not decoration or repetition), be placed before or beside the text it explains, have an accurate title and caption that does not give away a prediction, be accessible, and read well at 390 px (measure the raw SVGs: text fits its box and viewBox, about 9 px or more after scaling, no line through text). The junior path stays readable, and navigation (anchors, links, reveals) works. check-mdx --render and the diagram-kit check must be clean, and the page must not become cluttered.',
}
const reviewPrompt = (l, lens, report, prior, round, closingSnap) => `${CONTEXT}

READ-ONLY: do not create, edit or delete any file in the repository. You review the visuals just added to ${l.file} (run git diff HEAD -- ${l.file} yourself). Author's report: ${JSON.stringify(report || 'not saved; use the diff').slice(0, 3000)}
${LENS[lens]}
${closingSnap
    ? `CLOSING ROUND ${round}. Two earlier rounds reviewed the whole diff. Now (1) verify that each earlier finding below is resolved, and (2) check what the last fix changed (diff -u ${closingSnap} ${DATA.root}/${l.file}) for new problems. Outside those regions report only an S1 or a factual error you are sure of; raise no new polish.`
    : prior.length
      ? `ROUND ${round}. A fixer has worked on the earlier findings below. Verify each is resolved, then review the whole diff freshly.`
      : `ROUND ${round}: review the whole diff.`}
${prior.length ? `EARLIER FINDINGS:\n${prior.join('\n').slice(0, 9000)}` : ''}
${SEV}
RETURN pass=true only if no S1/S2 problem remains; findings (include the S3s: they are saved for later).`

const fixPrompt = (l, findings, n) => `${CONTEXT}

Fix pass ${n} for ${l.file}. Edit ONLY this file. FIRST snapshot it: mkdir -p ${DATA.snapDir} && cp ${DATA.root}/${l.file} ${snap(l, n)}
Resolve every S1 and S2 below. Apply an S3 when it is clearly right and low-risk; skip and list the rest. Verify each finding before you act on it: if one is wrong, say why in skipped and leave correct content alone. Fix the cause, and check the rest of the file for the same mistake. Remove no content: every fact, example, code line, comment, log line, quiz question and link stays.
FINDINGS:
${findings.join('\n').slice(0, 14000)}
Before you return, re-check your changes against this list, because reviewers reject these every time:
${WEAK}
${validate(l.file)}
RETURN file, added (one line per change, with its heading or line), skipped (with reason), validation, embeds (every interactive component tag embedded in the lesson now, with its props).`

const deltaPrompt = (l, fromSnap, prior) => `${CONTEXT}

READ-ONLY. Delta accuracy check for ${l.file}. Its accuracy review passed, and fixes were applied afterwards. Run diff -u ${fromSnap} ${DATA.root}/${l.file} and check every changed or added statement, label, number, printed string, caption and code line against the primary sources and the lesson's own text (name the clause). Confirm the fixes removed nothing. Review only what that diff touches.
${prior.length ? `A fixer has worked on these earlier delta findings; verify each is resolved:\n${prior.join('\n').slice(0, 6000)}` : ''}
${SEV}
RETURN pass=true only if no S1/S2 problem remains; findings.`

async function runLesson(l) {
  const out = { file: l.file, embeds: [], added: [] }
  let report = l.priorReport || null
  let fixes = 0
  const fix = async (findings, label) => {
    fixes += 1
    const r = await agent(fixPrompt(l, findings, fixes), { label: `fix:${tag(l)}:${label}`, phase: 'Fix', schema: AUTHOR_SCHEMA, model: M.fix })
    if (r) { report = { ...(report || {}), fixes: r.added }; out.embeds = r.embeds }
    return r
  }
  if (l.start === 'author') {
    report = await agent(authorPrompt(l), { label: `author:${tag(l)}`, phase: 'Author', schema: AUTHOR_SCHEMA, model: M.author })
    if (!report) return { ...out, status: 'author-failed' }
    out.added = report.added; out.embeds = report.embeds
  } else if (l.start === 'fix') {
    if (!(await fix(l.startFindings || [], 'r0'))) return { ...out, status: 'fixer-died', open: l.startFindings || [] }
  }
  let lenses = l.startLenses || ['accuracy', 'pedagogy']
  let prior = l.priorFindings || {}
  let accuracyPassedAt = null // number of fixes done when the accuracy lens last passed
  const s3 = []
  let rounds = 0
  for (let round = 1; round <= MAX; round += 1) {
    rounds = round
    const closing = round === MAX && round > 2 && fixes > 0
    const reviews = await parallel(lenses.map((lens) => () => agent(
      reviewPrompt(l, lens, report, prior[lens] || [], round, closing ? snap(l, fixes) : null),
      { label: `review:${tag(l)}:${lens}:r${round}`, phase: 'Review', schema: REVIEW_SCHEMA, model: M[lens] },
    )))
    const failing = lenses.filter((lens, i) => !reviews[i] || !reviews[i].pass)
    lenses.forEach((lens, i) => {
      if (reviews[i] && reviews[i].pass) {
        if (lens === 'accuracy') accuracyPassedAt = fixes
        s3.push(...reviews[i].findings.filter((f) => sev(f, ['S3'])))
      }
    })
    if (!failing.length) break
    const failed = lenses.map((lens, i) => ({ lens, r: reviews[i] })).filter((x) => failing.includes(x.lens))
    const open = failed.flatMap((x) => (x.r ? x.r.findings : [`S2 - the ${x.lens} reviewer returned no result: re-check the lesson under that lens`]))
    if (round === MAX) return { ...out, status: 'escalate', rounds, fixes, open, s3 }
    const passedS3 = lenses.flatMap((lens, i) => (reviews[i] && reviews[i].pass ? reviews[i].findings.filter((f) => sev(f, ['S3'])) : []))
    if (!(await fix([...open, ...passedS3], `r${round}`))) return { ...out, status: 'fixer-died', rounds, fixes, open, s3 }
    prior = {}
    failed.forEach((x) => { prior[x.lens] = x.r ? x.r.findings : [] })
    lenses = failing
  }
  if (accuracyPassedAt !== null && fixes > accuracyPassedAt) {
    const from = snap(l, accuracyPassedAt + 1)
    let d = await agent(deltaPrompt(l, from, []), { label: `delta:${tag(l)}:1`, phase: 'Delta check', schema: REVIEW_SCHEMA, model: M.delta })
    if (!d || !d.pass) {
      const open = d ? d.findings : ['S2 - the delta accuracy check returned no result: re-verify every change since the snapshot']
      if (!(await fix(open, 'delta'))) return { ...out, status: 'fixer-died', rounds, fixes, open, s3 }
      d = await agent(deltaPrompt(l, from, open), { label: `delta:${tag(l)}:2`, phase: 'Delta check', schema: REVIEW_SCHEMA, model: M.delta })
      if (!d || !d.pass) return { ...out, status: 'escalate', rounds, fixes, open: d ? d.findings : open, s3 }
    }
    s3.push(...d.findings.filter((f) => sev(f, ['S3'])))
  }
  return { ...out, status: 'clean', rounds, fixes, s3 }
}

log(`Visual enrichment v2 over ${DATA.lessons.length} lesson(s); workers: ${JSON.stringify(M)}`)
const results = (await parallel(DATA.lessons.map((l) => () => runLesson(l)))).map((r, i) => r || { file: DATA.lessons[i].file, status: 'crashed' })
const byStatus = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {})
log(`done: ${JSON.stringify(byStatus)}`)
// Compact on purpose: the lead reads details (open findings, S3 residue, reports) from the run journal with wf-journal.py.
return {
  byStatus,
  lessons: results.map((r) => ({
    file: r.file.replace('content/curriculum/', ''), status: r.status, rounds: r.rounds || 0, fixes: r.fixes || 0,
    added: (r.added || []).length,
    openS1S2: (r.open || []).filter((f) => sev(f, ['S1', 'S2'])).length, s3: (r.s3 || []).length,
  })),
}
