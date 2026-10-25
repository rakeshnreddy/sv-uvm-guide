export const meta = {
  name: 'phase6a-extras',
  description: 'Phase 6a extras: bring back the five hidden pages with real content and build the six coming-soon labs plus an M5 lab, each reviewed (and compiled with Verilator when installed)',
  whenToUse: 'Phase 6a of the curriculum quality program (owner request 2026-10-25), alongside visual-enrichment.js, after the 6b closure sweep',
  phases: [
    { title: 'Author', detail: 'one author per page or lab, disjoint files' },
    { title: 'Review', detail: 'accuracy + quality reviewers per item; labs also compiled with Verilator' },
    { title: 'Fix', detail: 'author resolves findings (max 2 rounds)' },
    { title: 'Integrate', detail: 'shared files (navigation, sitemap, practice links, manifest milestones, tests)' },
  ],
}

// args (optional): { only: ['page:resources', 'lab:constructs-1', ...] } to run a subset.
const ROOT = '/Users/Rakesh/Projects/sv-uvm-guide'
const SRC = '/Users/Rakesh/.claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/sources'

const CONTEXT = `Repo ${ROOT}: Next.js 14 site (TypeScript, Tailwind, Vitest) teaching SystemVerilog, UVM and AMBA from junior to expert, deployed as prerendered pages on Cloudflare Workers; every push to main deploys. Owner decisions: nothing is blocked by login (docs/no-login/: learner data lives in the browser through src/lib/learner-store; client switches only via SITE_FEATURES / ACCOUNTS_ENABLED); no placeholder content may be visible to learners; visuals follow docs/visual-learning/visual-language.md; lessons follow docs/curriculum-quality/README.md, plan.md and curriculum-spine.md (module intent cards, milestones M0-M8 in src/lib/learning-paths.ts MILESTONES, terminology §5).
Primary sources (copyrighted; read in place; long single lines, search with Python) in ${SRC}/: t1_lrm_clean.txt IEEE 1800-2023, uvm_lrm.txt IEEE 1800.2-2020, ahb5.txt IHI0033C, arm_ahb.txt IHI0033B.b, arm_axi.txt IHI0022E, arm_apb.txt IHI0024C, arm_axis.txt IHI0051A. Never invent clause numbers, APIs, flags, dates or URLs; verify external links and historical facts with WebFetch of official pages and cite them.
Rules: edit only your files (listed per item); never run git add/commit/stash/checkout/reset, npm run generate:*, next build, next dev or servers. Validate with NODE_OPTIONS='--require @prisma/client' npx vitest run <relevant tests>, npx tsc --noEmit -p ., npx eslint <your files>, node scripts/check-mdx.mjs --render <mdx you touched>.
Verilator: if \`verilator --version\` works (any 5.x), every SystemVerilog file you ship must compile: \`verilator --lint-only -Wall --timing -Wno-fatal <files>\` at minimum and, for self-checking benches, \`verilator --binary --timing <files> && ./obj_dir/V<top>\` with the expected PASS output; record the exact command and output in your log. If Verilator is not installed, say so and label expected outputs "worked out from the code, not captured from a run".`

const LAB_RULES = `Follow the rebuilt labs as models: content/curriculum/labs/simple_dut (lab simple-dut-1, owned by F2E, structural grader sv-selfcheck-v1) and content/curriculum/labs/common (basics-1 v2, grader sv-basics-v2). A lab has lab.json (schema in scripts/generate-lab-registry.mjs; version bump; status "available"; owningModule from the manifest that actually teaches it per the spine card; modulePrerequisites; steps with self-attested or structural grading), a README with steps, expected output and a "prove it fails" planted-bug step, starter files with TODO markers, and a full worked solution. Structural graders live in src/lib/lab-graders.ts (add a new grader id only if the lab needs one, register it in scripts/generate-lab-registry.mjs knownGraders, test it in tests/lib/lab-graders.test.ts). Do not regenerate src/generated/*; the lead does it. If the owning module or prerequisites change, note it for the Integrate step (lab-to-lesson links live in src/lib/practice-links.ts; tests that pin a lab as coming_soon must be listed).`

