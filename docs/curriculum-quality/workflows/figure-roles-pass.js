export const meta = {
  name: 'figure-roles-pass',
  description: 'Per-lesson figure colour pass for diagram-kit figures: assign design and testbench roles to neutral diagram parts where the lesson makes the meaning certain, with an independent review of every lesson and a cross-lesson consistency check',
  phases: [
    { title: 'Tooling', detail: 'kinds whose side a role may override, a legend that lists every colour in use, then an independent closing check', model: 'opus' },
    { title: 'Assign', detail: 'one agent per lesson assigns roles; a guard proves no word or coordinate changed', model: 'opus' },
    { title: 'Review', detail: 'independent read-only review per lesson in both themes; fixes and a recheck where needed', model: 'opus' },
    { title: 'Consistency', detail: 'the same part gets the same role across lessons', model: 'opus' },
  ],
}

// TEMPLATE. Before running, replace every __NAME__ placeholder:
//   __ROOT__      the repository checkout            __SRC__       the folder with the standards' text (never committed)
//   __UVM_HOME__  the uvm-core 1800.2-2020 release   __OUT__, __WT__, __SCR__  scratch folders outside the repository
//   __ROUND__, __KNOWN__, __BATCHES__, __META__, __LESSONS__, __LABEL__, __DO_TOOLING__, __KINDS__  run data (JSON literals)
// See RESTART.md ("Start here") for the order of work and the measured costs.

const WT = __WT__
const SCR = __SCR__
const MAIN = '__ROOT__'
const LESSONS = __LESSONS__
const LABEL = __LABEL__
const DO_TOOLING = __DO_TOOLING__
const OUT = `${SCR}/figures/roles`

const BASE = `You work ONLY inside the git worktree ${WT} (branch figures/colour-2026-11-15, a copy of the repository). The real checkout at ${MAIN} is busy with other workflows: never write to it and never touch its dev server on port 3000.
SAFETY: the worktree's node_modules is a symlink to the shared copy. NEVER run next build, npm run build, cf:build, npm ci or npm install in the worktree. Do not run the Playwright test runner. Do not commit, push, stash, reset or switch branches; leave your changes uncommitted. Never edit TASKS.md.
A dev server for the worktree runs on http://localhost:3210. Use it with standalone node Playwright scripts: NODE_PATH=${MAIN}/node_modules node your-script.cjs (working examples are in ${SCR}/figures/build/, ${SCR}/figures/fix/ and ${OUT}/). The first visit to a page compiles it and can take a minute; use generous timeouts and retry once. Do not restart the server unless port 3210 does not answer; then start it from the worktree with: nohup npx next dev -p 3210 > ${SCR}/figures/build-dev.log 2>&1 &
The site sets its theme with next-themes (localStorage key "theme", values "dark" and "light", applied as a data-theme attribute).
The contract is ${WT}/docs/planning/site-design-refresh-2026-11-10/DESIGN.md section 13 "Figures", above all its part "Assigning roles in lessons"; the protected colour meanings are in ${WT}/docs/visual-learning/visual-language.md (slate = 0, cyan = 1 and active, rose = X and mismatch, amber = Z and testbench, violet = design, indigo = multi-bit, teal = expected, emerald = match; every encoding keeps a non-colour cue). Read both before you start.
The owner's request, in their words: "many graphs, visuals, block diagrams, illustrations are pretty bland with no color just black an white with very less color. make it more visually appealing without losing functionality add some color to it when feasible and makes sense. add color and be mindful of both light and dark theme ... make it colorful, functional and aesthetic."
Hard rules: colour carries the visual language's meaning, never decoration; no change to any figure's words or geometry; every colour statement in a caption or in lesson prose stays true; lesson text gets no styling classes.
Write plainly in your report: short sentences, what you did, what you left and why.`

const FINDINGS = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['S1', 'S2', 'S3'] }, where: { type: 'string' }, what: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'where', 'what', 'fix'] } },
  },
  required: ['summary', 'findings'],
}
const material = r => (r ? r.findings.filter(f => f.severity === 'S1' || f.severity === 'S2') : [{ severity: 'S2', where: 'agent', what: 'returned nothing', fix: 'rerun' }])

