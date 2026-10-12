export const meta = {
  name: 'interview-banks-g29',
  description: 'G29: rewrite or fix the six interview banks, with accuracy and completeness review loops',
  whenToUse: 'Phase 4 of the curriculum quality program, bank group G29',
  phases: [
    { title: 'Author', detail: 'one author per bank' },
    { title: 'Review', detail: 'accuracy and completeness reviewers per bank' },
    { title: 'Fix', detail: 'author resolves findings; failing lenses re-review (max 3 rounds)' },
  ],
}

const ROOT = '/Users/Rakesh/Projects/sv-uvm-guide'
const AUDIT = '/Users/Rakesh/.claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/sources'

const BANKS = [
  { id: 'B-SV', file: 'systemverilog.json', verdict: 'major', title: 'SystemVerilog Interview Question Bank',
    sources: `IEEE 1800-2023 text at ${AUDIT}/t1_lrm_clean.txt (very long lines: search it with Python).` },
  { id: 'B-UVM', file: 'uvm.json', verdict: 'REWRITE', title: 'UVM Interview Question Bank',
    sources: `IEEE 1800.2-2020 text at ${AUDIT}/uvm_lrm.txt (search with Python); uvm-core 2020.3.1 behaviour only where you label it as the implementation. Keep the question id 'uvm-factory-purpose' (a test pins it).` },
  { id: 'B-SVA', file: 'sva-formal.json', verdict: 'major', title: 'SVA & Formal Verification Interview Question Bank',
    sources: `IEEE 1800-2023 (${AUDIT}/t1_lrm_clean.txt), clause 16 for assertions. Tool-specific formal features must be labelled as tool behaviour, not standard.` },
  { id: 'B-DBG', file: 'debug.json', verdict: 'major', title: 'Debug & Triage Interview Question Bank',
    sources: `IEEE 1800-2023 (${AUDIT}/t1_lrm_clean.txt) and IEEE 1800.2-2020 (${AUDIT}/uvm_lrm.txt). Replace every bare "(secondary)" source with a named, checkable one or a clearly labelled tool/practice note; never invent tool flags.` },
  { id: 'B-SOC', file: 'soc-system-design.json', verdict: 'major', title: 'SoC & System-Design Interview Question Bank',
    sources: `IEEE 1800-2023, IEEE 1800.2-2020 (${AUDIT}), Accellera PSS (name the version you cite only if verified via WebFetch of accellera.org), Arm specifications via WebFetch of developer.arm.com. Practice/judgement answers are fine but must be labelled as practice, not standard.` },
  { id: 'B-AMBA', file: 'amba-protocols.json', verdict: 'major', title: 'AMBA Protocol Interview Question Bank',
    sources: `AHB5: Arm IHI0033C text at ${AUDIT}/ahb5.txt (the analysis calls it B.b; it is Issue C — cite C). AXI/ACE: Arm IHI0022 via WebFetch of https://developer.arm.com/documentation/ihi0022/latest and sub-pages. APB: IHI0024 via WebFetch. CHI: IHI0050 via WebFetch. Cite the issue and section only where you verified them. The AMBA lessons B-* are being rewritten in parallel; your answers must agree with the specifications, and where a lesson disagrees, record it as a lead request rather than editing the lesson.` },
]

const AUTHOR_SCHEMA = {
  type: 'object',
  properties: {
    bank: { type: 'string' },
    questionsBefore: { type: 'number' },
    questionsAfter: { type: 'number' },
    byLevel: { type: 'string' },
    idsRemoved: { type: 'array', items: { type: 'string' } },
    idsRenamed: { type: 'array', items: { type: 'string' } },
    issuesResolved: { type: 'number' },
    issuesDeferred: { type: 'array', items: { type: 'string' } },
    leadRequests: { type: 'array', items: { type: 'string' } },
    validation: { type: 'string' },
  },
  required: ['bank', 'questionsBefore', 'questionsAfter', 'byLevel', 'idsRemoved', 'idsRenamed', 'issuesResolved', 'issuesDeferred', 'leadRequests', 'validation'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    lens: { type: 'string' },
    pass: { type: 'boolean' },
    findings: { type: 'array', items: { type: 'string' } },
  },
  required: ['lens', 'pass', 'findings'],
}

