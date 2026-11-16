export const meta = {
  name: 'interactive-heights-pass',
  description: 'Measure every lesson interactive against its reserved placeholder height at desktop, mid and phone widths, correct the registry so pages stop jumping as interactives load, and verify independently',
  phases: [
    { title: 'Tool', detail: 'build the measuring script and take the baseline over all 112 lessons', model: 'opus' },
    { title: 'Registry', detail: 'correct heights and variants, in sequential groups (one file)', model: 'opus' },
    { title: 'Verify', detail: 'independent re-measurement and review', model: 'opus' },
    { title: 'Fix', detail: 'fix what the verification found', model: 'opus' },
  ],
}

// TEMPLATE. Before running, replace every __NAME__ placeholder:
//   __ROOT__      the repository checkout            __SRC__       the folder with the standards' text (never committed)
//   __UVM_HOME__  the uvm-core 1800.2-2020 release   __OUT__, __WT__, __SCR__  scratch folders outside the repository
//   __ROUND__, __KNOWN__, __BATCHES__, __META__, __LESSONS__, __LABEL__, __DO_TOOLING__, __KINDS__  run data (JSON literals)
// See RESTART.md ("Start here") for the order of work and the measured costs.

const MAIN = '__ROOT__'
const SCR = args.scratch
const OUT = `${SCR}/heights`

const COMMON = `You work in the repository at ${MAIN} (branch curriculum-quality-program), a Next.js 14 site that teaches SystemVerilog and UVM. Lessons are MDX files under content/curriculum; they embed interactive React components that load lazily. Each embed reserves a placeholder height so the page does not move when the component swaps in. The reserved heights live in ${MAIN}/src/components/mdx/lazy-mdx-interactives.ts (read its comments first: height, midHeight, mobileHeight, variants, estimate, and the per-instance height props) and are applied by ${MAIN}/src/components/mdx/LazyMdxInteractive.tsx. Sixteen components were measured on 2026-11-15 and are right; most of the others have no measured height or a stale one, so lessons jump as they load.
A dev server is already running on http://localhost:3000 (do not restart it, do not start another, and do not run next build, npm run build, cf:build, npm ci, npm install or the Playwright test runner). Use standalone node scripts that require playwright from the repository: run them from ${MAIN} with NODE_PATH=${MAIN}/node_modules node <script>. The first visit to a page compiles it and can take up to a minute; use generous timeouts and retry a failed page once.
Other work is running: do not touch ${SCR}/wt-release or ${SCR}/figures, do not commit, push, stash or switch branches, never edit TASKS.md, and do not edit any lesson's words. Put scratch files and reports under ${OUT}/ (create it).
Report plainly: short sentences, what you did, what you measured, what you could not do and why.`

