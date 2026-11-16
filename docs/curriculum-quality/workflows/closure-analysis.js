export const meta = {
  name: 'closure-analysis',
  description: 'Closure analysis for the curriculum programme, read-only: walk the junior, practitioner and expert routes step by step, run cross-lesson consistency critics by topic, merge the findings and have three independent skeptics check each material one',
  phases: [
    { title: 'Routes', detail: 'extract the three routes into an outline the walkers share', model: 'sonnet' },
    { title: 'Walk', detail: 'one walker per route step: prerequisites, hand-offs, practice, gaps', model: 'opus' },
    { title: 'Critique', detail: 'one critic per topic thread across all lessons: contradictions, duplicates, broken references', model: 'opus' },
    { title: 'Merge', detail: 'merge duplicates across walkers and critics', model: 'opus' },
    { title: 'Verify', detail: 'three skeptics with different lenses per material finding; it survives if at least two fail to refute it', model: 'opus' },
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
const ROUND = __ROUND__
const KNOWN = __KNOWN__

const BASE = `You are part of the closure check of a course that teaches SystemVerilog, UVM and the AMBA protocols (repository ${ROOT}, Next.js site; lessons are MDX files under content/curriculum in four tiers: T1_Foundational, T2_Intermediate, T3_Advanced, T4_Expert; 112 lessons). Every lesson has just had its own accuracy and pedagogy review, lesson by lesson. Nobody has yet checked the lessons against each other or walked the routes a learner follows. That is this job.
READ-ONLY: edit no file in the repository. Other workflows are editing files there (placeholder heights in src/components/mdx, and a separate worktree for figures); do not run builds, generators, test runners or git commands that change anything. Write notes only under ${OUT}/ (create it if needed).
Primary sources, for checking which of two statements is right: ${SRC}/t1_lrm_clean.txt (IEEE 1800-2023), ${SRC}/uvm_lrm.txt (IEEE 1800.2-2020), the AMBA specifications (${SRC}/arm_apb.txt, arm_ahb.txt, ahb5.txt, arm_axi.txt, arm_axis.txt, arm_chi_eb.txt), the PSS standards, and the uvm-core reference implementation at __UVM_HOME__/src. Quote at most a short phrase with its clause number; never paste long passages. If the sources do not settle a point, say so; never invent a citation or a clause number.
The programme's own rules are in ${ROOT}/docs/curriculum-quality/plan.md: section 1.1 (order and navigation), 1.2 (page standard), 1.3 (topic ownership: each topic has one owning lesson, other lessons spiral back to it with a link and do not re-teach it), 1.4 (required new content). Read the parts you need.
Severity: S1 = a learner is told something wrong, or two lessons contradict each other on a fact; S2 = material: a concept used on a route before it is taught and without a link, a topic taught in full twice with no link between the two, a broken or wrong cross-reference, a term defined differently in two lessons, a promised topic that no lesson teaches; S3 = small (wording, a link that would help).
Do not report what a single-lesson review covers (a typo, a weak quiz item, one lesson's internal slip) unless it creates a cross-lesson problem. Report only what you verified by reading both places. Write plainly.`

const FINDING_ITEMS = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: ['S1', 'S2', 'S3'] },
    kind: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    where: { type: 'string' },
    quotes: { type: 'string' },
    problem: { type: 'string' },
    source: { type: 'string' },
    fix: { type: 'string' },
  },
  required: ['severity', 'kind', 'files', 'where', 'quotes', 'problem', 'fix'],
}
const FINDINGS = { type: 'object', properties: { summary: { type: 'string' }, findings: { type: 'array', items: FINDING_ITEMS } }, required: ['summary', 'findings'] }
const KNOWN_NOTE = KNOWN.length ? `\nAlready known from an earlier round and being fixed; do not report these again, report only what is new:\n${JSON.stringify(KNOWN, null, 1)}\n` : ''

