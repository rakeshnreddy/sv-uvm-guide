export const meta = {
  name: 'visual-components',
  description: 'Audit all 112 lessons for concepts that need an interactive 2D/3D visual, merge them into a ranked component backlog, then build, review and register each new interactive (no lesson edits; 6a embeds them)',
  whenToUse: 'Phase 6a component track: runs in parallel with lesson-editing work because it only touches src/, tests/ and docs/visual-learning/',
  phases: [
    { title: 'Catalog', detail: 'inventory the existing visuals and interactives' },
    { title: 'Audit', detail: 'one read-only agent per lesson: text-heavy stretches and the interactive each concept needs' },
    { title: 'Backlog', detail: 'merge, dedupe and rank the needs into component specs; a critic checks coverage; final revision' },
    { title: 'Build', detail: 'one builder per component: pure model + component + tests' },
    { title: 'Review', detail: 'accuracy lens and learning/UX lens per component, up to 2 fix rounds' },
    { title: 'Integrate', detail: 'one agent registers every finished component and runs the checks' },
  ],
}

const ROOT = '/Users/Rakesh/Projects/sv-uvm-guide'
const SRC = '/Users/Rakesh/.claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/sources'
// args: the lesson list (an array) for a full run; or { backlog, skip, buildCap } to build straight from a saved
// backlog (docs/curriculum-quality/data/components-backlog-*.json, prepared by make-workflow-args.py), which
// skips the Catalog, Audit and Backlog phases.
const SAVED = args && !Array.isArray(args) && args.backlog ? args : null
const LESSONS = Array.isArray(args) ? args : []

const CONTEXT = `Repo ${ROOT}: Next.js 14 site teaching SystemVerilog, UVM and AMBA from junior to expert. Lessons are MDX under content/curriculum/ (rendered by src/app/(learning)/curriculum/[...slug]/page.tsx).
Owner request: lessons are long blocks of text that bore learners. Add visual elements, 2D and 3D visualizations and interactive visualizations that make concepts easier to understand and remember and keep attention, without removing content.
How interactives work here: a pure, tested model in src/lib/<name>-model.ts (tests in tests/lib/<name>-model.test.ts) holds the semantics; a client component (src/components/visuals/<Name>.tsx or src/components/curriculum/interactives/<Name>.tsx, tests in tests/components/<Name>.test.tsx with Testing Library) renders it; lessons embed it by MDX tag after it is registered in src/components/mdx/lazy-mdx-interactives.ts and the loader map in src/components/mdx/LazyMdxInteractive.tsx (lazy-loaded, so heavy code such as three/@react-three/fiber/drei stays out of the initial bundle). Libraries available: three, @react-three/fiber, @react-three/drei, d3, framer-motion, gsap, Tailwind. Established interaction style: predict-then-reveal (hide the answer until the learner commits a prediction, then explain), step-through with a scrubber, presets for each lesson use, keyboard operable, prefers-reduced-motion respected, readable at 390 px, light and dark themes via the existing tokens. Visual rules: docs/visual-learning/visual-language.md (and concept-visual-map.md). Example components to copy patterns from: src/components/visuals/AxiChannelHandshakeVisualizer.tsx (+ src/lib/axi-channel-model.ts), src/components/visuals/EventRegionGame.tsx, src/components/curriculum/f2/SystemVerilog3DVisualizer.tsx (the existing 3D one).
Accuracy is non-negotiable: every behaviour a visual shows must match the primary sources in ${SRC}/ (t1_lrm_clean.txt = IEEE 1800-2023, uvm_lrm.txt = IEEE 1800.2-2020, ahb5.txt = Arm IHI0033C, arm_ahb.txt = IHI0033B.b, arm_axi.txt = IHI0022E, arm_apb.txt = IHI0024C, arm_axis.txt = IHI0051A; each is a few very long lines, so search with Python slicing; copyrighted, never copy them into the repo) or uvm-core 2020.3.1 at /Users/Rakesh/Downloads/1800.2-2020.3.1/src. Never invent clause numbers.
Another workflow is editing lesson .mdx files, flashcard decks and lab files right now: never edit content/, and never run git add/commit/stash/checkout/reset, generators, builds or servers.`

const READONLY = 'You are READ-ONLY: do not create, edit or delete any file.'

