export const meta = {
  name: 'phase6-closure-sweep',
  description: 'Curriculum-wide accuracy and completeness/consistency critics, adversarially verified, fixed and re-checked, looping until two dry rounds',
  whenToUse: 'Phase 6 (closure) of the curriculum quality program, after every wave is integrated',
  phases: [
    { title: 'Critique', detail: '19 lesson groups x 2 lenses + one curriculum-wide consistency critic per round' },
    { title: 'Verify', detail: '3 independent skeptics per S1/S2 finding; survives only if at least 2 fail to refute it' },
    { title: 'Fix', detail: 'one fixer per file for the confirmed findings' },
    { title: 'Check', detail: 'independent check of every fixed file' },
  ],
}

const ROOT = '/Users/Rakesh/Projects/sv-uvm-guide'
const SRC = '/Users/Rakesh/.claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/sources'
const T1 = 'content/curriculum/T1_Foundational/', T2 = 'content/curriculum/T2_Intermediate/', T3 = 'content/curriculum/T3_Advanced/', T4 = 'content/curriculum/T4_Expert/'

const GROUPS = [
  { id: 'G01', name: 'Foundations: why verification, SV basics', mods: ['F1A', 'F1B', 'F1C', 'F2A'], dir: T1 },
  { id: 'G02', name: 'Foundations: constructs, procedural code, reuse, first testbench', mods: ['F2B', 'F2C', 'F2D', 'F2E'], dir: T1 },
  { id: 'G03', name: 'Foundations: blocks, scheduling, races, modules, interfaces, RTL constructs', mods: ['F3A', 'F3B', 'F3C', 'F4A', 'F4B', 'F4C'], dir: T1 },
  { id: 'G04', name: 'SV OOP', mods: ['I-SV-1'], dir: T2 },
  { id: 'G05', name: 'Constrained randomization', mods: ['I-SV-2A', 'I-SV-2B'], dir: T2 },
  { id: 'G06', name: 'Functional coverage', mods: ['I-SV-3A', 'I-SV-3B'], dir: T2 },
  { id: 'G07', name: 'Assertions (SVA) and checkers', mods: ['I-SV-4A', 'I-SV-4B', 'I-SV-4C'], dir: T2 },
  { id: 'G08', name: 'IPC, DPI, power intent, why UVM', mods: ['I-SV-5', 'I-SV-6', 'I-SV-7', 'I-SV-8', 'I-SV-9'], dir: T2 },
  { id: 'G09', name: 'UVM components, factory, phasing, reporting, TB build, config', mods: ['I-UVM-1A', 'I-UVM-1B', 'I-UVM-1C', 'I-UVM-1D', 'I-UVM-2A', 'I-UVM-2B', 'I-UVM-2C'], dir: T2 },
  { id: 'G10', name: 'UVM sequences fundamentals, first complete TB, factory/phasing deep dives, recording', mods: ['I-UVM-3A', 'I-UVM-3C', 'I-UVM-4', 'I-UVM-5', 'I-UVM-6'], dir: T2 },
  { id: 'G11', name: 'Advanced sequencing and layering', mods: ['I-UVM-3B'], dir: T2 },
  { id: 'G12', name: 'RAL and callbacks', mods: ['A-UVM-4A', 'A-UVM-4B', 'A-UVM-5'], dir: T3 },
  { id: 'G13', name: 'Scoreboards, VIP, multi-agent, reset and error injection', mods: ['A-UVM-6', 'A-UVM-7', 'A-UVM-8', 'A-UVM-9'], dir: T3 },
  { id: 'G14', name: 'AMBA families, APB, AHB', mods: ['B-AMBA-1', 'B-AMBA-2', 'B-APB-1', 'B-AHB-1', 'B-AHB-2', 'B-AHB-3'], dir: T3 },
  { id: 'G15', name: 'AXI', mods: ['B-AXI-1', 'B-AXI-2', 'B-AXI-3', 'B-AXI-4', 'B-AXI-5', 'B-AXI-6'], dir: T3 },
  { id: 'G16', name: 'AMBA bridges, ACE/CHI, interview clinic', mods: ['B-AMBA-F1', 'B-AMBA-F2', 'B-AMBA-F3'], dir: T3 },
  { id: 'G17', name: 'Expert debug, methodology, performance, formal', mods: ['E-DBG-1', 'E-CUST-1', 'E-PERF-1', 'E-INT-1'], dir: T4 },
  { id: 'G18', name: 'Expert PSS, power-aware, SoC', mods: ['E-PSS-1', 'E-PWR-1', 'E-SOC-1'], dir: T4 },
  { id: 'G19', name: 'Expert electives: emulation, Python, multi-language, RISC-V, AI', mods: ['E-EMU-1', 'E-PYUVM-1', 'E-UVM-ML-1', 'E-RISCV-1', 'E-AI-1'], dir: T4 },
]

