export const meta = {
  name: 'compile-fix',
  description: 'Fix the lesson and lab code that fails the Verilator compile check (npm run test:sv): one fixer per file, then an independent check',
  whenToUse: 'After phase 6b integrates, before 6a. Args: groups from docs/curriculum-quality/workflows/compile-fix-args.mjs',
  phases: [
    { title: 'Fix', detail: 'one agent per lesson file or lab: fix content bugs, settle to-verify entries, probe past Verilator limitations' },
    { title: 'Check', detail: 'independent check of each fixed file; one repair round' },
  ],
}

const ROOT = '/Users/Rakesh/Projects/sv-uvm-guide'
const SRC = '/Users/Rakesh/.claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/sources'
const UVM = '/Users/Rakesh/Downloads/1800.2-2020.3.1'

const CONTEXT = `Repo ${ROOT} (Next.js site teaching SystemVerilog, UVM and AMBA from junior to expert), branch curriculum-quality-program.
CI now compiles every lesson code block tagged \`// compile\` and every lab bench with Verilator 5.052 and uvm-core 2020.3.1: \`npm run test:sv\` (scripts/compile-sv.mjs; read its header comment for how lesson blocks become units). The tag rules are in docs/curriculum-quality/curriculum-spine.md §5.2. Units that fail are listed under "known" in scripts/sv-compile.config.json with a kind: content-bug, to-verify, harness or verilator-limitation.

Run one unit and see its real status: UVM_HOME=${UVM} node scripts/compile-sv.mjs --only '<unit id>' --verbose  (prints "ok" or "FAIL" per unit; with --only, known failures never fail the exit code, so read the ok/FAIL line). Add --report <scratch file> to get the errors as JSON with lesson line numbers.

Primary sources (copyrighted; read in place, never copy into the repo), in ${SRC}/: t1_lrm_clean.txt = IEEE 1800-2023, uvm_lrm.txt = IEEE 1800.2-2020; each is a few very long lines, so search with Python slicing. uvm-core source: ${UVM}/src. Never invent clause numbers.`

const RULES = `Edit ONLY the files of your group (the lesson .mdx, or the lab folder's files), plus the lesson's own flashcard deck if a renamed identifier appears there. Never edit scripts/sv-compile.config.json (the lead updates it from your report), and never run git add/commit/stash/checkout/reset, generators, builds or servers. Other fixers edit other files in parallel. Keep every change minimal: the lesson's teaching, structure, headings, anchors, quiz and deck ids stay as they are.`

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    group: { type: 'string' },
    units: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['pass', 'fail'], description: 'compile-sv --only <id> --verbose after your edits' },
          kind: { type: 'string', enum: ['fixed', 'verilator-limitation', 'content-bug', 'harness'], description: 'fixed = now compiles; otherwise what still blocks it' },
          reason: { type: 'string', description: 'for a unit that still fails: one or two sentences for scripts/sv-compile.config.json, naming the construct and the IEEE 1800-2023 clause that makes it legal (limitation) or the remaining defect' },
          hiddenBugs: { type: 'array', items: { type: 'string' }, description: 'content bugs found past a Verilator limitation, with file:line and whether you fixed them' },
        },
        required: ['id', 'status', 'kind', 'reason', 'hiddenBugs'],
      },
    },
    changes: { type: 'array', items: { type: 'string' }, description: 'file:line old -> new, one per edit' },
    validation: { type: 'string', description: 'commands run and their results (compile-sv per unit; check-mdx --render for .mdx)' },
  },
  required: ['group', 'units', 'changes', 'validation'],
}

const CHECK_SCHEMA = {
  type: 'object',
  properties: { pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } } },
  required: ['pass', 'problems'],
}