const CATALOG_SCHEMA = {
  type: 'object',
  properties: {
    components: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, kind: { type: 'string', description: '2D interactive | 3D interactive | animation | kit diagram | game | exercise' },
      teaches: { type: 'string' }, props: { type: 'string' }, usedIn: { type: 'array', items: { type: 'string' } },
    }, required: ['name', 'kind', 'teaches', 'props', 'usedIn'] } },
    practicePages: { type: 'array', items: { type: 'string' } },
  },
  required: ['components', 'practicePages'],
}

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    proseWords: { type: 'number', description: 'approximate words of teaching prose' },
    textHeavy: { type: 'array', items: { type: 'string' }, description: 'heading or line range of each long stretch of prose with no visual, and what it explains' },
    needs: { type: 'array', items: { type: 'object', properties: {
      where: { type: 'string', description: 'heading / line' },
      concept: { type: 'string' },
      interaction: { type: 'string', description: 'what the learner manipulates, predicts and observes' },
      dimension: { type: 'string', enum: ['2D', '3D', 'either'] },
      existing: { type: 'string', description: 'an existing component (with props/preset) that already serves it, or "" if none does' },
      gap: { type: 'string', description: 'if an existing component almost fits: what it lacks; else ""' },
      value: { type: 'string', enum: ['high', 'medium', 'low'], description: 'how much it improves understanding or memory over text alone' },
    }, required: ['where', 'concept', 'interaction', 'dimension', 'existing', 'gap', 'value'] } },
    staticVisuals: { type: 'array', items: { type: 'string' }, description: 'static additions (kit diagrams, timing/sequence diagrams, tables, step reveals, summary visual) phase 6a should add, with where' },
  },
  required: ['file', 'proseWords', 'textHeavy', 'needs', 'staticVisuals'],
}

const COMPONENT = { type: 'object', properties: {
  id: { type: 'string', description: 'kebab-case id' },
  name: { type: 'string', description: 'PascalCase component and MDX tag; must not clash with an existing component' },
  kind: { type: 'string', enum: ['new', 'extend-existing'] },
  extends: { type: 'string', description: 'for extend-existing: the existing component file it changes, else ""' },
  dimension: { type: 'string', enum: ['2D', '3D'] },
  concept: { type: 'string' },
  lessons: { type: 'array', items: { type: 'string' }, description: 'lesson files (with heading) that will embed it, and with which preset' },
  spec: { type: 'string', description: 'interactions, presets, predict-then-reveal moments, what is shown at each step, edge cases; detailed enough to build from' },
  modelRules: { type: 'string', description: 'the semantics the model must implement, with the source and section for each rule' },
  files: { type: 'array', items: { type: 'string' }, description: 'every file the builder may create or edit (model, component, tests); disjoint from every other item' },
  priority: { type: 'number', description: '1 = highest' },
  why3D: { type: 'string', description: 'for 3D only: what depth/space shows that 2D cannot; else ""' },
}, required: ['id', 'name', 'kind', 'extends', 'dimension', 'concept', 'lessons', 'spec', 'modelRules', 'files', 'priority', 'why3D'] }

const BACKLOG_SCHEMA = {
  type: 'object',
  properties: {
    components: { type: 'array', items: COMPONENT },
    deferred: { type: 'array', items: { type: 'string' }, description: 'needs not turned into a component, with why (served by an existing component, low value, or a static diagram is enough)' },
  },
  required: ['components', 'deferred'],
}

const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    missing: { type: 'array', items: { type: 'string' }, description: 'high-value needs the backlog drops or under-serves' },
    problems: { type: 'array', items: { type: 'string' }, description: 'items that duplicate an existing component, are inaccurate in their modelRules, overlap in files, use 3D without reason, or are too vague to build' },
  },
  required: ['missing', 'problems'],
}

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    mdxUsage: { type: 'string', description: 'example MDX tag with props for each preset' },
    loader: { type: 'string', description: 'the exact loader line for LazyMdxInteractive.tsx' },
    validation: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['id', 'files', 'mdxUsage', 'loader', 'validation', 'notes'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: { pass: { type: 'boolean' }, findings: { type: 'array', items: { type: 'string' } } },
  required: ['pass', 'findings'],
}