phase('Routes')
const routes = await agent(`You extract data; this is a mechanical task. Repository: ${ROOT}. READ-ONLY for the repository: write only under ${OUT}/.
The site offers three learning routes (junior, practitioner, expert) defined in ${ROOT}/src/lib/learning-paths.ts (LEARNING_ROUTES), with helpers in src/lib/learning-route-state.ts, and the curriculum manifest the site generates (find it: search src/lib and content/curriculum for the generated curriculum data or manifest that maps module ids to lesson files).
Produce ${OUT}/routes.json: for each route, its id, title, stated audience and outcome, and its steps in order; for each step its id, title, milestone if any, the lesson files it takes in order (repository-relative .mdx paths; when a module ref lists lesson slugs take only those, otherwise every lesson of the module in manifest order), and its practice items (labs, quizzes, flashcard decks, pages) with the file or URL each resolves to and whether that file exists.
Resolve the data by running code, not by reading by eye: write a small script under ${OUT}/ (for example with npx tsx, which the repository has, importing LEARNING_ROUTES and the manifest) and check its output against the source for two steps by hand.
Then write, for each route, ${OUT}/outline-<route>.md: one line per lesson in route order with the step it belongs to, the lesson's title, and the "what you will learn" or equivalent summary and stated prerequisites from its frontmatter (copy them exactly; do not summarise in your own words).
Return the routes with their steps (ids, titles, lesson files, practice items) as structured data, plus any module or practice item that did not resolve.`, {
  label: 'routes:extract', phase: 'Routes', model: 'sonnet',
  schema: {
    type: 'object',
    properties: {
      routes: { type: 'array', items: { type: 'object', properties: {
        id: { type: 'string' },
        steps: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, lessons: { type: 'array', items: { type: 'string' } }, practice: { type: 'array', items: { type: 'string' } } }, required: ['id', 'title', 'lessons', 'practice'] } },
      }, required: ['id', 'steps'] } },
      unresolved: { type: 'array', items: { type: 'string' } },
    },
    required: ['routes', 'unresolved'],
  },
})
if (!routes) return { error: 'route extraction returned nothing' }

const steps = []
for (const r of routes.routes) r.steps.forEach((s, i) => steps.push({ route: r.id, index: i, total: r.steps.length, ...s }))
log(`routes: ${routes.routes.map(r => `${r.id} ${r.steps.length} steps`).join(', ')}; unresolved ${routes.unresolved.length}`)