const FORMAT = `BANK FORMAT (read src/types/interview-question.ts and src/app/(learning)/interview-prep/interview-banks.ts + page.tsx to see exactly what renders):
- Required per question: id, topic, level (junior | mid | senior | staff | senior-staff), category (concept | waveform-debug | coding | verification-plan | trick | staff-system-design), prompt, rubric, model_answer, sources.
- Optional fields the page renders and you should use: "modules" (lesson refs "<ModuleFolder>/<lesson>", e.g. "I-SV-5_Synchronization_and_IPC/mailboxes" — every question should name the lesson(s) that teach it; check each ref exists under content/curriculum/), "code" (code the candidate reads with the prompt, shown before the answer), "follow_ups" (interviewer probes), "common_mistakes" (what weak answers get wrong).
- model_answer and rubric support inline \`code\` and fenced \`\`\`systemverilog blocks (see RichText in page.tsx). A "coding" question must contain code; a "waveform-debug" question must show the waveform as a text cycle table in "code".
- sources: plain strings like "IEEE 1800-2023 §16.9.3" or objects {doc, section, verified}. Cite clause numbers ONLY where you verified them in the source text; otherwise use {doc, verified:false}. Never invent clause numbers, APIs, macros, flags or plusargs.
- Keep the bank's top-level id, topic and title unchanged (title "{TITLE}" — its heading anchor is linked from lessons).
- Keep existing question ids for questions that survive (src/lib/practice-links.ts INTERVIEW_QUESTION_LESSONS maps ids; a test fails if a mapped id disappears). If you remove or rename ids, list them in idsRemoved/idsRenamed; the lead updates the map. Do not edit src/.`

function scope(b) {
  return `- content/interview-questions/${b.file} (the only content file you may edit)
- your log docs/curriculum-quality/reviews/G29-${b.id}.author.md`
}

const READ = (b) => `READ FIRST: docs/curriculum-quality/README.md (brief), docs/curriculum-quality/analysis/G29.md (the section for ${b.file}, the Coverage gaps table at "## Coverage gaps", and "## Requests for the lead"), docs/curriculum-quality/analysis/G29.verify.md (corrections to the analysis, and "## Notes for the implementation author"), and docs/curriculum-quality/curriculum-spine.md (module ids and order) so every question maps to a real lesson.`

const VALIDATE = `VALIDATE (all must pass; report results):
- python3 -c "import json;json.load(open('content/interview-questions/<file>'))"
- NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts
  (a failure only because an id you removed is still in INTERVIEW_QUESTION_LESSONS is expected: list it in idsRemoved.)
Do not run git add/commit/stash/checkout, generators, builds or servers. Other agents edit other files in parallel.`

function authorPrompt(b) {
  return `You are bank author G29-${b.id} in the sv-uvm-guide curriculum quality program (repo ${ROOT}, branch curriculum-quality-program). Verdict for ${b.file}: ${b.verdict}.

GOAL: make this interview bank accurate, complete and useful from junior to senior staff. Fix every S1 and S2 the analysis and verification list for this bank, resolve S3s where reasonable, and fill the coverage gaps the analysis assigns to this bank. Aim for real interview quality: precise prompts, model answers that teach the why (with code or a cycle table where it helps), rubrics that say what separates a strong answer from a weak one, follow-up probes, and common mistakes. Spread questions across levels: at least 3 junior, and mid, senior and staff/senior-staff items; ${b.verdict === 'REWRITE' ? 'rewrite the bank from scratch to at least 20 questions' : 'grow the bank to at least 14 questions where the gaps justify it'}. Every question maps to the lesson(s) that teach it via "modules".

${READ(b)}

SOURCES: ${b.sources}

${FORMAT.replace('{TITLE}', b.title)}

SCOPE (only these files):
${scope(b)}

WRITE docs/curriculum-quality/reviews/G29-${b.id}.author.md: a table of every analysis/verify finding for this bank and how it was resolved; a question map (id, level, category, modules, sources verified); ids removed/renamed; deferred items with reasons; lead requests.

${VALIDATE}`
}

const LENSES = {
  accuracy: `LENS accuracy: check every normative statement, model answer, rubric, code sample and citation against the primary sources named above. Code must be legal and do what the answer says. Clause numbers must be real and on point. Flag invented APIs/flags/clauses, wrong answer keys, and answers that disagree with the standards. S1 = teaches a wrong model or wrong answer key; S2 = materially misleading or wrong citation; S3 = imprecise; S4 = polish.`,
  completeness: `LENS completeness and usefulness: check that every S1/S2 in G29.md/G29.verify.md for this bank is resolved, the assigned coverage gaps are filled, levels span junior to senior staff (at least 3 junior), coding/waveform items carry code or a cycle table, rubrics discriminate strong vs weak answers, follow_ups and common_mistakes are present and useful, and every question has correct "modules" refs that exist under content/curriculum/ (check the folders). Also check the JSON is valid and the validation tests pass.`,
}

