export const meta = {
  name: 'no-login-implement',
  description: 'Implement the no-login mode: revise packages from the design and critiques, build the foundation, build packages in parallel with reviews, then integrate and verify',
  phases: [
    { title: 'Revise', detail: 'final work packages with disjoint file ownership, every critique gap assigned' },
    { title: 'Foundation', detail: 'shared learner store, persistence seam, flags, auth seam' },
    { title: 'Build', detail: 'feature packages in parallel' },
    { title: 'Review', detail: 'two lenses per package; fix rounds' },
    { title: 'Integrate', detail: 'whole-repo tests, types and lint; cross-package fixes' },
    { title: 'Verify', detail: 'anonymous-visitor walkthrough of the whole site' },
  ],
}

const ROOT = '/Users/Rakesh/Projects/sv-uvm-guide'
const CONTEXT = `Repo ${ROOT}: Next.js 14 App Router site (TypeScript, Tailwind, Vitest, Playwright; Prisma/NextAuth present but no database or real sign-in on the deploy) teaching SystemVerilog/UVM, deployed to Cloudflare Workers via OpenNext as prerendered pages. Owner decision (2026-10-18): "do not block anything for login; we can eventually implement it and guard it as required; the initial site should work completely." Design documents: docs/no-login/design.json (architecture, featureDecisions, workPackages), docs/no-login/critiques.json (gaps that MUST be addressed), docs/no-login/area-maps.json (current behaviour and tests per feature). The site deploys from the owner's machine after integration, so nothing you do is live until then.
Rules for every agent: never run git add/commit/stash/checkout/reset/restore; never run npm run generate:*, next build, cf:* scripts, next dev or any server; keep the code style of the surrounding files; keep accessibility (labels, focus, keyboard, contrast) and 390 px layouts; no new runtime dependencies unless the plan says so; never touch content/curriculum/** lessons, content/flashcards/** decks or content/interview-questions/**, except flashcard card ids if your package explicitly owns that task.`

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    packages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          dependsOn: { type: 'array', items: { type: 'string' } },
          files: { type: 'array', items: { type: 'string' }, description: 'every file (source AND test, existing or new) this package creates, edits or deletes; repo-relative; no globs' },
          tasks: { type: 'array', items: { type: 'string' } },
          tests: { type: 'array', items: { type: 'string' }, description: 'test commands/files that must pass for this package' },
          acceptance: { type: 'array', items: { type: 'string' } },
          gapsAddressed: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'title', 'dependsOn', 'files', 'tasks', 'tests', 'acceptance', 'gapsAddressed'],
      },
    },
    globalDecisions: { type: 'array', items: { type: 'string' }, description: 'decisions every package must follow (flags, storage keys, event bus, SSR rules, copy rules)' },
  },
  required: ['packages', 'globalDecisions'],
}