const THREADS = [
  { id: 'scheduling', name: 'Simulation semantics: time slots, scheduling regions, delta cycles, races, blocking and nonblocking assignment, #0, program blocks, clocking-block sampling and driving, where assertions sample and report', hint: 'F3A, F3B, F3C, F4C, I-SV-4A, I-SV-4B, I-SV-5, and every later lesson that states a region or an order' },
  { id: 'types', name: 'Data types and values: 2-state and 4-state, X and Z, signedness and width rules, casting, packed and unpacked arrays, dynamic arrays, queues, associative arrays, structs, unions, enums, strings', hint: 'F2A, F2B, F1C, and every lesson that states a width, sign or X rule' },
  { id: 'procedural', name: 'Procedural code: always blocks, initial and final, tasks and functions, automatic and static lifetime, fork and join, process control, events, mailboxes, semaphores', hint: 'F2C, F2D, F3A, I-SV-5' },
  { id: 'oop', name: 'Classes: construction, handles, copying, inheritance, virtual methods, polymorphism, parameterized classes, and how UVM objects and components build on them', hint: 'I-SV-1, I-UVM-1A, I-UVM-1B, I-UVM-4' },
  { id: 'random', name: 'Constrained randomization: rand and randc, constraint blocks, solve order, distributions, soft constraints, randomize with, pre and post randomize, stability and seeding, and its use in sequences', hint: 'I-SV-2A, I-SV-2B, I-UVM-3A, I-UVM-3B, T4 debug and performance lessons' },
  { id: 'coverage', name: 'Functional coverage: covergroups, coverpoints, bins, crosses, options, sampling, coverage APIs, closure, and coverage collection in UVM', hint: 'I-SV-3A, I-SV-3B, A-UVM-6, T4 closure material' },
  { id: 'sva', name: 'Assertions: immediate, deferred and concurrent, sampled values, sequences and properties, implication, local variables, multiple clocks, disable iff, checkers, bind, and formal use', hint: 'I-SV-4A, I-SV-4B, I-SV-4C, E-INT-1' },
  { id: 'interfaces', name: 'Structure and connection: modules, packages, interfaces, modports, virtual interfaces, clocking blocks, reset handling, time units and precision', hint: 'F4A, F4B, F4C, I-UVM-2A, I-UVM-2C, A-UVM-9' },
  { id: 'uvm-core', name: 'UVM base mechanics: phases and their order, objections and end of test, reporting and verbosity, the factory and overrides, config_db and resources', hint: 'I-UVM-1A to 1D, I-UVM-2C, E-CUST-1, E-DBG-1' },
  { id: 'uvm-tlm', name: 'UVM connections and checking: TLM ports, exports and imps, analysis ports and FIFOs, monitors, scoreboards, predictors, reference models, subscribers', hint: 'I-UVM-2A, I-UVM-2B, A-UVM-6, A-UVM-8' },
  { id: 'uvm-seq', name: 'UVM stimulus: sequence items, sequences, the sequencer and driver handshake, arbitration, locks and grabs, virtual sequences and sequencers, layering, sequence libraries, interrupts, responses', hint: 'I-UVM-3A, I-UVM-3B, I-UVM-3C, A-UVM-7, A-UVM-8' },
  { id: 'ral', name: 'The register layer and callbacks: the register model, maps, adapters, prediction, mirror and desired values, front door and back door, built-in sequences, callbacks', hint: 'A-UVM-4A, A-UVM-4B, A-UVM-5' },
  { id: 'amba', name: 'AMBA protocols: APB, AHB, AXI, AXI-Stream and CHI rules as stated anywhere in the course, and the verification components built for them', hint: 'every B-* lesson, A-UVM-7, the protocol labs' },
  { id: 'expert', name: 'Tier 4 claims measured against the lower tiers: debug, methodology customization, performance, formal integration, PSS, power-aware verification, SoC strategy, emulation, pyuvm, AI-assisted verification', hint: 'every E-* lesson and I-SV-8, against the lessons they build on' },
  { id: 'terms', name: 'Terms and conventions across the whole course: one name for one thing (testbench and bench, DUT, transaction and item, checker), glossary definitions against lesson definitions, the edition cited (IEEE 1800-2023 and 1800.2-2020 everywhere), clause numbers cited for the same rule in different lessons, and topic ownership under plan section 1.3', hint: 'all tiers; the glossary and reference pages under content and src' },
]