let tooling = null
if (DO_TOOLING) {
  phase('Tooling')
  const FOLLOW = `The Tier 3 and Tier 4 pass has just added role: "design" or role: "testbench" to 264 neutral diagram parts in 40 lessons (committed). Its reviewers found two things that a roles-only pass could not fix, because both sit in the kit:
(1) Some kinds are used on both sides. kind "fifo" draws as testbench (amber, FIFO tag), which is right for a mailbox, a uvm_tlm_fifo or an analysis FIFO, but lessons also use it for RTL buffers inside a design block: content/curriculum/T3_Advanced/B-AMBA-F1_Bridges_and_System_Integration/index.mdx ("Blocks of an AHB-to-AXI bridge": wbuf, rbuf; "Asynchronous FIFO between the HCLK and ACLK domains": mem), content/curriculum/T3_Advanced/B-AMBA-F3_Interview_Debug_Clinic/index.mdx ("A 4-master, 2-slave AXI interconnect, by function": the W router; "An AHB-to-AXI write bridge": the write-data FIFO) and content/curriculum/T3_Advanced/B-AXI-4_AXI_Expert_Features_Cache_Atomics/index.mdx (the write buffer and the interconnect buffer in three figures). There the screen now says an RTL buffer belongs to the testbench, which is wrong. A role that disagrees with a tagged kind is a data error today, so the lessons cannot correct it.
(2) A part coloured by a role has no legend entry, so a reader cannot look up what its colour means (for example content/curriculum/T3_Advanced/A-UVM-4B_Advanced_RAL_Techniques/frontdoor-vs-backdoor.mdx, "Built-in backdoor versus user backdoor": key_bkdr is amber and the legend has no amber swatch). An earlier review removed the legend entry for roles because it read "design (DUT)" and so called bus blocks the DUT.`
  const follow = await agent(`${BASE}

YOUR TASK (kit follow-up). ${FOLLOW}
Lead decisions, which you implement:
A. Audit first. Write a script under ${OUT}/kinds/ that lists every node, container and participant with a tagged kind in all 112 lessons (lesson, figure title, kind, label, sublabel) into ${OUT}/kinds/kinds.json, and from it find the kinds that lessons use for parts on the other side from the kit's default (read the lesson's words for the doubtful ones). Expect "fifo" (RTL buffers), and check "reg" (a hardware register, as against the register model) and "model". Report the counts per kind and the list of parts whose default side is wrong.
B. Side-overridable kinds. For the kinds your audit shows are used on both sides (and only those), a role may override the side: the part keeps its tag and all its text and geometry, and takes the fill, stroke and corner shape of the role. Every other kind keeps today's rule (a disagreeing role is a data error). Keep one exported list of these kinds and use it in the layout's data errors, scripts/check-mdx.mjs, figure-guard.py and figure-scan.py.
C. The legend lists every colour in use. The legend is the kit's own key, not lesson text, so it may gain entries; it must never mislabel. Its role entries become plain words that are true of every part they cover: "design" and "testbench" (not "design (DUT)": a dut node already carries its DUT tag), listed when any part has that effective role, whether from its kind or from a role; "interface" and "register model" as today. A part whose side was overridden counts under its effective role only. Update the legend tests; add tests for a figure with only role-coloured parts, with both kinds and roles, and with an overridden fifo.
   Check in the browser, in dark and light at 1440 and 390 wide, that a legend with the extra entries wraps cleanly and nothing overlaps. List the interactive components (src/components) that render a kit diagram whose legend gains an entry, because their height may change by one legend row; do not edit them.
D. Tools. figure-guard.py accepts role on a side-overridable kind and still rejects it on any other tagged kind (add selftest cases for both). figure-scan.py lists each part of a side-overridable kind with the side it draws now, as "check the side". Both stay standard-library Python.
E. Contract. In DESIGN.md section 13 add the rule for these kinds to "Assigning roles in lessons" (a mailbox, uvm_tlm_fifo or analysis FIFO is testbench and needs no role; an RTL FIFO, buffer or queue inside a design block takes role: "design"; say the same for each other overridable kind you found), and the legend rule from C. Update docs/visual-learning/visual-language.md where it describes roles or the legend. Leave the hand-drawn (data-fig) parts of the contract and of the tools exactly as they are: they are being redesigned separately and are not in use.
F. Apply B to the three lessons named above: give each RTL buffer role: "design"; in B-AMBA-F1's "Blocks of an AHB-to-AXI bridge" the other internal blocks of the bridge may now take role: "design" too, since the lesson places them in the bridge. Run figure-guard.py --base HEAD and node scripts/check-mdx.mjs --render on each, look at the changed figures in dark and light, and save screenshots under ${OUT}/kinds/shots/.
G. Run: figure-guard.py --selftest; the guard on every lesson against HEAD; npx vitest --run tests/components/DiagramKit.test.tsx tests/components/diagram-layout.test.ts tests/lib/diagram-kit-content.test.ts tests/app/theme-contrast.test.ts (use the real paths) and the MDX render smoke test; npx tsc --noEmit; npx eslint on changed TS and MJS files. All must pass.
Report: the audit's counts and the overridable kinds with your evidence, the legend wording, the interactives whose legend changes, what you changed in the three lessons, and the test counts.`, {
    label: 'tooling:kit-follow-up', phase: 'Tooling', model: 'opus',
    schema: { type: 'object', properties: { summary: { type: 'string' }, overridableKinds: { type: 'array', items: { type: 'string' } }, interactivesAffected: { type: 'array', items: { type: 'string' } }, files: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'overridableKinds', 'interactivesAffected', 'files'] },
  })
  if (!follow) return { aborted: 'the kit follow-up returned nothing; no lesson was touched' }
  const CHECK = `${BASE}

YOUR TASK (independent closing check of a kit follow-up, READ-ONLY: edit no repository file; write only under ${OUT}/closing2/). ${FOLLOW}
A builder has just changed the kit and its tools (uncommitted; see git status and git diff in the worktree). Its report:
---
${follow.summary}
---
Trust nothing in it. Check:
1. Geometry and words of the figure itself: for six figures of your choice (two with only role-coloured parts, two with tagged kinds, the overridden fifo figures in B-AMBA-F1 and B-AXI-4), compare against git HEAD content: every node, edge and label text and position inside the drawing is identical; only fill, stroke, corner radius, the accessible description and the legend may differ. Write your own test or measure in the browser.
2. The legend: for those six figures and four more, every colour drawn on a part has a legend entry, no entry is listed for a colour that is not drawn, and no entry's words are untrue of a part it covers (an RTL buffer must not sit under "testbench"; a bus block must not be called the DUT). In dark and light at 1440 and 390 wide the legend wraps cleanly and overlaps nothing.
3. Overrides: a role overrides the side only on the kinds the builder lists (${JSON.stringify(follow.overridableKinds)}); on every other tagged kind a disagreeing role is still a data error in the layout, in scripts/check-mdx.mjs and in figure-guard.py. Is the list right? From ${OUT}/kinds/kinds.json and the lessons, look for a kind the builder missed that lessons use on both sides, and for a kind on the list that is never used on the other side.
4. The guard: run the selftest and attack the role handling again on copies under ${OUT}/closing2/ (role on an overridable kind passes; on another kind fails; a changed label in the same edit fails; a changed kind fails; a role on an edge, port or message fails).
5. The three lessons the builder edited: each role is right for AMBA and certain from the lesson's words; nothing else changed.
6. Run the guard on every lesson against HEAD, the kit tests, the MDX render smoke test, npx tsc --noEmit. Report counts.
7. DESIGN.md section 13 and visual-language.md state the new rules without contradicting themselves, and the hand-drawn parts were left as they were.
Severity: S1 = a wrong meaning on screen, or the drawing's words or geometry changed; S2 = material (a legend gap or untrue entry, a missed or wrong kind, a guard hole, a contradictory rule); S3 = small. Give where, what, evidence and a concrete fix.`
  let check = await agent(CHECK, { label: 'tooling:closing-check', phase: 'Tooling', model: 'opus', schema: FINDINGS })
  let rounds = 0
  while (check && check.findings.length > 0 && rounds < 2) {
    rounds++
    await agent(`${BASE}

YOUR TASK (fixer for the kit follow-up). ${FOLLOW}
A builder implemented side-overridable kinds and a legend that lists every colour in use; an independent check found the items below. Fix every S1 and S2, and each S3 unless it risks a passing test. Leave the hand-drawn (data-fig) code and rules alone. Then rerun: figure-guard.py --selftest; the guard on every lesson against HEAD; the kit tests, the theme-contrast test and the MDX render smoke test; npx tsc --noEmit; eslint on changed files.
Findings (JSON):
${JSON.stringify(check.findings, null, 1)}
Report what you changed per finding and what you left with the reason.`, { label: `tooling:fix:r${rounds}`, phase: 'Tooling', model: 'opus', schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] } })
    check = await agent(`${CHECK}

This is recheck round ${rounds}. A fixer has addressed these earlier findings; confirm each is resolved, with evidence, and run the whole check again for anything new:
${JSON.stringify(check.findings.map(f => `${f.severity} ${f.where}: ${f.what}`), null, 1)}`, { label: `tooling:recheck:r${rounds}`, phase: 'Tooling', model: 'opus', schema: FINDINGS })
  }
  tooling = { followUp: follow.summary, overridableKinds: follow.overridableKinds, interactivesAffected: follow.interactivesAffected, rounds, open: check ? check.findings.map(f => `${f.severity} ${f.where}: ${f.what}`) : ['closing check returned nothing'] }
  if (!check || material(check).length > 0) {
    return { aborted: 'the kit follow-up did not pass its closing check; the lesson pass did not start', tooling }
  }
}
const KINDS = tooling ? tooling.overridableKinds : __KINDS__