const SOURCES = `Primary sources (copyrighted; read in place, never copy into the repo), in ${SRC}/ — each is a few very long lines, so search with Python slicing:
t1_lrm_clean.txt = IEEE 1800-2023 (SystemVerilog); uvm_lrm.txt = IEEE 1800.2-2020 (UVM); ahb5.txt = Arm IHI0033C; arm_ahb.txt = IHI0033B.b; arm_axi.txt = IHI0022E (AXI/ACE); arm_apb.txt = IHI0024C; arm_axis.txt = IHI0051A.
uvm-core 2020.3.1 implementation behaviour may be checked on GitHub via WebFetch (accellera-official/uvm-core) and must be labelled as implementation, not standard. Other standards (PSS, IEEE 1801, CHI, SCE-MI, RISC-V, cocotb/pyuvm docs) via WebFetch of official pages; never invent clause numbers.`

const CONTEXT = `Repo ${ROOT} (Next.js curriculum site teaching SystemVerilog, UVM and AMBA from junior to expert), branch curriculum-quality-program. Every lesson already passed a three-lens review in phase 4; this is the phase-6 closure sweep, so look for what those reviews missed, especially across lessons. Read docs/curriculum-quality/README.md (the brief), docs/curriculum-quality/plan.md §4 (definition of done) and the relevant cards in docs/curriculum-quality/curriculum-spine.md (module intent, must-cover, misconceptions, pinned elements §3.5, terminology §5). Lesson order and prerequisites: content/curriculum/curriculum.manifest.json. Each lesson's deck is content/flashcards/<deck>.json named in its frontmatter.

${SOURCES}

Severity: S1 = teaches a wrong model, wrong answer key, code that cannot work as claimed, or a broken learner path; S2 = materially misleading, incomplete on a must-cover item, wrong/unsupported citation, contradiction with another lesson, or a navigation/prerequisite defect a learner would hit; S3 = imprecise or weak; S4 = polish. Report only real, specific, evidenced problems with file and line. Do not report style preferences.`

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'repo-relative path' },
          line: { type: 'number' },
          severity: { type: 'string', enum: ['S1', 'S2', 'S3', 'S4'] },
          claim: { type: 'string', description: 'what is wrong, quoting the text' },
          evidence: { type: 'string', description: 'source and section, or the contradicting file:line' },
          fix: { type: 'string' },
        },
        required: ['file', 'line', 'severity', 'claim', 'evidence', 'fix'],
      },
    },
    coverageNote: { type: 'string', description: 'which files you read fully' },
  },
  required: ['findings', 'coverageNote'],
}
const VERDICT_SCHEMA = {
  type: 'object',
  properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['refuted', 'reason'],
}
const FIX_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    resolved: { type: 'array', items: { type: 'string' } },
    notResolved: { type: 'array', items: { type: 'string' } },
    changes: { type: 'array', items: { type: 'string' } },
    validation: { type: 'string' },
  },
  required: ['file', 'resolved', 'notResolved', 'changes', 'validation'],
}
const CHECK_SCHEMA = {
  type: 'object',
  properties: { pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } } },
  required: ['pass', 'problems'],
}

const READONLY = 'You are READ-ONLY: do not edit, create or delete any file; never run git add/commit/stash/checkout/reset, generators, builds or servers.'

function lensText(lens) {
  if (lens === 'accuracy') return `LENS: accuracy. For every lesson in your group (all .mdx pages of each module, their decks, and any labs they link under content/curriculum/labs/), check every normative statement, code block (must be legal and do what the text says; IEEE 1800-2023 / uvm-core 2020.3.1), quiz answer key, flashcard and diagram fact against the primary sources. Re-verify citations you can check. Look for errors the phase-4 reviewers missed.`
  return `LENS: completeness and coherence. For every lesson in your group: are all must-cover items and misconceptions on its spine card actually taught (not just mentioned)? Are the junior, practitioner and expert layers all present and right-sized? Does each lesson agree with its neighbours and prerequisites in the manifest (same terms per spine §5, no contradictions, no re-teaching that conflicts, prerequisites taught before use)? Do links, <NextLesson />, <BeforeYouStart />, LabLinks and interview-bank links point to the right places? Is anything a learner needs missing (a step, a picture of a core concept, a worked example, a debrief)?`
}

function criticPrompt(g, lens, round, seenSummary) {
  return `${CONTEXT}

${READONLY}

You are the round-${round} ${lens} critic for group ${g.id} (${g.name}): modules ${g.mods.join(', ')} under ${g.dir} (folders start with those ids). Read every lesson page in those module folders in full, plus their decks.

${lensText(lens)}

${seenSummary ? `Already reported in earlier rounds (do not repeat these; find new problems):\n${seenSummary}\n` : ''}
RETURN findings (may be empty) and coverageNote.`
}