const [walks, crits] = await parallel([
  () => parallel(steps.map(s => () => agent(`${BASE}

YOUR TASK (route walker). Walk one step of the "${s.route}" route as a learner on that route would meet it. The route's outline (every lesson in order with its stated outcomes and prerequisites) is ${OUT}/outline-${s.route}.md and the full data is ${OUT}/routes.json. Your step is number ${s.index + 1} of ${s.total}: "${s.title}" (id ${s.id}). Its lessons, in order: ${JSON.stringify(s.lessons)}. Its practice items: ${JSON.stringify(s.practice)}.
Check, for this step:
1. Prerequisites: for each lesson, list what it assumes the learner already knows (its stated prerequisites, and the constructs, terms and ideas it uses without teaching them; read its opening sections and skim the rest for first uses). For each, confirm that an earlier lesson on THIS route teaches it (check the outline, then open that lesson to make sure it really teaches it), or that the lesson links to where it is taught. Something assumed but neither taught earlier on this route nor linked is a finding.
2. Hand-offs: each lesson's ending and its "next" pointers lead to the next lesson of this route, and what the lesson promises ("you will see this in ...") is true of the lesson it names.
3. Practice: every practice item of the step exists, opens the right thing, and exercises what the step's lessons taught, with nothing it needs still untaught at this point of the route. Check lab manifests and files under content/curriculum/labs and the quiz and flashcard data; check that the URLs the route uses answer (curl -s -o /dev/null -w "%{http_code}" http://localhost:3000<path>, at most one request at a time and at most twenty in all; the server is busy, so allow 60 seconds and retry once).
4. Gaps: if the step has a milestone, is everything the milestone's lab needs taught by this point? Is there a jump in difficulty between this step and the one before it that nothing bridges?
${KNOWN_NOTE}
Return findings only for what you verified by opening both places. For each: severity, kind (prerequisite, hand-off, practice, gap), the files, where (lesson and line or heading), the words that show it (short quotations), the problem, the source if a fact is involved, and a concrete fix (which link, sentence or reordering). Return an empty list if the step is sound, and say in the summary what you checked.`, { label: `walk:${s.route}:${s.index + 1}-${s.id}`, phase: 'Walk', model: 'opus', schema: FINDINGS }))),
  () => parallel(THREADS.map(t => () => agent(`${BASE}

YOUR TASK (consistency critic for one topic thread across the whole course). Your thread: ${t.name}. Likely places: ${t.hint}; but search all four tiers, the labs and the reference pages (grep content/curriculum and content for the thread's key terms and constructs).
1. Build a table for yourself under ${OUT}/threads/${t.id}.md: every statement of fact about this thread that appears in more than one lesson, with file and line for each occurrence.
2. Find: two lessons that state different things (decide which is right from the primary sources and say what each should say); a rule stated with different clause numbers or editions in different places; a term defined differently; a topic taught in full in two lessons with no link between them, against the ownership rule in plan section 1.3; a cross-reference that names a lesson or section which does not teach what is promised, or a link whose target file or heading does not exist; a simplification in an early lesson that a later lesson contradicts without saying that it is refining it.
3. For each, read both passages in their context before you report: a statement that is qualified nearby, or that a later lesson explicitly refines, is not a contradiction.
${KNOWN_NOTE}
Return each finding with severity, kind (contradiction, citation, term, duplicate, reference, refinement), both files, where (lesson and line for each side), the two quotations, the problem, the source that settles it (clause and a short phrase), and a concrete fix for each side. Return an empty list if the thread is consistent, and say in the summary how many shared statements you compared.`, { label: `critic:${t.id}`, phase: 'Critique', model: 'opus', schema: FINDINGS }))),
])

const all = []
;(walks || []).filter(Boolean).forEach((w, i) => w.findings.forEach(f => all.push({ ...f, from: `walk:${steps[i].route}:${steps[i].id}` })))
;(crits || []).filter(Boolean).forEach((c, i) => c.findings.forEach(f => all.push({ ...f, from: `critic:${THREADS[i].id}` })))
const missing = (walks || []).filter(w => !w).length + (crits || []).filter(c => !c).length
log(`round ${ROUND}: ${all.length} raw findings (${all.filter(f => f.severity === 'S1').length} S1, ${all.filter(f => f.severity === 'S2').length} S2, ${all.filter(f => f.severity === 'S3').length} S3); ${missing} agents returned nothing`)
if (all.length === 0) return { round: ROUND, raw: 0, confirmed: [], small: [], missing, unresolvedRoutes: routes.unresolved }

phase('Merge')
const merged = await agent(`${BASE}

YOUR TASK (merge). Route walkers and topic critics worked independently and reported the findings below; several describe the same problem from different sides. Merge them into one list with no duplicates. Two findings are the same when they concern the same passages and the same problem; keep the clearest wording, the union of the files and quotations, the highest severity that the evidence supports, and every "from" tag. Do not drop a finding because you doubt it (three skeptics check each one next) and do not add new ones. Give each merged finding an id (C1, C2, ...) in order of severity. Save the merged list as ${OUT}/round${ROUND}-merged.json as well as returning it.
Findings (JSON):
${JSON.stringify(all, null, 1)}`, {
  label: 'merge:findings', phase: 'Merge', model: 'opus',
  schema: { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, from: { type: 'array', items: { type: 'string' } }, ...FINDING_ITEMS.properties }, required: ['id', 'from', ...FINDING_ITEMS.required] } } }, required: ['findings'] },
})
if (!merged) return { round: ROUND, error: 'merge returned nothing', raw: all }