const slug = f => f.replace(/^content\/curriculum\//, '').replace(/\.mdx$/, '').replace(/\//g, '__')

const LESSON_RULES = lesson => `The lesson is ${WT}/${lesson}. You may edit only that file, and only by adding the roles the contract allows; every other file is frozen.
Tools, run from the worktree:
- python3 docs/curriculum-quality/workflows/figure-scan.py ${lesson}   lists every figure with its line range and what a colour pass could do, and WARNS when a caption or neighbouring sentence names a colour.
- python3 docs/curriculum-quality/workflows/figure-guard.py --base HEAD ${lesson}   passes only if nothing but allowed roles changed. It must pass.
- node scripts/check-mdx.mjs --render ${lesson}   must report 0 errors.
Reading: you do not need to read the whole lesson. Read each figure, the section it sits in, and search the lesson for a part's name when you need the lesson's own words about it.
What a role is:
- Diagram kit figures (ArchitectureDiagram, SequenceDiagram): a node, container or participant of generic kind may take role: "design" or role: "testbench". A part whose kind is one of ${JSON.stringify(KINDS)} draws on that kind's default side (a mailbox, uvm_tlm_fifo or analysis FIFO is testbench); when the lesson's words put that part on the other side (an RTL FIFO, buffer or queue inside a design block; a hardware register as against the register model), give it the role that says so. Never change a kind, a label, a tag or anything else: a kind adds a tag and so changes the figure's words.
- Hand-drawn <svg> figures and TimingDiagram figures are OUT OF SCOPE in this pass: do not add, change or remove any data-fig attribute and do not touch anything inside an <svg>. A later pass handles them. Check with: git diff -U0 -- ${lesson} | grep -c data-fig   (it must print 0).
When to assign: only when the lesson's own words or the figure's own labels place that part on one side, following the decision procedure in section 13 (RTL blocks, the DUT and its internals are design; UVM components, bench code, VIPs, agents and BFMs are testbench; a master or slave is design only when the lesson calls it RTL or part of the system, and testbench when it calls it a VIP, agent or BFM). A part with no side stays neutral: tools, files, people, abstract steps, the simulator, time, and anything you are not sure of. The same part gets the same role in every figure of the lesson. If a caption or sentence names a colour, it must still be true and unambiguous after your change; if a role would blur it, leave that part neutral.
The aim: a figure whose parts plainly belong to the design or the testbench is no longer drawn neutral; a figure whose parts have no side stays exactly as it is. Never colour for decoration.`

const ASSIGN_SCHEMA = {
  type: 'object',
  properties: {
    figures: { type: 'array', items: { type: 'object', properties: { figure: { type: 'string' }, lines: { type: 'string' }, assigned: { type: 'string' }, evidence: { type: 'string' }, leftNeutral: { type: 'string' } }, required: ['figure', 'assigned', 'evidence', 'leftNeutral'] } },
    rolesAdded: { type: 'integer' },
    guard: { type: 'string' },
    render: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['figures', 'rolesAdded', 'guard', 'render', 'notes'],
}

const results = await pipeline(
  LESSONS,
  ({ file: lesson, mode }) => agent(`${BASE}

YOUR TASK (role assigner for one lesson).
${LESSON_RULES(lesson)}
${mode === 'kinds' ? `SCOPE FOR THIS LESSON: its generic parts were given their roles and reviewed in an earlier pass; leave every existing role as it is. Decide only the parts whose kind is one of ${JSON.stringify(KINDS)} (the scan lists them as "check the side"), and any generic part that must change so that a figure stays consistent once such a part changes side. If the lesson has no part of those kinds, change nothing and return an empty figures list with rolesAdded 0.` : ''}
Steps: run the scan; for each ArchitectureDiagram and SequenceDiagram it lists, decide part by part and apply the roles; then run the guard and the render check and fix whatever they report (if the guard fails you changed something other than a role: undo it). Do not take screenshots; an independent reviewer will look at the page.
Return one entry per ArchitectureDiagram and SequenceDiagram the scan listed: the figure's title, its lines, what you assigned (part: role), the lesson's words that make it certain (a quotation of at most 25 words, with its line), and what you left neutral and why. Also return the number of roles added, the guard's last line and the render check's last line.`, { label: `assign:${slug(lesson)}`, phase: 'Assign', model: 'opus', schema: ASSIGN_SCHEMA }),
  async (assigned, { file: lesson, mode }) => {
    if (!assigned) return { lesson, status: 'error', note: 'assigner returned nothing' }
    if (mode === 'kinds' && assigned.rolesAdded === 0) return { lesson, status: 'unchanged', rolesAdded: 0, figures: 0, first: null, rounds: 0, open: [], s3Open: [] }
    const REVIEW = extra => `${BASE}

YOUR TASK (independent reviewer for one lesson, READ-ONLY: edit no repository file; write only under ${OUT}/lessons/${slug(lesson)}/).
${LESSON_RULES(lesson)}
An assigner has just added roles to this lesson's figures. Its record (do not trust it; check the file):
${JSON.stringify(assigned.figures, null, 1)}
Check:
1. Run git diff -- ${lesson} in the worktree, the guard and the render check. Any change other than role: "design" or role: "testbench" on a kit node, container or participant (of generic kind, or of a kind in ${JSON.stringify(KINDS)}) is S1; so is any data-fig change (git diff -U0 -- ${lesson} | grep -c data-fig must print 0).
2. Each role: is that part's side certain from the lesson's own words (find them yourself), and is it right for SystemVerilog, UVM or AMBA? A wrong side is S1; a side an expert could dispute, or one the lesson contradicts elsewhere, is S2.
3. Consistency: the same part has the same role in every figure of the lesson; a figure is not left half coloured in a way that misleads (for example the driver amber and the monitor beside it neutral). Parts that plainly have a side but were left neutral are S2 when that makes the figure misleading, S3 otherwise.
4. Captions and prose that name a colour (the scan warns about them) are still true and unambiguous.
5. Look at it: open the lesson on http://localhost:3210 in dark and in light at 1440 wide, take a screenshot of each changed figure into ${OUT}/lessons/${slug(lesson)}/ (name them <n>--dark.png and <n>--light.png) and read them: every label legible on its fill, state colours (active, error, ok) still plain where the figure uses them, nothing garish. If text contrast looks doubtful, measure it from the pixels (4.5:1 for text, 3:1 for marks).
${extra}
Severity: S1 = a wrong meaning on screen, or words or geometry changed; S2 = material, as above; S3 = small polish. Return every finding with where (figure title and line), what, evidence and a concrete fix (the exact part and role). Return an empty list when the lesson's figures are right.`
    let rev = await agent(REVIEW(''), { label: `review:${slug(lesson)}`, phase: 'Review', model: 'opus', schema: FINDINGS })
    let rounds = 0
    const first = rev ? { s1: rev.findings.filter(f => f.severity === 'S1').length, s2: rev.findings.filter(f => f.severity === 'S2').length, s3: rev.findings.filter(f => f.severity === 'S3').length } : null
    while (rev && material(rev).length > 0 && rounds < 2) {
      rounds++
      await agent(`${BASE}

YOUR TASK (fixer for one lesson's figure roles).
${LESSON_RULES(lesson)}
An independent reviewer found the items below. Fix every S1 and S2 by adding, changing or removing roles only, and each S3 unless you disagree (say why). Then run the guard and the render check; both must pass.
Findings (JSON):
${JSON.stringify(rev.findings, null, 1)}
Report what you changed per finding.`, { label: `fix:${slug(lesson)}:r${rounds}`, phase: 'Review', model: 'opus', schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] } })
      rev = await agent(REVIEW(`This is recheck round ${rounds}. A fixer has addressed these earlier findings; confirm each is resolved and look for anything new in the lines that changed:\n${JSON.stringify(rev.findings.map(f => `${f.severity} ${f.where}: ${f.what}`), null, 1)}`), { label: `recheck:${slug(lesson)}:r${rounds}`, phase: 'Review', model: 'opus', schema: FINDINGS })
    }
    const open = material(rev)
    return {
      lesson,
      status: !rev ? 'error' : open.length > 0 ? 'escalate' : rounds > 0 ? 'fixed' : 'clean',
      rolesAdded: assigned.rolesAdded,
      figures: assigned.figures.length,
      first,
      rounds,
      open: open.map(f => `${f.severity} ${f.where}: ${f.what}`),
      s3Open: rev ? rev.findings.filter(f => f.severity === 'S3').map(f => `${f.where}: ${f.what}`) : [],
    }
  },
)