const KIND_TASK = {
  'content-bug': 'CONTENT BUG: fix the code so it is legal IEEE 1800-2023 / uvm-core 2020.3.1 and still does what the lesson says. A reserved keyword used as a name (matches, before, priority ...) gets a clear new name everywhere it is used, including prose, captions, tables and expected-output text that names the variable; printed labels such as "matches=%0d" in a summary line stay unchanged if other pages, labs or milestone formats quote them (grep the repo before changing any printed text). A missing endmodule is added. Mixed time scales (TIMESCALEMOD; IEEE 1800-2023 3.14.2.3 makes them an error) are fixed by giving every design element of the unit the same timeunit/timeprecision or `timescale, per spine §5.2 item 5. A block that includes a header the lesson never tags gets that header tagged `// compile: <file>.svh` (or the include is resolved another way that keeps the lesson correct).',
  'to-verify': 'TO VERIFY: decide from the LRM text whether the code is legal. If it is illegal, or is a fragment wrongly tagged `// compile`, fix it (complete the unit, or retag it `// snippet` only if it is meant as a fragment and the lesson says so). If it is legal and only Verilator rejects it, change nothing and report kind verilator-limitation with the clause.',
  harness: 'HARNESS: the blocks are not tagged so that the checker can assemble the bench. Retag them per spine §5.2 (for B-AHB-3: each "(part of the bench)" block becomes `// compile: <file>.sv (file N of M)` using the file name in the bold label above it), so they compile together as one bench.',
  'verilator-limitation': 'VERILATOR LIMITATION (recorded): first confirm from the LRM that the construct really is legal; if it is not, it is a content bug and you fix it. If it is legal, probe past it: copy the unit into a scratch folder under /private/tmp/claude-502/-Users-Rakesh-Projects-sv-uvm-guide/6113778b-4d4d-4d58-846e-6705366b1234/scratchpad/compile-fix/, work around only the unsupported construct there (comment it out or rewrite it), and compile the rest with verilator --lint-only --timing -Wall -Wno-fatal (plus -I' + UVM + '/src ' + UVM + '/src/uvm_pkg.sv for UVM) to find any content bug it was hiding. Fix hidden bugs in the real file; never put a Verilator workaround into the lesson.',
}

function fixPrompt(group) {
  return `${CONTEXT}

${RULES}

YOUR GROUP: ${group.source} (files: ${group.files.join(', ')}). Its failing units:
${group.units.map((u) => `- ${u.id} [${u.kind}] ${u.reason}\n  errors: ${u.errors.slice(0, 4).join(' | ').slice(0, 900)}`).join('\n')}

For each unit, by kind:
${[...new Set(group.units.map((u) => u.kind))].map((k) => `- ${KIND_TASK[k]}`).join('\n')}

Read the whole lesson (or the lab README, lab.json and files) before editing, so names and prose stay consistent.
${group.note ? `\nNOTE: ${group.note}\n` : ''}
VALIDATE: every unit with compile-sv --only '<id>' --verbose; for an .mdx file also node scripts/check-mdx.mjs --render <file> (0 errors); for a lab, NODE_OPTIONS='--require @prisma/client' npx vitest run tests/qa/labsPlatformAudit.spec.ts.
RETURN group, units (status after your edits, kind, reason for anything still failing, hiddenBugs), changes, validation.`
}

function checkPrompt(group, fix) {
  return `${CONTEXT}

You are READ-ONLY: do not edit any file; never run git add/commit/stash/checkout/reset, generators, builds or servers.

Independently check the compile fixes just made for ${group.source} (git diff HEAD -- ${group.files.join(' ')}). The fixer reported: ${JSON.stringify(fix).slice(0, 3000)}

Check that: each edit is legal IEEE 1800-2023 / uvm-core 2020.3.1 and the lesson's text, captions, expected output and quiz still agree with the code; renamed identifiers are renamed everywhere on the page (and nowhere a printed format other pages quote was changed); nothing else changed; each unit the fixer calls fixed shows "ok" with compile-sv --only '<id>' --verbose; each unit still failing has a reason that holds up against the LRM; check-mdx --render passes for .mdx files.
RETURN pass=true only if all is well; problems as "file:line - problem -> fix".`
}

const groups = args

phase('Fix')
const results = await pipeline(
  groups,
  (group) => agent(fixPrompt(group), { label: `fix:${group.source.split('/').slice(-2).join('/')}`, phase: 'Fix', schema: FIX_SCHEMA }),
  async (fix, group) => {
    if (!fix) return { group: group.source, status: 'fix-failed' }
    const check = await agent(checkPrompt(group, fix), { label: `check:${group.source.split('/').slice(-2).join('/')}`, phase: 'Check', schema: CHECK_SCHEMA })
    if (check && !check.pass) {
      const repairGroup = { ...group, note: `An independent check found problems with the first fix; resolve them:\n${check.problems.join('\n')}` }
      const repair = await agent(fixPrompt(repairGroup), { label: `repair:${group.source.split('/').slice(-2).join('/')}`, phase: 'Check', schema: FIX_SCHEMA })
      return { group: group.source, status: repair ? 'repaired' : 'check-failed', fix: repair ?? fix, check }
    }
    return { group: group.source, status: check ? 'clean' : 'check-missing', fix, check }
  },
)
const done = results.filter(Boolean)
log(`${done.length}/${groups.length} groups done: ${done.filter((r) => r.status === 'clean').length} clean, ${done.filter((r) => r.status === 'repaired').length} repaired`)
return done