phase('Verify')
const LENSES = [
  { id: 'source', text: 'Lens: the primary sources. Check every factual claim in the finding, and in its proposed fix, against the standards and the reference implementation. If the finding says lesson A is right and lesson B is wrong, confirm that from the source text itself. Refute the finding if the source does not support it, if both lessons are right about different cases, or if the proposed fix would itself state something the source does not say.' },
  { id: 'context', text: 'Lens: the learner in context. Open every passage the finding names and read the whole section around it, and for a route finding the earlier lessons of that route. Refute the finding if the statement is qualified nearby, if a later lesson explicitly refines an earlier simplification, if the concept is in fact taught or linked earlier on that route, if the reference does resolve, or if the two passages do not really cover the same ground.' },
  { id: 'fix', text: 'Lens: the remedy and the rules. Check the finding against the programme rules in plan.md sections 1.1 to 1.4 and against the rest of the course: is this really a breach (for example, is a second treatment of a topic a planned spiral with a link rather than a duplicate)? Would the proposed fix remove content, break another passage or cross-reference, or contradict a third lesson? Search the course for other places that say the same thing. Refute the finding if it is not a breach; if it is real but the fix is unsafe, say it is real and give a safe fix.' },
]
const VERDICT = { type: 'object', properties: { real: { type: 'boolean' }, reason: { type: 'string' }, evidence: { type: 'string' }, betterFix: { type: 'string' } }, required: ['real', 'reason', 'evidence'] }
const serious = merged.findings.filter(f => f.severity === 'S1' || f.severity === 'S2')
const small = merged.findings.filter(f => f.severity === 'S3')
const judged = await parallel(serious.map(f => () => parallel(LENSES.map(l => () => agent(`${BASE}

YOUR TASK (skeptic). Another agent reported the finding below. Try to REFUTE it. You see only this one finding; two other skeptics check it independently through other lenses. ${l.text}
Decide "real": true only if, after trying to refute it, the problem stands as described (you may narrow it; say how). If you cannot decide from the files and the sources, answer real: false and say what is missing. Give the evidence you relied on: file and line, and the clause with a short phrase where a fact is involved. If the problem is real but the proposed fix is wrong or unsafe, give a better fix.
The finding (JSON):
${JSON.stringify(f, null, 1)}`, { label: `skeptic:${f.id}:${l.id}`, phase: 'Verify', model: 'opus', schema: VERDICT })))
  .then(vs => ({ finding: f, verdicts: vs.map((v, i) => (v ? { lens: LENSES[i].id, real: v.real, reason: v.reason, evidence: v.evidence, betterFix: v.betterFix || '' } : { lens: LENSES[i].id, real: false, reason: 'skeptic returned nothing', evidence: '' })) }))))

const confirmed = [], refuted = []
for (const j of (judged || []).filter(Boolean)) {
  const yes = j.verdicts.filter(v => v.real).length
  ;(yes >= 2 ? confirmed : refuted).push({ ...j.finding, votes: yes, verdicts: j.verdicts })
}
log(`round ${ROUND}: ${confirmed.length} confirmed, ${refuted.length} refuted, ${small.length} small notes`)
return { round: ROUND, raw: all.length, merged: merged.findings.length, missing, unresolvedRoutes: routes.unresolved, confirmed, refuted: refuted.map(r => ({ id: r.id, severity: r.severity, files: r.files, problem: r.problem, votes: r.votes, why: r.verdicts.filter(v => !v.real).map(v => `${v.lens}: ${v.reason}`) })), small }