function reviewPrompt(b, lens, round, author) {
  return `You are the ${lens} reviewer (round ${round}) for interview bank G29-${b.id} (${b.file}) in the sv-uvm-guide curriculum quality program. Repo ${ROOT}. Read-only, except for your notes file.

${READ(b)} Then read the author's log docs/curriculum-quality/reviews/G29-${b.id}.author.md and the whole bank file (git diff HEAD -- content/interview-questions/${b.file} for what changed).

SOURCES: ${b.sources}

${LENSES[lens]}

Write docs/curriculum-quality/reviews/G29-${b.id}.${lens}.r${round}.md with your findings. Each finding: severity S1-S4, question id, the problem, the fix and the source checked.
The author's summary: ${JSON.stringify(author).slice(0, 2500)}
RETURN: lens="${lens}"; findings as strings "Sev question-id - problem -> fix (source)"; pass=true only if no S1 or S2 remains.`
}

function fixPrompt(b, reviews, round) {
  const findings = reviews.map((r) => `[${r.lens}]\n${r.findings.join('\n')}`).join('\n\n')
  return `You are bank author G29-${b.id} (${b.file}) again, fix round ${round}. Resolve every S1 and S2 finding, and S3s where reasonable. Then re-run validation and add a "Fix round ${round}" section to docs/curriculum-quality/reviews/G29-${b.id}.author.md.

SOURCES: ${b.sources}

${FORMAT.replace('{TITLE}', b.title)}

SCOPE:
${scope(b)}

FINDINGS:
${findings}

${VALIDATE}`
}

async function runBank(b) {
  // args.reviewOnly: the bank authors already finished; go straight to review.
  let author = (typeof args !== 'undefined' && args && args.reviewOnly)
    ? { bank: b.file, note: 'Author finished in an earlier run; its log docs/curriculum-quality/reviews/G29-' + b.id + '.author.md is the account of the changes.' }
    : await agent(authorPrompt(b), { label: `author:${b.id}`, phase: 'Author', schema: AUTHOR_SCHEMA })
  if (!author) return { bank: b.id, status: 'author-failed' }
  let lenses = ['accuracy', 'completeness']
  const last = {}
  for (let round = 1; round <= 3; round += 1) {
    const reviews = await parallel(lenses.map((lens) => () => agent(reviewPrompt(b, lens, round, author), { label: `review:${b.id}:${lens}:r${round}`, phase: 'Review', schema: REVIEW_SCHEMA })))
    reviews.forEach((r, i) => { if (r) last[lenses[i]] = r })
    const failing = lenses.filter((lens, i) => !reviews[i] || !reviews[i].pass)
    if (!failing.length) return { bank: b.id, status: 'clean', rounds: round, author, open: [] }
    if (round === 3) return { bank: b.id, status: 'escalate', rounds: round, author, open: failing.flatMap((l) => (last[l] ? last[l].findings.map((f) => `[${l}] ${f}`) : [`[${l}] review failed to run`])) }
    const fixed = await agent(fixPrompt(b, failing.map((l) => last[l]).filter(Boolean), round), { label: `fix:${b.id}:r${round}`, phase: 'Fix', schema: AUTHOR_SCHEMA })
    if (fixed) author = fixed
    lenses = failing
  }
}

log(`Interview banks: ${BANKS.map((b) => b.file).join(', ')}`)
const results = await parallel(BANKS.map((b) => () => runBank(b)))
return results.filter(Boolean).map((r) => ({
  bank: r.bank,
  status: r.status,
  rounds: r.rounds,
  questions: r.author && r.author.questionsBefore !== undefined ? `${r.author.questionsBefore} -> ${r.author.questionsAfter} (${r.author.byLevel})` : '',
  idsRemoved: r.author ? r.author.idsRemoved : [],
  idsRenamed: r.author ? r.author.idsRenamed : [],
  deferred: r.author ? r.author.issuesDeferred : [],
  leadRequests: r.author ? r.author.leadRequests : [],
  open: r.open || [],
}))