const INTEGRATE_SCHEMA = {
  type: 'object',
  properties: {
    registered: { type: 'array', items: { type: 'string' } },
    notRegistered: { type: 'array', items: { type: 'string' } },
    checks: { type: 'string' },
  },
  required: ['registered', 'notRegistered', 'checks'],
}

phase('Catalog')
const catalog = SAVED ? null : await agent(`${CONTEXT}

${READONLY} Build the catalog of every visual or interactive element a lesson can embed or link: src/components/mdx/lazy-mdx-interactives.ts and LazyMdxInteractive.tsx (the registered interactives and their source files), the kit (src/components/mdx/DiagramKit.tsx, src/components/visual-system/), ProtocolWaveform, and the practice/visualization/exercise pages (src/app/(learning)/practice/**, visualizations/**, exercises/**). For each component: MDX tag, kind (2D interactive, 3D interactive, animation, kit diagram, game, exercise), what it teaches, its useful props/presets, and which lesson files embed it (grep content/curriculum).`, { label: 'catalog', phase: 'Catalog', schema: CATALOG_SCHEMA })
const catalogText = JSON.stringify(catalog || {}).slice(0, 60000)

const auditPrompt = (l) => `${CONTEXT}

${READONLY} Audit ${l.file} (module ${l.module}, ${l.track} track). Read it fully, and its spine card in docs/curriculum-quality/curriculum-spine.md.
1. Mark every text-heavy stretch: about 300 or more words of teaching prose with no visual, code, table or interactive between them.
2. For each core concept a learner must build a mental model of, and for each text-heavy stretch, say what interactive visual would teach it far better than prose: what the learner manipulates, what they predict, what they then see. Prefer an existing component with the right props or preset (catalog below). Mark 3D only where depth or space carries meaning (memory and array layouts, hierarchies, multi-dimensional coverage spaces, clock-domain or power-domain geometry); otherwise 2D. Rate the value honestly.
3. List the static additions phase 6a should also make (kit architecture/timing/sequence diagrams, comparison tables, step reveals, predict-then-check prompts, a one-glance summary visual).
CATALOG: ${catalogText}`

phase('Audit')
const audits = SAVED ? [] : await pipeline(LESSONS, (l) => agent(auditPrompt(l), { label: `audit:${l.module.split('_')[0]}/${l.lesson}`, phase: 'Audit', schema: AUDIT_SCHEMA }))
const auditsOk = audits.filter(Boolean)
const failedAudits = LESSONS.filter((l, i) => !audits[i]).map((l) => l.file)
if (failedAudits.length) log(`Audit missing for ${failedAudits.length} lessons: ${failedAudits.join(', ')}`)

// Barrier: the backlog needs every lesson's needs at once to dedupe across lessons.
const needsText = JSON.stringify(auditsOk.map((a) => ({ file: a.file, needs: a.needs.filter((n) => n.value !== 'low' && (!n.existing || n.gap)) }))).slice(0, 180000)

phase('Backlog')
const backlogPrompt = (extra) => `${CONTEXT}

${READONLY} Turn the lesson audits below into a ranked backlog of interactive components to BUILD. Merge needs that one component (with presets) can serve across lessons; never duplicate an existing component (catalog), but an existing one that almost fits may be extended (kind extend-existing, naming its file). Each item must be buildable on its own: a precise spec, the model rules with their primary-source sections, and a disjoint set of files (no two items may share a file; the shared registry files src/components/mdx/lazy-mdx-interactives.ts and LazyMdxInteractive.tsx are NOT in any item, one integrator edits them). Use 3D only with a real reason (why3D). Rank by learning value times the number of lessons served, junior lessons first at equal value. Include every high-value need; put the rest in deferred with the reason, so nothing is silently dropped.
${extra}
CATALOG: ${catalogText}
AUDITS: ${needsText}`