const revisePrompt = (extra) => `${CONTEXT}

You are the lead engineer. READ docs/no-login/design.json, docs/no-login/critiques.json and docs/no-login/area-maps.json in full, and verify against the code. Produce the FINAL implementation plan:
- Start from the design's work packages, but fix every gap in critiques.json (both critiques). Each gap must be assigned to a package (list it in gapsAddressed) or explicitly decided in globalDecisions. Key decisions already taken by the owner/lead:
  * Client-visible switches derive only from NEXT_PUBLIC_* values (or isFeatureEnabled reading them), so server render and hydration agree; ACCOUNTS stay off on this deploy.
  * Every visible feature works anonymously with data in the browser; features needing multi-user data or a secret (community, AI tutor, simulation, notifications) stay hidden (community gated on accounts too).
  * Pages that are only placeholders (/learning-strategies, /resources, /projects, /history, /assessment if mock) are hidden (notFound, removed from navigation and sitemap) unless the package gives them real content; update src/app/sitemap.ts PUBLIC_PAGES and tests/app/sitemap.test.ts accordingly.
  * The privacy policy and terms pages describe the browser-storage reality (no accounts yet, data in this browser, export/import/reset in /settings).
  * /api/auth/* must not be left half-working: with accounts off, nothing on the site links to sign-in, SessionProvider is not mounted, and the auth route answers safely; the lab page stops redirecting in the SAME integration (we integrate all packages together, so ordering only needs to be consistent at the end).
  * Data safety: autosave only after a user edit; per-entry keys for the notebook; quota/size caps with user-visible errors; corrupt records copied to a side key before overwrite; cross-tab safe update-on-fresh-read; legacy keys (route choice stored as a bare string, exercise progress) handled by export/import/reset and their listeners notified.
  * SSR/Workers: lab pages prerendered with generateStaticParams for available labs, dynamicParams=false, dynamic='error'; no fs at request time; no storage writes during SSR; no lesson-page bundle growth from the lab registry (pass {labId, version, stepCount} props).
  * Tests: every test file that will change is owned by exactly one package; vitest mocks of '@/tools/featureFlags' updated; e2e specs adjusted to the anonymous default (account-mode specs guarded behind an explicit accounts mode).
- Every file appears in at most ONE package. A file needed by two packages goes to the earlier one, and the later one depends on it. Keep package count small (<= 9) and a foundation package first.
${extra || ''}
RETURN the plan.`

phase('Revise')
let plan = await agent(revisePrompt(''), { label: 'revise-plan', phase: 'Revise', schema: PLAN_SCHEMA })
const overlaps = (p) => {
  const owner = {}
  const dup = []
  p.packages.forEach((pk) => pk.files.forEach((f) => { if (owner[f] && owner[f] !== pk.id) dup.push(`${f}: ${owner[f]} and ${pk.id}`); else owner[f] = pk.id }))
  return dup
}
let dup = overlaps(plan)
if (dup.length) {
  log(`Plan has ${dup.length} shared files; asking for a fix`)
  plan = await agent(revisePrompt(`Your previous plan assigned these files to two packages; fix ownership:\n${dup.join('\n')}\nPREVIOUS PLAN:\n${JSON.stringify(plan).slice(0, 60000)}`), { label: 'revise-plan:ownership', phase: 'Revise', schema: PLAN_SCHEMA })
  dup = overlaps(plan)
  if (dup.length) log(`Still ${dup.length} shared files after the fix; packages will coordinate through requests: ${dup.slice(0, 10).join('; ')}`)
}
log(`Plan: ${plan.packages.map((p) => `${p.id} (${p.files.length} files)`).join(', ')}`)

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    package: { type: 'string' },
    done: { type: 'array', items: { type: 'string' } },
    notDone: { type: 'array', items: { type: 'string' } },
    filesTouched: { type: 'array', items: { type: 'string' } },
    requestsForOtherPackages: { type: 'array', items: { type: 'string' }, description: 'changes needed in files you do not own: file, change, reason' },
    validation: { type: 'string' },
  },
  required: ['package', 'done', 'notDone', 'filesTouched', 'requestsForOtherPackages', 'validation'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: { pass: { type: 'boolean' }, findings: { type: 'array', items: { type: 'string' } } },
  required: ['pass', 'findings'],
}

const planText = JSON.stringify({ globalDecisions: plan.globalDecisions, packages: plan.packages.map((p) => ({ id: p.id, title: p.title, files: p.files })) }).slice(0, 30000)