function globalCriticPrompt(round, seenSummary) {
  return `${CONTEXT}

${READONLY}

You are the round-${round} curriculum-wide consistency critic. Instead of reading every page, search across all lessons (content/curriculum/T*/**/*.mdx), decks (content/flashcards) and interview banks (content/interview-questions) for facts taught in more than one place, and check they agree with each other and with the primary sources. Priorities: SV scheduling regions and races; blocking vs nonblocking; clocking blocks; $sampled/SVA sampling; UVM phases, objections and drain time; analysis ports (same handle, no copy); factory overrides; config_db precedence; sequence/sequencer handshake (get_next_item/item_done, start_item/finish_item); RAL prediction modes; AXI ordering by ID, 4KB rule, WSTRB; AHB HREADY/HREADYOUT, 1KB rule; APB SETUP/ACCESS; ACE/CHI states. Also check the spine §5 terminology is used consistently, and that no lesson teaches a topic its own spine card assigns to another module in a contradictory way.

${seenSummary ? `Already reported in earlier rounds (do not repeat):\n${seenSummary}\n` : ''}
RETURN findings (each with the file:line of the wrong statement and the contradicting file:line or source as evidence) and coverageNote.`
}

const SKEPTIC_LENSES = [
  'Refute it against the PRIMARY SOURCE: open the cited source section (or find the right one) and decide whether the lesson text is actually correct.',
  'Refute it as a MISREAD: re-read the lesson around the cited line (and nearby sections, captions, notes and labels like "illustrative", "uvm-core implementation", "tool-dependent") and decide whether the text, in context, actually says what the finding claims.',
  'Refute it on IMPACT: decide whether a learner following this lesson would actually be misled or blocked; a correct-but-different wording choice, a pedantic point, or something clearly qualified elsewhere on the page is refuted.',
]

function skepticPrompt(f, i) {
  return `${CONTEXT}

${READONLY}

A critic reported this ${f.severity} finding. Your job is to REFUTE it if you can. ${SKEPTIC_LENSES[i]}

FINDING: ${f.file}:${f.line}
Claim: ${f.claim}
Evidence given: ${f.evidence}
Proposed fix: ${f.fix}

If uncertain after checking, set refuted=false only if you are confident the problem is real; otherwise refuted=true. Give a short reason citing what you checked.`
}

function fixPrompt(file, items) {
  return `${CONTEXT}

You are the fixer for ${file}. Edit ONLY this file (and, if a finding names it, the lesson's own flashcard deck content/flashcards/<deck>.json or the lab files the finding names). Never run git add/commit/stash/checkout/reset, generators (npm run generate:*), builds or servers. Other fixers edit other files in parallel.

Each finding below was confirmed by independent skeptics. Fix each one correctly and minimally, verifying against the primary sources; keep the template structure, pinned elements (spine §3.5), objectives, quiz/deck ids and anything other pages rely on. Do not introduce unverified citations. If you believe a finding is wrong after checking the source, do not change the text: list it in notResolved with your evidence.

FINDINGS:
${items.map((f, k) => `[${k + 1}] ${f.severity} line ${f.line}: ${f.claim}\n    evidence: ${f.evidence}\n    proposed fix: ${f.fix}`).join('\n')}

VALIDATE: node scripts/check-mdx.mjs --render ${file} (0 errors) if it is an .mdx file; for a deck, node -e "JSON.parse(require('fs').readFileSync('<deck>','utf8'))"; if you edited a diagram, DIAGRAM_KIT_REPORT=1 NODE_OPTIONS='--require @prisma/client' npx vitest run tests/lib/diagram-kit-content.test.ts must show no finding in your file.
RETURN file, resolved (finding numbers with one-line description), notResolved (with evidence), changes, validation.`
}

function checkPrompt(file, items, fix) {
  return `${CONTEXT}

${READONLY}

Independently check the fixes just made to ${file} (see git diff HEAD -- ${file} and any deck/lab files the fixer reports). The fixer reported: ${JSON.stringify(fix).slice(0, 2500)}

The confirmed findings were:
${items.map((f, k) => `[${k + 1}] ${f.severity} line ${f.line}: ${f.claim} (evidence: ${f.evidence})`).join('\n')}

Check that each resolved finding is truly fixed and the new text is correct against the primary sources, that nothing else in the diff introduced an error or broke structure, pinned elements, links or anchors other pages use, and that check-mdx --render passes. For findings the fixer declined (notResolved), judge whether the fixer's evidence is right.
RETURN pass=true only if all is well; problems as "file:line - problem -> fix".`
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 10).join(' ')
const keyOf = (f) => `${f.file}|${norm(f.claim)}`