const draft = SAVED ? null : await agent(backlogPrompt(''), { label: 'backlog:draft', phase: 'Backlog', schema: BACKLOG_SCHEMA })
const critique = draft ? await agent(`${CONTEXT}

${READONLY} Critique this draft component backlog against the lesson audits and the catalog. Find high-value needs it drops or under-serves, items that duplicate an existing component, model rules that are wrong against the primary sources (check them), overlapping files, 3D without reason, and specs too vague to build.
DRAFT: ${JSON.stringify(draft).slice(0, 80000)}
CATALOG: ${catalogText}
AUDITS: ${needsText.slice(0, 90000)}`, { label: 'backlog:critic', phase: 'Backlog', schema: CRITIC_SCHEMA }) : null
const backlog = SAVED ? SAVED.backlog : (draft && critique && (critique.missing.length || critique.problems.length)
  ? await agent(backlogPrompt(`A critic reviewed your first draft. Produce the final backlog, resolving each point (or saying in deferred why not).
FIRST DRAFT: ${JSON.stringify(draft).slice(0, 70000)}
CRITIC: ${JSON.stringify(critique).slice(0, 20000)}`), { label: 'backlog:final', phase: 'Backlog', schema: BACKLOG_SCHEMA })
  : draft)
if (!backlog) return { error: 'no backlog', audits: auditsOk }

// Guard against overlapping file ownership before parallel builders start.
const owner = {}
const items = []
for (const c of [...backlog.components].sort((a, b) => a.priority - b.priority)) {
  if (SAVED && (SAVED.skip || []).includes(c.id)) continue // already built
  const clash = c.files.find((f) => owner[f])
  if (clash) { log(`Skipping ${c.id}: ${clash} already belongs to ${owner[clash]}`); backlog.deferred.push(`${c.id}: file overlap with ${owner[clash]}`); continue }
  c.files.forEach((f) => { owner[f] = c.id })
  items.push(c)
}
log(`Backlog: ${items.length} components to build (${items.filter((c) => c.dimension === '3D').length} in 3D), ${backlog.deferred.length} deferred`)
const BUILD_CAP = SAVED && SAVED.buildCap ? SAVED.buildCap : Infinity
if (items.length > BUILD_CAP) {
  const later = items.splice(BUILD_CAP)
  log(`Building the top ${BUILD_CAP} now; ${later.length} stay in the backlog: ${later.map((c) => c.id).join(', ')}`)
  later.forEach((c) => backlog.deferred.push(`${c.id}: not built in this run (priority ${c.priority})`))
}

const VALIDATE = (c) => `VALIDATE (only your files; other builders work in parallel, so ignore errors in files that are not yours):
- NODE_OPTIONS='--require @prisma/client' npx vitest run ${c.files.filter((f) => f.startsWith('tests/')).join(' ') || '<your test files>'}
- npx eslint ${c.files.join(' ')}
- npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E '${c.files.map((f) => f.replace(/[.]/g, '\\\\.')).join('|')}' must print nothing`

const buildPrompt = (c) => `${CONTEXT}

You are the builder for interactive component "${c.name}" (${c.dimension}, ${c.kind}${c.extends ? `, extends ${c.extends}` : ''}). Create or edit ONLY these files: ${c.files.join(', ')}. Do not touch the shared registry files or any lesson; the integrator registers your component, and phase 6a embeds it.
SPEC: ${JSON.stringify(c).slice(0, 12000)}
Build it to the house standard:
- The semantics live in the pure model (no React), each rule implemented from the primary source and unit-tested with the source section named in the test title or a comment.
- The component is a client component with a default export, named props, and one preset per lesson use. It is keyboard operable, has an accessible name and a text alternative (a live region or a described summary), respects prefers-reduced-motion, fits 390 px without sideways scroll, and works in light and dark themes.
- Use predict-then-reveal where the spec asks for a prediction.
- 3D: use @react-three/fiber and drei. Keep the WebGL scene inside the component so the lazy loader splits it; give a 2D or text fallback when WebGL is unavailable (and under jsdom in tests).
- Component tests cover the interactions and the reveal behaviour, not implementation details.
${VALIDATE(c)}
RETURN id, files, mdxUsage (example tags with props for each preset), loader (the exact line for the loaders map, in the style of the existing ones), validation, notes.`