const implPrompt = (pk) => `${CONTEXT}

You implement package ${pk.id}: ${pk.title}.
Global decisions every package follows: ${JSON.stringify(plan.globalDecisions)}
All packages and their file ownership (do not edit files owned by another package; record a request instead): ${planText}

YOUR FILES (create/edit/delete only these): ${pk.files.join(', ')}
TASKS:
${pk.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}
GAPS YOU MUST CLOSE: ${pk.gapsAddressed.join(' | ')}
ACCEPTANCE:
${pk.acceptance.map((a) => `- ${a}`).join('\n')}
TESTS that must pass: ${pk.tests.join(', ')}

Read docs/no-login/design.json and critiques.json for the details behind your package. Write focused unit tests for new logic. VALIDATE with: NODE_OPTIONS='--require @prisma/client' npx vitest run <your test files and the existing tests for files you changed>; npx tsc --noEmit -p . (fix every error in YOUR files; errors in files another package is still editing are not yours, but list them); npx eslint <your files>.
RETURN package, done, notDone, filesTouched, requestsForOtherPackages, validation.`

const reviewPrompt = (pk, lens, impl) => `${CONTEXT}

READ-ONLY review of package ${pk.id} (${pk.title}). Implementer's report: ${JSON.stringify(impl).slice(0, 4000)}
Its files: ${pk.files.join(', ')}. Look at git diff HEAD -- <those files> and new files. Tasks: ${pk.tasks.join(' | ')}. Acceptance: ${pk.acceptance.join(' | ')}. Gaps to close: ${pk.gapsAddressed.join(' | ')}.
${lens === 'spec'
  ? 'LENS spec and safety: every task and acceptance item done; an anonymous visitor is never blocked, redirected to sign-in, or shown a broken/empty feature in this package\'s scope; no data-loss path (autosave before edit, corrupt overwrite, cross-tab clobber, quota); no SSR/hydration mismatch (client switches from NEXT_PUBLIC only; no storage access during render); Workers-safe (no request-time fs, prerendered where planned); the account seam is a clean switch, not deleted logic.'
  : 'LENS tests and quality: run the package\'s tests and the existing tests touching its files (NODE_OPTIONS=\'--require @prisma/client\' npx vitest run ...), npx tsc --noEmit -p . (errors in this package\'s files only) and eslint on its files; check new logic has unit tests, UI is accessible (labels, focus, keyboard, live regions where status changes), works at 390 px, copy is plain and accurate (no "sign in" while accounts are off), and code matches the repo style.'}
RETURN pass=true only if no S1/S2 problem remains; findings as "file:line - problem -> fix".`

const fixPrompt = (pk, findings, round) => `${CONTEXT}

Fix round ${round} for package ${pk.id} (${pk.title}). Edit only its files: ${pk.files.join(', ')}. Resolve every finding:
${findings.join('\n')}
Re-run the package's tests, tsc (your files) and eslint. RETURN package, done (what you fixed), notDone, filesTouched, requestsForOtherPackages, validation.`

async function buildPackage(pk) {
  let impl = await agent(implPrompt(pk), { label: `impl:${pk.id}`, phase: pk.dependsOn.length ? 'Build' : 'Foundation', schema: IMPL_SCHEMA })
  if (!impl) return { id: pk.id, status: 'impl-failed' }
  let lenses = ['spec', 'quality']
  const requests = [...impl.requestsForOtherPackages]
  for (let round = 1; round <= 3; round += 1) {
    const reviews = await parallel(lenses.map((lens) => () => agent(reviewPrompt(pk, lens, impl), { label: `review:${pk.id}:${lens}:r${round}`, phase: 'Review', schema: REVIEW_SCHEMA })))
    const failing = lenses.filter((lens, i) => !reviews[i] || !reviews[i].pass)
    if (!failing.length) return { id: pk.id, status: 'clean', rounds: round, impl, requests }
    const findings = reviews.filter((r) => r && !r.pass).flatMap((r) => r.findings)
    if (round === 3) return { id: pk.id, status: 'escalate', impl, open: findings, requests }
    const fixed = await agent(fixPrompt(pk, findings, round), { label: `fix:${pk.id}:r${round}`, phase: 'Review', schema: IMPL_SCHEMA })
    if (fixed) { impl = { ...impl, fixes: fixed.done, notDone: fixed.notDone }; requests.push(...fixed.requestsForOtherPackages) }
    lenses = failing
  }
}