const seen = new Set()
const seenList = []
const fixedLog = []
const advisory = []
let dry = 0
let round = 0
const MAX_ROUNDS = 5

while (dry < 2 && round < MAX_ROUNDS) {
  round += 1
  const seenSummary = seenList.slice(-150).map((f) => `- ${f.file}:${f.line} ${f.claim.slice(0, 140)}`).join('\n')
  log(`Round ${round}: ${GROUPS.length * 2 + 1} critics`)

  const critics = [
    ...GROUPS.flatMap((g) => ['accuracy', 'completeness'].map((lens) => ({ label: `${g.id}:${lens}`, prompt: criticPrompt(g, lens, round, seenSummary) }))),
    { label: 'global:consistency', prompt: globalCriticPrompt(round, seenSummary) },
  ]

  // Critique and verify are pipelined: each critic's findings go to skeptics as soon as that critic finishes.
  const perCritic = await pipeline(
    critics,
    (c) => agent(c.prompt, { label: `critic:${c.label}:r${round}`, phase: 'Critique', schema: FINDINGS_SCHEMA }),
    async (res, c) => {
      if (!res) return []
      const fresh = res.findings.filter((f) => !seen.has(keyOf(f)))
      fresh.forEach((f) => { seen.add(keyOf(f)); seenList.push(f) })
      const serious = fresh.filter((f) => f.severity === 'S1' || f.severity === 'S2')
      fresh.filter((f) => f.severity === 'S3' || f.severity === 'S4').forEach((f) => advisory.push({ ...f, source: c.label, round }))
      const judged = await parallel(serious.map((f) => async () => {
        const votes = (await parallel([0, 1, 2].map((i) => () => agent(skepticPrompt(f, i), { label: `skeptic${i}:${f.file.split('/').slice(-2).join('/')}:${f.line}`, phase: 'Verify', schema: VERDICT_SCHEMA })))).filter(Boolean)
        const confirmed = votes.filter((v) => !v.refuted).length >= 2
        return { ...f, source: c.label, round, confirmed, votes: votes.map((v) => `${v.refuted ? 'refuted' : 'upheld'}: ${v.reason}`.slice(0, 300)) }
      }))
      return judged.filter(Boolean)
    },
  )

  const judgedAll = perCritic.filter(Boolean).flat()
  const confirmed = judgedAll.filter((f) => f.confirmed)
  log(`Round ${round}: ${judgedAll.length} new S1/S2 findings, ${confirmed.length} confirmed by skeptics`)
  if (!confirmed.length) { dry += 1; continue }
  dry = 0

  // Barrier: group confirmed findings by file so each file has exactly one fixer.
  const byFile = {}
  confirmed.forEach((f) => { (byFile[f.file] = byFile[f.file] || []).push(f) })
  const files = Object.keys(byFile)
  const fixResults = await pipeline(
    files,
    (file) => agent(fixPrompt(file, byFile[file]), { label: `fix:${file.split('/').slice(-2).join('/')}:r${round}`, phase: 'Fix', schema: FIX_SCHEMA }),
    async (fix, file) => {
      if (!fix) return { file, status: 'fix-failed', findings: byFile[file] }
      const check = await agent(checkPrompt(file, byFile[file], fix), { label: `check:${file.split('/').slice(-2).join('/')}:r${round}`, phase: 'Check', schema: CHECK_SCHEMA })
      if (check && !check.pass) {
        const repair = await agent(fixPrompt(file, check.problems.map((p) => ({ severity: 'S2', line: 0, claim: p, evidence: 'independent fix check', fix: 'resolve as described' }))), { label: `repair:${file.split('/').slice(-2).join('/')}:r${round}`, phase: 'Fix', schema: FIX_SCHEMA })
        return { file, status: repair ? 'repaired' : 'check-failed', fix, check, repair, findings: byFile[file] }
      }
      return { file, status: check ? 'clean' : 'check-missing', fix, check, findings: byFile[file] }
    },
  )
  fixedLog.push(...fixResults.filter(Boolean).map((r) => ({ round, ...r })))
}

if (round >= MAX_ROUNDS && dry < 2) log(`Stopped at the ${MAX_ROUNDS}-round cap before two dry rounds; the last round still found confirmed problems.`)

return {
  rounds: round,
  dryRoundsAtEnd: dry,
  filesFixed: fixedLog.map((r) => ({ round: r.round, file: r.file, status: r.status, resolved: r.fix ? r.fix.resolved : [], notResolved: r.fix ? r.fix.notResolved : [], checkProblems: r.check && !r.check.pass ? r.check.problems : [] })),
  advisoryS3S4: advisory.map((f) => `${f.severity} ${f.file}:${f.line} ${f.claim.slice(0, 200)}`),
}