phase('Tool')
const TOOL_PROMPT = `${COMMON}

YOUR TASK (tool builder). Build a measuring tool that stays in the repository, then take the baseline.

1. Write ${MAIN}/scripts/measure-lazy-interactive-heights.cjs (CommonJS, playwright, no test runner). Options: --base (default http://localhost:3000), --out <json>, --lessons <comma list of lesson slugs or mdx paths> or --tiers <comma list> (default: every lesson under content/curriculum), --bands desktop,mid,phone (default all three), --tolerance <px> (default 4), --concurrency <n> (default 3). Bands: desktop = 1440x900 viewport; mid = a width inside the 1024 to 1279 band that the registry's comments name as MID_BAND (use the width those comments or the existing tests imply, and say which); phone = 390x844 with a phone device scale. Read LazyMdxInteractive.tsx to learn the DOM contract (how a placeholder is marked, how the reserved height is applied, what triggers the swap) and measure exactly what the registry's comments define: the rendered height of the component, margins excluded, against the height the placeholder reserved for that instance in that band.
   For each lesson and band: load the page, find every lazy interactive instance in document order, record the reserved height before the component has swapped in, bring it into view so it loads, wait until it has rendered and its height has been stable for at least 500 ms (fonts loaded), then record the rendered height. Record per instance: lesson slug, index on the page, component name, the instance's MDX props that the registry can see (the same props object passed to lazyMdxInteractivePlaceholder; find how to recover it, for example from a data attribute or by parsing the lesson source, and say which), band, reserved, rendered, delta = rendered - reserved, and whether the reserved value came from a measured entry, a variant, an estimate, a per-instance prop or the default. Also record, per page and band, the total layout shift reported by a PerformanceObserver for "layout-shift" while you scroll from top to bottom at reading speed.
   Output JSON with: the instances; a per-component summary (each distinct props signature with its rendered heights per band and the lessons where it occurs); and the list of instances whose |delta| exceeds the tolerance. Print a short table and exit non-zero when any instance exceeds the tolerance. Print progress as it runs. Add a comment block at the top of the script that says what it measures and how to run it.
2. Check the tool against the sixteen components measured on 2026-11-15 (see tests/components/lazy-mdx-heights.test.ts, the "measured on 2026-11-15" block): for those the delta must come out within a few px. If it does not, your measurement differs from the registry's definition; find out why and fix the tool before going on.
3. Run it over every lesson and every band and save ${OUT}/baseline.json. This is long: run it in the background with its output going to ${OUT}/baseline.log and wait for it. If a page fails twice, record it and carry on.
4. From the baseline, write ${OUT}/worklist.json: an array with one entry per component that has at least one instance over tolerance, each with: component, instances (count), worst (largest |delta| in px), and signatures (each distinct props signature with rendered heights per band and the lessons). Order it by worst first.
Return: the tool's usage line, the mid-band width you used and why, how the tool recovered each instance's props, the check against the sixteen (numbers), totals (lessons, instances, instances over tolerance per band, components over tolerance), the ten worst pages by layout shift, pages that failed, and the path of the worklist. Also return the list of components over tolerance as "components" (names only, worst first).`

const tool = await agent(TOOL_PROMPT, {
  label: 'tool:measure-heights', phase: 'Tool', model: 'opus',
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      usage: { type: 'string' },
      totals: { type: 'string' },
      components: { type: 'array', items: { type: 'string' } },
      failedPages: { type: 'array', items: { type: 'string' } },
    },
    required: ['summary', 'usage', 'totals', 'components', 'failedPages'],
  },
})
if (!tool) return { error: 'tool builder returned nothing' }
log(`baseline: ${tool.totals}`)