// Foundation first (packages with no dependencies), then everything else in parallel.
const foundation = plan.packages.filter((p) => !p.dependsOn.length)
const rest = plan.packages.filter((p) => p.dependsOn.length)
phase('Foundation')
const foundationResults = await parallel(foundation.map((pk) => () => buildPackage(pk)))
phase('Build')
const restResults = await parallel(rest.map((pk) => () => buildPackage(pk)))
const results = [...foundationResults, ...restResults].filter(Boolean)

phase('Integrate')
const INTEGRATE_SCHEMA = {
  type: 'object',
  properties: {
    vitest: { type: 'string' }, tsc: { type: 'string' }, eslint: { type: 'string' },
    fixed: { type: 'array', items: { type: 'string' } },
    remaining: { type: 'array', items: { type: 'string' } },
  },
  required: ['vitest', 'tsc', 'eslint', 'fixed', 'remaining'],
}
const integration = await agent(`${CONTEXT}

You are the integration engineer. All packages have been implemented in parallel in the working tree; now make them fit together. You may edit ANY src/, tests/, scripts/ or docs/ file (no other agent is running). Package results and cross-package requests:
${JSON.stringify(results.map((r) => ({ id: r.id, status: r.status, notDone: r.impl ? r.impl.notDone : [], open: r.open || [], requests: r.requests || [] }))).slice(0, 30000)}

1. Apply every cross-package request that is still needed, and close any open review finding listed.
2. Run the WHOLE suite: NODE_OPTIONS='--require @prisma/client' npx vitest run (known load-flaky: tests/app/feature-gating.spec.tsx and tests/lib/expert-index.test.ts may time out under load; rerun them alone). Fix every failure caused by this work (update tests only where the expected behaviour legitimately changed under the owner's decision).
3. npx tsc --noEmit -p . must be clean; npx next lint --max-warnings=0 must be clean.
4. grep src/ for any remaining anonymous blocker: 'Sign in', signIn(, requireSession in page/server-component code reachable anonymously, redirect('/api/auth, fetch('/api/me in client code used while accounts are off. Fix what remains.
RETURN vitest/tsc/eslint summaries, what you fixed, and anything remaining.`, { label: 'integrate', phase: 'Integrate', schema: INTEGRATE_SCHEMA })

phase('Verify')
const VERIFY_SCHEMA = {
  type: 'object',
  properties: { gaps: { type: 'array', items: { type: 'string' } }, verdict: { type: 'string' } },
  required: ['gaps', 'verdict'],
}
const verify = await agent(`${CONTEXT}

READ-ONLY. Walk the whole site as an anonymous visitor by reading the code paths (you may run vitest, not servers): every route under src/app (learning and public), the navbar, sidebar, footer, keyboard shortcuts, search, every lesson page widget (quiz, flashcards and ratings, Teach-it-back, practice block, LabLink), the Practice Hub, every available lab end to end (open, edit, autosave, grade, self-attest, complete, reveal solution, reset, download), the dashboard, review queue, notebook, settings (export/import/reset), placement quiz, sitemap and robots, privacy and terms. For each, confirm it works with no login and no database, or is hidden with no link pointing at it. Also check that the account seam is intact (switching accounts on later restores guarded server paths). List every remaining gap precisely (file:line, what a visitor sees, fix).`, { label: 'verify:anonymous-walkthrough', phase: 'Verify', schema: VERIFY_SCHEMA })

return {
  plan: { globalDecisions: plan.globalDecisions, packages: plan.packages.map((p) => ({ id: p.id, title: p.title, files: p.files.length })) },
  packages: results.map((r) => ({ id: r.id, status: r.status, rounds: r.rounds, notDone: r.impl ? r.impl.notDone : [], open: r.open || [] })),
  integration,
  verify,
  planJson: plan,
}