phase('Consistency')
const done = results.filter(Boolean)
const critic = await agent(`${BASE}

YOUR TASK (cross-lesson consistency). All 112 lessons of the course have now had roles added to their figures by separate agents, each reviewed on its own (Tier 3 and Tier 4 in an earlier pass, which was compared across its own 40 lessons; Tier 1 and Tier 2 just now). Nobody has compared the two halves with each other, or Tier 1 and Tier 2 lessons among themselves. Work over every .mdx file under content/curriculum.
1. Write a script under ${OUT}/consistency/ that reads those files in the worktree and lists, for every kit node, container and participant: lesson, figure title, label, kind, role; Save the table as ${OUT}/consistency/${LABEL}.json.
2. From the table find: the same label (ignoring case and instance numbers) with different roles in different lessons or figures; labels that name the same thing (driver, drv, uvm_driver; DUT, design, RTL; scoreboard, scb) treated differently; one lesson that left neutral what most lessons coloured; any role value other than design or testbench.
3. Judge each difference from the lessons' own words: some are right (a master that is RTL in one lesson and a VIP in another). For each that is a real inconsistency, fix it in the lesson by changing roles only, then run python3 docs/curriculum-quality/workflows/figure-guard.py --base HEAD on the file and node scripts/check-mdx.mjs --render on it.
4. Finish by running the guard on every lesson under content/curriculum against HEAD and report its result.
Return: the number of parts with a role per kind of role, the differences you found, which you fixed (lesson, figure, part, old and new role, why), which you judged right and why, and the guard's final result.`, {
  label: `consistency:${LABEL}`, phase: 'Consistency', model: 'opus',
  schema: { type: 'object', properties: { summary: { type: 'string' }, fixed: { type: 'array', items: { type: 'string' } }, keptDifferent: { type: 'array', items: { type: 'string' } }, guard: { type: 'string' } }, required: ['summary', 'fixed', 'keptDifferent', 'guard'] },
})

const by = {}
for (const r of done) by[r.status] = (by[r.status] || 0) + 1
return { label: LABEL, tooling, byStatus: by, rolesAdded: done.reduce((n, r) => n + (r.rolesAdded || 0), 0), lessons: done, consistency: critic }