phase('Registry')
const comps = tool.components
const GROUP = 14
const groups = []
for (let i = 0; i < comps.length; i += GROUP) groups.push(comps.slice(i, i + GROUP))
const registry = []
for (let g = 0; g < groups.length; g++) {
  const r = await agent(`${COMMON}

YOUR TASK (registry fixer, group ${g + 1} of ${groups.length}). A measuring tool now exists: ${MAIN}/scripts/measure-lazy-interactive-heights.cjs (${tool.usage}). Its baseline over all lessons is ${OUT}/baseline.json and the per-component work list is ${OUT}/worklist.json.
Correct the reserved heights for exactly these components: ${JSON.stringify(groups[g])}. Earlier groups have already been corrected by other agents in the same file; do not change entries for components outside your list.
For each component in your list:
- Read its work list entry: every distinct props signature with its rendered heights per band.
- Set height, midHeight and mobileHeight in lazy-mdx-interactives.ts to the measured values for its most common signature. Where other signatures render at a different height, add variants keyed on the props that cause the difference, using the helpers the file already has (propIs, listLength and so on) and following the existing entries' style; the first matching variant wins, so order them from most specific to least. Where the height follows the instance's text or data rather than a discrete prop, write an estimate function like estimateQuestionCardHeights and say how you fitted it. Only when neither a variant nor an estimate can express an instance may you set that instance's own height props in its lesson's MDX embed (the per-instance props the registry file documents); that is the one lesson edit allowed, it must not change any words, and you must list every such edit.
- If an instance's height is not stable (it depends on a random seed, the time, or content that loads later), say so, reserve the height of its first rendered state, and report it.
- A component whose rendered height differs between two visits with the same props is a bug in the component or in the measurement; investigate rather than averaging.
Then rerun the tool for the lessons that embed your components (use --lessons) in all three bands and repeat until every instance of your components is within 4 px in every band, or you can say exactly why one cannot be.
Update tests/components/lazy-mdx-heights.test.ts: fix any pinned value you changed and add, under a describe block named "placeholder heights measured on 2026-11-15 for all interactives", one expectation per component in your list (and one per variant) that pins the measured heights. Run npx vitest --run tests/components/lazy-mdx-heights.test.ts and npx tsc --noEmit; both must pass. Run npx eslint on the files you changed.
Return, per component: the heights set, the variants or estimate added, the largest remaining delta per band after your change, and any lesson embed you edited (file and line).`, {
    label: `registry:group-${g + 1}`, phase: 'Registry', model: 'opus',
    schema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        done: { type: 'array', items: { type: 'object', properties: { component: { type: 'string' }, worstAfter: { type: 'number' }, note: { type: 'string' } }, required: ['component', 'worstAfter'] } },
        lessonEdits: { type: 'array', items: { type: 'string' } },
        unresolved: { type: 'array', items: { type: 'string' } },
      },
      required: ['summary', 'done', 'lessonEdits', 'unresolved'],
    },
  })
  registry.push(r)
  if (r) log(`group ${g + 1}/${groups.length}: ${r.done.length} components, ${r.unresolved.length} unresolved, ${r.lessonEdits.length} lesson edits`)
}

phase('Verify')
const done = registry.filter(Boolean)
const VERIFY_PROMPT = `${COMMON}

YOUR TASK (independent verifier, READ-ONLY for the repository: write only under ${OUT}/verify/). Other agents built a measuring tool (${MAIN}/scripts/measure-lazy-interactive-heights.cjs; ${tool.usage}) and corrected the reserved placeholder heights in src/components/mdx/lazy-mdx-interactives.ts for ${comps.length} components. Do not trust their reports; measure again.
1. Read the tool and decide whether it measures the right thing: the reserved height is read before the swap, the rendered height after the component is stable, margins are handled as the registry's comments define, and the three bands match the breakpoints LazyMdxInteractive.tsx actually uses. Write your own short, independent check (a different script under ${OUT}/verify/, about 60 lines) that, for six lessons you choose across the four tiers with many interactives, watches each interactive's wrapper with a ResizeObserver from page load and records the height before and after the swap, at 1440, at the mid band and at 390 wide. Compare its numbers with the tool's for the same pages and report every disagreement over 2 px.
2. Run the tool over every lesson in all three bands (in the background, output to ${OUT}/verify/final.log, JSON to ${OUT}/verify/final.json) and report: instances over 4 px per band, by component, with the lesson and the delta; and the ten pages with the largest total layout shift, compared with the same pages in ${OUT}/baseline.json.
3. For the nine Tier 1 lessons that hold the sixteen components measured earlier (F1A index; F2A index and structs-unions-enums; F2B index; F2C index and flow-control; F2D index and ipc; F3B index), confirm no instance regressed.
4. Review the registry diff (git diff -- src/components/mdx/lazy-mdx-interactives.ts): variants ordered so a specific one is not shadowed, no predicate that can throw on missing props, estimates that cannot return NaN or a negative height, and no change to entries that were already right. Review any lesson embeds that were edited (${JSON.stringify(done.flatMap(d => d.lessonEdits))}): only height props may have changed.
5. Run npx vitest --run tests/components/lazy-mdx-heights.test.ts tests/components (the component tests that render lazy interactives) and npx tsc --noEmit; report counts and failures.
Severity: S1 = the tool measures the wrong thing or a change broke a page; S2 = an instance still jumps by more than 4 px in some band, a shadowed variant, an unsafe estimate, a regression; S3 = small. Return every finding with the component, lesson, band, numbers and a concrete fix.`
const verify = await agent(VERIFY_PROMPT, {
  label: 'verify:heights', phase: 'Verify', model: 'opus',
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      overTolerance: { type: 'integer' },
      findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['S1', 'S2', 'S3'] }, where: { type: 'string' }, what: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'where', 'what', 'fix'] } },
    },
    required: ['summary', 'overTolerance', 'findings'],
  },
})

