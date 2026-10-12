export const meta = {
  name: 'curriculum-implementation',
  description: 'Rewrite or update lesson groups to the target standard, with accuracy, completeness and visuals/navigation review loops until closure',
  whenToUse: 'Phase 4 of the curriculum quality program (docs/curriculum-quality/plan.md)',
  phases: [
    { title: 'Author', detail: 'one author per group implements the verdict for its modules' },
    { title: 'Review', detail: 'three independent reviewers per group: accuracy, completeness and depth, visuals and navigation' },
    { title: 'Fix', detail: 'the author resolves findings; failing lenses re-review (max 3 rounds)' },
  ],
}

const ROOT = '/Users/Rakesh/Projects/sv-uvm-guide'

const AUTHOR_SCHEMA = {
  type: 'object',
  properties: {
    group: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    modules: { type: 'array', items: { type: 'string' } },
    issuesResolved: { type: 'number' },
    issuesDeferred: { type: 'array', items: { type: 'string' } },
    expertItemsAdded: { type: 'number' },
    picturesAdded: { type: 'number' },
    quizQuestions: { type: 'number' },
    flashcards: { type: 'number' },
    leadRequests: { type: 'array', items: { type: 'string' } },
    validation: { type: 'string' },
  },
  required: ['group', 'filesChanged', 'modules', 'issuesResolved', 'issuesDeferred', 'expertItemsAdded', 'picturesAdded', 'quizQuestions', 'flashcards', 'leadRequests', 'validation'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    lens: { type: 'string' },
    pass: { type: 'boolean' },
    findings: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['lens', 'pass', 'findings', 'summary'],
}

function scope(g) {
  const mods = (g.modules || []).map((m) => `- ${m.path}` + (m.files ? ` (files: ${m.files.join(', ')})` : ' (all .mdx files in the folder)')).join('\n')
  const labs = g.labs && g.labs.length ? `- labs (README.md, lab.json steps, starter and solution files): ${g.labs.join(', ')} (find each folder by "id" in content/curriculum/labs/**/lab.json)` : '- labs: none'
  return `${mods}\n- the flashcard deck(s) named by your pages' frontmatter "flashcards" (content/flashcards/<deck>.json); create a new deck named <ModuleShortId>_<Topic>.json if a module has none\n${labs}\n- static images under public/visuals/<module-folder>/ if you need any\n- your change log docs/curriculum-quality/reviews/${g.id}.author.md`
}

const READ = (g) => `READ FIRST (in this order):
1. docs/curriculum-quality/README.md: quality requirements, target lesson, depth ladder, concept completeness checklist, visuals, navigation, rubric, ownership, validation.
2. docs/curriculum-quality/plan.md: §1 (binding lead decisions) and §4 (definition of done).
3. docs/curriculum-quality/curriculum-spine.md:
   - your modules' intent cards in §2;
   - the pinned elements in §3.5;
   - the §5 standards (terminology, code style, page structure, objectives, quiz format);
   - §4 coverage gaps that name your modules.
4. ${g.analysis && g.analysis.length ? `Your analysis: ${g.analysis.join(', ')}, plus the matching .verify.md if it exists. The verifier's corrections and extra findings win where they conflict with the analyst.` : 'There is no analysis for new content; follow your spec below.'}
5. docs/visual-learning/visual-language.md §9 (the MDX diagram kit) and the registry of interactive visuals in src/components/mdx/lazy-mdx-interactives.ts. Before embedding a visualizer, read its VisualFrame summary and props in its source.
6. For tone and components, content/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index.mdx. It still lacks objectives and an expert layer; your pages must have both.`

const HOW = `HOW TO WRITE EACH PAGE (the README has the details):
- **Structure:** the six template H2s in exact order, frontmatter title, description and flashcards. No H1, no \`export const metadata\`, no <InfoPage>, no "Page k of N" lines.
- **Quick Take:** **What it is**, **Why it matters**, **The Analogy** (with where it breaks), then **You will be able to:** with 3-5 numbered, observable objectives, then <BeforeYouStart /> on its own line.
- **Build Your Mental Model:**
  - core first (the picture, the minimal correct example, the one or two classic mistakes), then practitioner depth;
  - every core concept passes the 10-item completeness checklist;
  - every core concept gets an accurate picture: an existing visualizer (introduce, predict, debrief), or the diagram kit (<ArchitectureDiagram>, <TimingDiagram>, <SequenceDiagram>, with names matching the code exactly), or a traced example.
- **Make It Work:** a complete example tagged // compile with an "Expected output" text block, a numbered how-to, and **Checklist before moving on:** with - [ ] items.
- **Push Further:** the expert layer as \`### Expert: <topic>\` items (at least 3 on a module index, at least 2 on a sub-lesson). Each has a verified source (IEEE 1800-2023 clause, uvm-core 2020.3.1 file, Arm section) or the label "tool-dependent".
- **Practice & Reinforce:**
  - the canonical <Quiz questions={[{ question, objective, answers: [{ text, correct, feedback }], explanation }]} />, with at least 5 questions on a module index and 4 on a sub-lesson; every objective tested; distractors built from real misconceptions; feedback on every answer;
  - the flashcard deck aligned with the page (at least 10 cards per module deck, canonical {id, question, answer}, stable ids);
  - a hands-on element: a kata with a worked solution inside <details>, a practice or exercise link, or a <LabLink> to an available lab.
- **References & Next Topics:** primary sources with verified clause or section numbers; a "Related" list of canonical absolute links; then <NextLesson /> (no hand-written Next line).
- **Accuracy:** verify every normative statement you write against the sources named in the README. Never invent clause numbers, APIs, macros or plusargs. Code must be legal IEEE 1800-2023 / uvm-core 2020.3.1 and compile-ready by inspection.
- **MDX safety:**
  - backtick bare < and <= in prose;
  - inside JSX text, write literal [x](y) as {"..."};
  - use only registered components;
  - use absolute canonical links only (/curriculum/<Tier_Folder>/<Module_Folder>/<lesson>).
- **Pinned elements:** keep every e2e-pinned element for your modules (spine §3.5): texts, test ids, regions.
- **Junior clarity:** define every term at its first use, in one plain sentence or with a link to where it is defined. A junior reading top to bottom must never meet an undefined term, such as elaboration, process, driver, continuous assignment, time slot, phase or sequencer. Introduce one idea at a time, building from what the learner already knows (the BeforeYouStart prerequisites).
- **Objective coverage:** in your author log, give a table mapping each objective to where it is taught, its quiz question numbers and its cards. Every objective needs at least one quiz question carrying that objective number. Each misconception named on your spine card must appear as a quiz distractor (with feedback) or as a card.
- **Legacy pages:** convert any page that uses \`export const metadata\`, <InfoPage>, "Level 1/Level 2" sections or hand-written Next links to the template, with frontmatter title, description and flashcards.
- **Decks:** your deck id is in your notes or your page frontmatter.
  - A placeholder deck (empty or one card) must be filled: at least 10 cards for a module deck and at least 6 for a sub-lesson deck.
  - You may seed cards from an old combined deck (such as I-SV-2_Constrained_Randomization.json or I-UVM-2_Building_TB.json). Copy them with new unique ids (prefix your deck's short code) and correct them.
  - Never edit a combined deck; the lead retires them.
- **Split groups:** before writing, read the current versions of the sibling pages named in your notes; they may be mid-rewrite. Stay inside your page's scope as the spine card defines it, link siblings with canonical URLs, and never duplicate their depth.
- **Interrupted runs:** if an earlier interrupted run left partial edits in your files (check git diff), continue from them.`

const VALIDATE = (g) => `VALIDATE (must pass before you return):
- node scripts/check-mdx.mjs <your pages>: 0 errors, and 0 template or legacy warnings on pages you touched. If your scope names specific files, check only those files (another author may own other pages in the same folder). A "deck exists but is not registered yet" warning is fine; the lead registers new decks.
- npm run -s validate:flashcards
- If you touched labs: NODE_OPTIONS='--require @prisma/client' npx vitest run tests/qa/labsPlatformAudit.spec.ts

WRITE docs/curriculum-quality/reviews/${g.id}.author.md. For each module:
- the verdict handled;
- a table mapping every S1/S2 issue ID (analysis and verify) to how it was resolved;
- a must-cover table showing where each item is covered;
- the expert items added, with sources;
- pictures (concept to picture);
- quiz and flashcard counts;
- the hands-on element;
- deferred items, with reasons;
- lead requests.

RULES: no git state changes, no npm install, no builds or servers, and no large files. Edit only your scope.
RETURN the structured summary.`

function authorPrompt(g) {
  const head = g.kind === 'new'
    ? `You are author ${g.id} (${g.name}) in the sv-uvm-guide curriculum quality program, phase 4. You are creating NEW content. Repo ${ROOT}, branch curriculum-quality-program. Other authors edit other modules in parallel; three reviewers will check your work.\n\nNEW CONTENT SPEC:\n${g.spec}`
    : `You are author ${g.id} (${g.name}) in the sv-uvm-guide curriculum quality program, phase 4 (implementation). Repo ${ROOT}, branch curriculum-quality-program. Other authors edit other modules in parallel; three reviewers will check your work.\n\nGOAL: bring every page in your scope to the target standard and to its intent: accurate, complete, junior-to-expert, visual, easy to follow and well navigated. Do what the verdict requires: rewrite from scratch, major rework, or targeted edits.${g.notes ? `\n\nGROUP NOTES:\n${g.notes}` : ''}`
  return `${head}\n\n${READ(g)}\n\nYOUR SCOPE (edit only these):\n${scope(g)}\nDo NOT edit anything else: src/**, the manifest, other modules, registries. Put shared needs under leadRequests.\n\n${HOW}\n\n${VALIDATE(g)}`
}

const LENSES = {
  accuracy: `ACCURACY lens. For every page, deck and lab in scope:
- verify every normative claim, code block, quiz answer key, flashcard and diagram against the primary sources (IEEE 1800-2023 text at /Users/Rakesh/.claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/sources/t1_lrm_clean.txt, which is one huge line, so search it with Python slicing; uvm-core 2020.3.1 on GitHub via WebFetch; the Arm texts in the same audit folder);
- confirm every S1/S2 issue from the analysis and verify reports is resolved correctly;
- look for new errors introduced by the rewrite;
- check code by inspection: legal syntax, declared names, real APIs, and behaviour that matches the prose and the "Expected output".
FAIL if any S1 or S2 problem remains.`,
  completeness: `COMPLETENESS, DEPTH AND PEDAGOGY lens. For every page in scope:
- every must-cover item on the spine card is covered;
- each core concept passes the 10-item completeness checklist;
- the depth ladder is complete: core path, practitioner depth, and at least 3 (index) or 2 (sub-lesson) "### Expert:" items with sources;
- 3-5 observable objectives, each exercised, and each tested by at least one quiz question (check the objective fields);
- quiz counts (at least 5 on an index, 4 on a sub-lesson), with feedback on every answer and misconception distractors;
- a deck of at least 10 aligned, correct cards;
- a hands-on element;
- exact template structure;
- clarity for a junior: terms defined before use, small steps, nothing skipped.
FAIL if any must-cover item, layer, objective test or required element is missing, or if any S1 or S2 pedagogy problem remains.`,
  visuals: `VISUALS, NAVIGATION AND ACCESSIBILITY lens. For every page in scope:
- every core concept has an accurate picture;
- diagram-kit props are valid and match the code exactly (names, ports, directions, timing values sampled at edges) (run node scripts/check-mdx.mjs on the module folders);
- visualizers are introduced, used for prediction and debriefed;
- inline SVG and images are accessible (role/aria-label or title, captions, no colour-only cues) and theme-safe (currentColor or tokens, no hard-coded white or black text);
- navigation: <BeforeYouStart /> at the end of Quick Take, <NextLesson /> in References, no hand-written Next, canonical absolute links, Related links resolve, LabLink only to available labs;
- the e2e-pinned elements for these modules (spine §3.5) are intact.
FAIL if any S1 or S2 problem remains.`,
}

function reviewPrompt(g, lens, round, author) {
  return `You are the ${lens} reviewer (round ${round}) for group ${g.id} (${g.name}) in the sv-uvm-guide curriculum quality program. Repo ${ROOT}. Read-only, except for your notes file.

SCOPE under review:
${scope(g)}

Read the brief docs/curriculum-quality/README.md, plan.md §4 (definition of done), the spine cards and §3.5/§5, ${g.analysis && g.analysis.length ? `the analysis ${g.analysis.join(', ')} and any .verify.md,` : `the new content spec: ${g.spec},`} and the author's change log docs/curriculum-quality/reviews/${g.id}.author.md. Then read the changed files in full (git diff for edits; new files whole).

${LENSES[lens]}

Write docs/curriculum-quality/reviews/${g.id}.${lens}.r${round}.md with your findings. Each finding has severity S1-S4, file:line, the problem, the fix and the source checked.
The author's summary: ${JSON.stringify(author).slice(0, 3000)}
RETURN the structured summary: lens="${lens}"; findings as strings "Sev file:line - problem -> fix (source)"; pass=true only if no S1 or S2 remains.`
}

function fixPrompt(g, reviews, round) {
  const findings = reviews.map((r) => `[${r.lens}]\n${r.findings.join('\n')}`).join('\n\n')
  return `You are author ${g.id} (${g.name}) again, fix round ${round}. Reviewers found problems. Resolve every S1 and S2 finding, and the S3 findings where reasonable, within your scope. Then re-run validation and update docs/curriculum-quality/reviews/${g.id}.author.md with a "Fix round ${round}" section.

${READ(g)}

YOUR SCOPE:
${scope(g)}

${HOW}

FINDINGS:
${findings}

${VALIDATE(g)}`
}

async function runGroup(g) {
  // g.priorAuthor: the author already finished in an earlier run; go straight to review.
  let author = g.priorAuthor || await agent(authorPrompt(g), { label: `author:${g.id}`, phase: 'Author', schema: AUTHOR_SCHEMA })
  if (!author) return { group: g.id, status: 'author-failed' }
  let lenses = ['accuracy', 'completeness', 'visuals']
  const last = {}
  for (let round = 1; round <= 3; round += 1) {
    const reviews = await parallel(lenses.map((lens) => () => agent(reviewPrompt(g, lens, round, author), { label: `review:${g.id}:${lens}:r${round}`, phase: 'Review', schema: REVIEW_SCHEMA })))
    reviews.forEach((r, i) => { if (r) last[lenses[i]] = r })
    const failing = lenses.filter((lens, i) => !reviews[i] || !reviews[i].pass)
    if (!failing.length) return { group: g.id, status: 'clean', rounds: round, author, open: [] }
    if (round === 3) return { group: g.id, status: 'escalate', rounds: round, author, open: failing.flatMap((l) => (last[l] ? last[l].findings.map((f) => `[${l}] ${f}`) : [`[${l}] review failed to run`])) }
    const fixed = await agent(fixPrompt(g, failing.map((l) => last[l]).filter(Boolean), round), { label: `fix:${g.id}:r${round}`, phase: 'Fix', schema: AUTHOR_SCHEMA })
    if (fixed) author = fixed
    lenses = failing
  }
}

const groups = args.groups
log(`Implementing ${groups.length} group(s): ${groups.map((g) => g.id).join(', ')}`)
const results = await parallel(groups.map((g) => () => runGroup(g)))
return results.filter(Boolean).map((r) => ({
  group: r.group,
  status: r.status,
  rounds: r.rounds,
  files: r.author && r.author.filesChanged ? r.author.filesChanged.length : 0,
  expert: r.author ? r.author.expertItemsAdded : 0,
  pictures: r.author ? r.author.picturesAdded : 0,
  quiz: r.author ? r.author.quizQuestions : 0,
  cards: r.author ? r.author.flashcards : 0,
  deferred: r.author ? r.author.issuesDeferred : [],
  leadRequests: r.author ? r.author.leadRequests : [],
  open: r.open,
}))