const ITEMS = [
  // ---- Hidden pages brought back with real content ----
  { id: 'page:resources', kind: 'page', files: 'src/app/(learning)/resources/** and any new data module under src/lib/resources*.ts, tests/app/resources-page.test.tsx',
    brief: 'Build /resources as a curated, verified reference library: the standards (IEEE 1800-2023 and how to obtain it free via IEEE GET Program if that is still true; IEEE 1800.2-2020; Accellera uvm-core on GitHub), Arm AMBA specifications (developer.arm.com documents by number), free simulators and tools (Verilator, Icarus Verilog, EDA Playground, cocotb, pyuvm, riscv-dv) with what each supports, and a short note per resource on when to use it and which lessons reference it. Every URL must be checked with WebFetch; no dead or guessed links. Group by purpose; searchable or filterable is a plus.' },
  { id: 'page:history', kind: 'page', files: 'src/app/(learning)/history/** and tests/app/history-page.test.tsx',
    brief: 'Build /history: a verified, illustrated timeline of hardware verification languages and methodologies: Verilog (IEEE 1364), Superlog/Vera/e and the path to SystemVerilog (Accellera 3.0/3.1a, IEEE 1800-2005, merge with 1364 in 2009, 1800-2012/2017/2023), VMM/AVM/OVM to UVM (Accellera UVM 1.0 2011, 1.1, 1.2, IEEE 1800.2-2017/2020, uvm-core 2020.x), and why each step happened (what problem it solved). Use a visual timeline component (accessible, readable at 390 px). Verify every date and fact against official sources with WebFetch and cite them; omit anything you cannot verify.' },
  { id: 'page:projects', kind: 'page', files: 'src/app/(learning)/projects/** and tests/app/projects-page.test.tsx',
    brief: 'Build /projects: capstone-style project briefs tied to the milestone ladder M0-M8 (src/lib/learning-paths.ts MILESTONES): for each milestone, the project goal, the design under test, required features, acceptance criteria, which labs and lessons prepare for it, stretch goals, and an honest effort estimate. Link real labs and lessons only (resolve them through src/lib/practice-links.ts helpers). Learners can mark a project "in progress / done" in the learner store if a repository exists for it; otherwise keep the page static.' },
  { id: 'page:knowledge-hub', kind: 'page', files: 'src/app/(learning)/knowledge-hub/**, src/lib/knowledge-graph-engine.ts (and a new generated or derived concept-graph module if needed), the components the hub uses, and their tests',
    brief: 'Replace the 15 hand-written placeholder nodes with a real concept map derived from the curriculum: modules and lessons from content/curriculum/curriculum.manifest.json (with prerequisites as edges), key terms from the spine §5 terminology and module intent cards, and links to the lessons that teach each concept. Show it as an accessible, keyboard-navigable map plus a searchable list (the list is the accessible fallback), readable at 390 px. The same data must power ConceptLink/ConceptModal (used by remarkConceptLinks when a lesson opts in with conceptLinking: true) so concept tiers and links are correct. Remove the "placeholder" labels; keep the build static.' },
  { id: 'page:assessment', kind: 'page', files: 'src/app/(learning)/assessment/** and its components, tests/app/assessment-page.test.tsx',
    brief: 'Rebuild /assessment as an honest self-assessment from the learner store (no mock scores, no fake certifications): per track (SystemVerilog, UVM, assertions/coverage, AMBA, expert topics) show lessons done, quiz results, labs completed, flashcard mastery and the placement result, then recommend the next lessons and labs. Empty state when there is no data. Accessible charts with text equivalents; readable at 390 px.' },
  // ---- Coming-soon labs and the missing M5 lab ----
  { id: 'lab:constructs-1', kind: 'lab', files: 'content/curriculum/labs/constructs/** (plus a grader in src/lib/lab-graders.ts and its tests if needed)',
    brief: 'Milestone M1 lab: "Race-aware interface testbench with clocking blocks". It is currently owned by F2B, which does not teach clocking blocks; set the owning module to the lesson that teaches interfaces and clocking blocks (check the spine and the manifest, likely F4B/F4C) and justify it. The learner builds an interface with a clocking block, drives and samples a small DUT race-free, and proves a race exists without the clocking block (planted bug).' },
  { id: 'lab:common-1', kind: 'lab', files: 'content/curriculum/labs/common/** EXCEPT the basics-1 lab files (only common-1\'s own lab.json/assets; if both labs share the folder, put common-1 in its own subfolder and update its assetLocation)',
    brief: 'Lab common-1 "structs, enums and arrays": align it with the F2A sub-lesson structs-unions-enums (the earlier lead note re-owns it to F2A) and the F2B arrays lessons; a small packet-decoder bench that uses typedef enum, packed structs and dynamic/associative arrays, self-checking, with a planted bug.' },
  { id: 'lab:fifo-1', kind: 'lab', files: 'content/curriculum/labs/fifo/**',
    brief: 'Lab fifo-1 owned by I-SV-1 (OOP): verify a synchronous FIFO with a class-based layered bench (transaction, generator, driver, monitor, scoreboard with a reference queue) including full/empty corner cases and a planted bug.' },
  { id: 'lab:assertions-1', kind: 'lab', files: 'content/curriculum/labs/assertions/**',
    brief: 'Lab assertions-1 owned by I-SV-4A: finish the existing valid/ready register-slice lab (valid hold, payload stable, bounded response, cover properties), make it available, with a planted protocol bug the assertions must catch; check SVA semantics against IEEE 1800-2023 clause 16.' },
  { id: 'lab:arbiter-1', kind: 'lab', files: 'content/curriculum/labs/arbiter/**',
    brief: 'Lab arbiter-1 owned by I-UVM-2A: verify a synchronous round-robin arbiter with a small UVM environment (agent, sequence, scoreboard with a fairness reference model, functional coverage of grant patterns) and a planted starvation bug; UVM code must be legal for uvm-core 2020.3.1 (if Verilator is used, note any UVM-on-Verilator limitations honestly).' },
  { id: 'lab:dma-1', kind: 'lab', files: 'content/curriculum/labs/dma/**',
    brief: 'Lab dma-1 owned by I-UVM-3B: verify a small DMA controller with layered and virtual sequences (register programming sequence, memory-model responder, scoreboard checking copied data), with a planted bug; keep it achievable (a few hours).' },
  { id: 'lab:m5-multi-agent', kind: 'lab', files: 'content/curriculum/labs/multi_agent/** (new folder; new lab id multi-agent-vseq)',
    brief: 'New lab for milestone M5 "Multi-agent environment with virtual sequences" (M5 has no lab today): two agents (for example a config bus and a data stream), a virtual sequencer and virtual sequence that coordinate them, end-to-end scoreboard, owned by the module that teaches multi-agent topologies (check the manifest: A-UVM-8 or I-UVM-3B). Add the lab to MILESTONES only in the Integrate step (src/lib/learning-paths.ts is a shared file).' },
]