const reviewPrompt = (c, lens, build) => `${CONTEXT}

${READONLY} Review the new interactive component "${c.name}" (files: ${c.files.join(', ')}; read them, and run its tests). Builder's report: ${JSON.stringify(build).slice(0, 3000)}
SPEC: ${JSON.stringify(c).slice(0, 8000)}
${lens === 'accuracy'
  ? 'LENS accuracy: check every rule the model implements and every label, step and explanation the component shows against the primary sources (search them; name the section). Check edge cases. A wrong model teaches a wrong mental model, so any deviation is S1.'
  : 'LENS learning and UX: does it teach the concept far better than prose (clear goal, a prediction before the reveal, feedback that explains why, presets that match each lesson)? Accessibility (keyboard, names, live text, focus), 390 px layout, reduced motion, themes, performance (no heavy work on the main bundle; 3D is justified and has a fallback), and test quality. Run the validation commands.'}
RETURN pass=true only if no S1/S2 problem remains; findings as "Sev file:line - problem -> fix".`

const fixPrompt = (c, findings, round) => `${CONTEXT}

Fix round ${round} for component "${c.name}". Edit ONLY: ${c.files.join(', ')}. Resolve every finding:
${findings.join('\n')}
SPEC: ${JSON.stringify(c).slice(0, 8000)}
${VALIDATE(c)}
RETURN id, files, mdxUsage, loader, validation, notes.`

const built = await pipeline(
  items,
  (c) => agent(buildPrompt(c), { label: `build:${c.id}`, phase: 'Build', schema: BUILD_SCHEMA }),
  async (build, c) => {
    if (!build) return { id: c.id, status: 'build-failed', component: c }
    let current = build
    let lenses = ['accuracy', 'learning']
    for (let round = 1; round <= 3; round += 1) {
      const reviews = await parallel(lenses.map((lens) => () => agent(reviewPrompt(c, lens, current), { label: `review:${c.id}:${lens}:r${round}`, phase: 'Review', schema: REVIEW_SCHEMA })))
      const failing = lenses.filter((lens, i) => !reviews[i] || !reviews[i].pass)
      if (!failing.length) return { id: c.id, status: 'clean', rounds: round, build: current, component: c }
      const findings = reviews.filter((r) => r && !r.pass).flatMap((r) => r.findings)
      if (round === 3) return { id: c.id, status: 'escalate', open: findings, build: current, component: c }
      const fixed = await agent(fixPrompt(c, findings, round), { label: `fix:${c.id}:r${round}`, phase: 'Review', schema: BUILD_SCHEMA })
      if (fixed) current = fixed
      lenses = failing
    }
  },
)
const done = built.filter(Boolean)
const clean = done.filter((r) => r.status === 'clean')
log(`Built ${done.length}/${items.length}: ${clean.length} clean, ${done.filter((r) => r.status === 'escalate').length} escalated, ${done.filter((r) => r.status === 'build-failed').length} failed`)

phase('Integrate')
const integration = clean.length ? await agent(`${CONTEXT}

You are the single integrator. Register each component below in src/components/mdx/lazy-mdx-interactives.ts (its name) and in the loaders map of src/components/mdx/LazyMdxInteractive.tsx (the builder's loader line, checked against the real export). Edit only those two files, plus tests that pin the registry (grep tests/ for lazyMdxInteractiveNames and the loaders map) if they need the new names. Then run: npx tsc --noEmit; npx eslint src/components/mdx; NODE_OPTIONS='--require @prisma/client' npx vitest run tests/components tests/lib tests/curriculum/mdx-render-smoke.test.tsx. Fix registry problems; do not change the components. If one cannot be registered, leave it out and say why.
COMPONENTS: ${JSON.stringify(clean.map((r) => ({ id: r.id, name: r.component.name, files: r.build.files, loader: r.build.loader }))).slice(0, 30000)}
RETURN registered, notRegistered (with why), checks (commands and results).`, { label: 'integrate', phase: 'Integrate', schema: INTEGRATE_SCHEMA }) : null

return {
  backlog: { components: items.map((c) => ({ id: c.id, name: c.name, dimension: c.dimension, priority: c.priority, concept: c.concept, lessons: c.lessons })), deferred: backlog.deferred },
  results: done.map((r) => ({ id: r.id, status: r.status, files: r.build ? r.build.files : [], mdxUsage: r.build ? r.build.mdxUsage : '', open: r.open || [] })),
  integration,
  lessonPlans: auditsOk.map((a) => ({ file: a.file, proseWords: a.proseWords, textHeavy: a.textHeavy, needs: a.needs, staticVisuals: a.staticVisuals })),
  failedAudits,
}