let fix = null
let recheck = null
if (verify && verify.findings.length > 0) {
  phase('Fix')
  fix = await agent(`${COMMON}

YOUR TASK (fixer). An independent verifier re-measured every lesson after the placeholder heights were corrected and found the items below. The measuring tool is ${MAIN}/scripts/measure-lazy-interactive-heights.cjs (${tool.usage}); the verifier's full measurement is ${OUT}/verify/final.json. Fix every S1 and S2, and each S3 unless it risks a regression (say why if you leave one). Follow the registry file's existing style; variants from most specific to least; lesson embeds may only gain or change the documented per-instance height props. After fixing, rerun the tool for every lesson that embeds a component you touched, in all three bands, until each instance is within 4 px or you can say exactly why it cannot be. Update tests/components/lazy-mdx-heights.test.ts for any pinned value you changed, then run npx vitest --run tests/components/lazy-mdx-heights.test.ts, npx tsc --noEmit and eslint on changed files.
Findings (JSON):
${JSON.stringify(verify.findings, null, 1)}
Return what you changed per finding, what you left and why, and the largest remaining delta per band over the lessons you re-measured.`, {
    label: 'fix:heights', phase: 'Fix', model: 'opus',
    schema: { type: 'object', properties: { summary: { type: 'string' }, left: { type: 'array', items: { type: 'string' } }, lessonEdits: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'left', 'lessonEdits'] },
  })
  phase('Verify')
  recheck = await agent(`${COMMON}

YOUR TASK (independent closing check, READ-ONLY for the repository: write only under ${OUT}/recheck/). Placeholder heights for lesson interactives were corrected, verified, and then fixed again after these findings:
${JSON.stringify(verify.findings.map(f => `${f.severity} ${f.where}: ${f.what}`), null, 1)}
Run ${MAIN}/scripts/measure-lazy-interactive-heights.cjs (${tool.usage}) over every lesson in all three bands (background, log to ${OUT}/recheck/final.log, JSON to ${OUT}/recheck/final.json). Report the number of instances over 4 px per band and list each one (component, lesson, band, reserved, rendered). For each finding above, say whether it is resolved, with the numbers. Run npx vitest --run tests/components/lazy-mdx-heights.test.ts and npx tsc --noEmit and report the counts. List any lesson .mdx file that git shows as changed by this work (git diff --stat -- content/curriculum, ignoring files under T1_Foundational that an earlier review pass changed: for those, inspect whether any embed's height props changed) and confirm that in each only height props on embeds changed.`, {
    label: 'recheck:heights', phase: 'Verify', model: 'opus',
    schema: { type: 'object', properties: { summary: { type: 'string' }, overTolerance: { type: 'integer' }, open: { type: 'array', items: { type: 'string' } }, lessonFilesChanged: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'overTolerance', 'open', 'lessonFilesChanged'] },
  })
}

return {
  tool: { summary: tool.summary, usage: tool.usage, totals: tool.totals, failedPages: tool.failedPages, components: comps.length },
  registry: done.map(d => ({ summary: d.summary, unresolved: d.unresolved, lessonEdits: d.lessonEdits })),
  verify: verify ? { summary: verify.summary, overTolerance: verify.overTolerance, material: verify.findings.filter(f => f.severity !== 'S3').map(f => `${f.severity} ${f.where}: ${f.what}`), small: verify.findings.filter(f => f.severity === 'S3').length } : null,
  fix,
  recheck,
}