const SELECTED = ITEMS.filter((it) => !(typeof args !== 'undefined' && args && Array.isArray(args.only) && args.only.length) || args.only.includes(it.id))
log(`Phase 6a extras: ${SELECTED.map((i) => i.id).join(', ')}`)

const AUTHOR_SCHEMA = {
  type: 'object',
  properties: {
    item: { type: 'string' },
    done: { type: 'array', items: { type: 'string' } },
    filesTouched: { type: 'array', items: { type: 'string' } },
    sharedFileRequests: { type: 'array', items: { type: 'string' }, description: 'changes needed in shared files (navigation, sitemap, practice-links, learning-paths, manifest, tests that pin coming_soon/hidden status): file + change' },
    verilator: { type: 'string', description: 'commands run and results, or why not run' },
    validation: { type: 'string' },
  },
  required: ['item', 'done', 'filesTouched', 'sharedFileRequests', 'verilator', 'validation'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: { pass: { type: 'boolean' }, findings: { type: 'array', items: { type: 'string' } } },
  required: ['pass', 'findings'],
}

const authorPrompt = (it) => `${CONTEXT}
${it.kind === 'lab' ? LAB_RULES : ''}

You are the author for ${it.id}. Your files: ${it.files}.
BRIEF: ${it.brief}
Write a short log at docs/curriculum-quality/reviews/6a-${it.id.replace(':', '-')}.author.md (what you built, sources verified, Verilator results, shared-file requests).
RETURN item, done, filesTouched, sharedFileRequests, verilator, validation.`

const reviewPrompt = (it, lens, author) => `${CONTEXT}
${it.kind === 'lab' ? LAB_RULES : ''}

READ-ONLY review of ${it.id} (${it.brief}). Files: ${it.files}. Author report: ${JSON.stringify(author).slice(0, 3000)}
${lens === 'accuracy'
  ? 'LENS accuracy: every fact, date, link, code sample and claim is correct and verified (WebFetch links; LRM clauses; uvm-core behaviour labelled as implementation); SystemVerilog compiles with Verilator if it is installed (run it yourself and compare with the author\'s log); expected outputs match what the code does.'
  : 'LENS quality: meets the brief completely with no placeholder left; teaches well (clear goal, steps, planted-bug proof for labs); accessible (labels, keyboard, contrast, text alternatives), readable at 390 px, consistent with the site style; works with no login (learner store, no sign-in copy); tests cover it; tsc/eslint clean for its files.'}
RETURN pass=true only if no S1/S2 problem remains; findings as "file:line - problem -> fix".`

const fixPrompt = (it, findings, round) => `${CONTEXT}
${it.kind === 'lab' ? LAB_RULES : ''}

Fix round ${round} for ${it.id}. Your files: ${it.files}. Resolve every finding:
${findings.join('\n')}
RETURN item, done, filesTouched, sharedFileRequests, verilator, validation.`

const results = await pipeline(
  SELECTED,
  (it) => agent(authorPrompt(it), { label: `author:${it.id}`, phase: 'Author', schema: AUTHOR_SCHEMA }),
  async (author, it) => {
    if (!author) return { id: it.id, status: 'author-failed' }
    let current = author
    const requests = [...author.sharedFileRequests]
    let lenses = ['accuracy', 'quality']
    for (let round = 1; round <= 3; round += 1) {
      const reviews = await parallel(lenses.map((lens) => () => agent(reviewPrompt(it, lens, current), { label: `review:${it.id}:${lens}:r${round}`, phase: 'Review', schema: REVIEW_SCHEMA })))
      const failing = lenses.filter((lens, i) => !reviews[i] || !reviews[i].pass)
      if (!failing.length) return { id: it.id, status: 'clean', rounds: round, author: current, requests }
      const findings = reviews.filter((r) => r && !r.pass).flatMap((r) => r.findings)
      if (round === 3) return { id: it.id, status: 'escalate', author: current, open: findings, requests }
      const fixed = await agent(fixPrompt(it, findings, round), { label: `fix:${it.id}:r${round}`, phase: 'Fix', schema: AUTHOR_SCHEMA })
      if (fixed) { current = fixed; requests.push(...fixed.sharedFileRequests) }
      lenses = failing
    }
  },
)

phase('Integrate')
const done = results.filter(Boolean)
const integration = await agent(`${CONTEXT}

You are the integration engineer for phase 6a extras. Each item was built in its own files; now apply the shared-file changes so everything is reachable and consistent. You may edit shared files: src/lib/site-features.ts and the hidden-page gates (unhide the rebuilt pages: remove their notFound() gates), navigation (Navbar, Sidebar, footer, search quick links), src/app/sitemap.ts and tests/app/sitemap.test.ts (move rebuilt pages from HIDDEN_PAGES to public), src/lib/practice-links.ts and its tests (lab-to-lesson links, LAB_LESSON_OVERRIDES), src/lib/learning-paths.ts MILESTONES (constructs-1 for M1 and the new M5 lab), content/curriculum/curriculum.manifest.json only if a lab's owning module needs a lesson link, and any test that pinned a lab as coming_soon or a page as hidden.
Results and requests: ${JSON.stringify(done.map((r) => ({ id: r.id, status: r.status, requests: r.requests || [], open: r.open || [] }))).slice(0, 25000)}
Then run the whole suite (NODE_OPTIONS='--require @prisma/client' npx vitest run), npx tsc --noEmit -p ., npx next lint --max-warnings=0, and fix every failure caused by this work. Do not regenerate src/generated/* (the lead does it in a clean worktree).
RETURN a summary: what you changed, test/tsc/lint results, anything remaining.`, { label: 'integrate', phase: 'Integrate' })

return {
  items: done.map((r) => ({ id: r.id, status: r.status, rounds: r.rounds, open: r.open || [], verilator: r.author ? r.author.verilator : '' })),
  integration,
}
