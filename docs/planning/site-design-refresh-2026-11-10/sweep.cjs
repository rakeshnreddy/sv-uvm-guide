// Layout-regression sweep: records overflow, clipping and spill problems on every page,
// at two viewports and two colour modes, and diffs a later run against a baseline.
//
// Run from the project root:
//   node docs/planning/site-design-refresh-2026-11-10/sweep.cjs run --base <url> --out <dir>
//        [--only <substring>] [--concurrency N] [--themes dark,light] [--resume] [--paths <file>]
//   node docs/planning/site-design-refresh-2026-11-10/sweep.cjs diff <baselineDir> <afterDir>
//
// --themes gives the localStorage `theme` values for the "dark" and "light" modes, in that order.
// The default is the current site's values (default-dark,default-light).
// --paths reads a different path list (one per line) instead of sweep-paths.txt plus the extra app pages.
// --resume keeps the finished pages already in <dir>/sweep.json and reruns only failed or missing ones.
const path = require('path')
const fs = require('fs')

const PATHS_FILE = path.join(__dirname, 'sweep-paths.txt')
const EXTRA_PATHS = ['/dashboard', '/settings', '/assessment', '/quiz/placement']
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
}
const MODES = ['dark', 'light']
const KINDS = ['page-overflow', 'clipped', 'spill', 'off-viewport', 'svg-text-overflow', 'tiny-text']

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const k = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) out[k] = true
      else out[k] = argv[++i]
    } else out._.push(a)
  }
  return out
}

function loadPaths(file) {
  const list = fs.readFileSync(file || PATHS_FILE, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
  if (!file) for (const p of EXTRA_PATHS) if (!list.includes(p)) list.push(p)
  return list
}

const taskId = (t) => `${t.path} | ${t.viewport} | ${t.mode}`
const problemKey = (t, p) => [t.path, t.viewport, t.mode, p.kind, p.selector, p.text].join(' | ')
// Console noise caused by the edge, not by the page: failed loads and RSC prefetch fallbacks.
const NOISE = /Failed to load resource: the server responded with a status of 5\d\d|Failed to fetch RSC payload/
// Records from an older run that loaded but never hydrated, or hit edge 5xx on a subresource.
// Lesson pages live at /curriculum/<tier>/<module>/<lesson> and must render the lesson article.
const isLessonPath = (p) => /^\/curriculum\/[^/]+\/[^/]+\/[^/]+$/.test(p)
const isDegraded = (r) => !r.failed && (!r.htmlTheme || (isLessonPath(r.path) && r.docHeight < 1500) || (!r.resourceCheck && (r.consoleErrors || []).some((e) => /status of 5\d\d/.test(e))))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Runs inside the page. Returns { docHeight, interactives, htmlTheme, problems }.
function measureInPage(W) {
  const problems = []
  const de = document.documentElement
  const vw = Math.min(W, de.clientWidth || W)
  const styleCache = new Map()
  const cs = (el) => {
    let s = styleCache.get(el)
    if (!s) { s = getComputedStyle(el); styleCache.set(el, s) }
    return s
  }
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  const stableId = (id) => id && !/[:«»]|^radix-|^headlessui-|^react-|^mui-|\d{3,}/.test(id)
  const seg = (el) => {
    let s = el.tagName.toLowerCase()
    if (stableId(el.id)) s += '#' + el.id
    const tid = el.getAttribute('data-testid')
    if (tid) s += `[data-testid=${tid}]`
    const cls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '')
    const c = cls.split(/\s+/).filter(Boolean).slice(0, 2)
    if (c.length) s += '.' + c.join('.')
    return s
  }
  const selPath = (el) => {
    const parts = []
    let cur = el
    while (cur && cur.nodeType === 1 && parts.length < 5) {
      parts.unshift(seg(cur))
      if (cur === document.body || stableId(cur.id) || cur.getAttribute('data-testid')) break
      cur = cur.parentElement
    }
    return parts.join(' > ')
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false
    return true
  }
  const srOnly = (el) => {
    const s = cs(el)
    if (el.closest('.sr-only, .visually-hidden')) return true
    return s.position === 'absolute' && (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)')
  }
  const skipZone = (el) => !!el.closest('pre, code, .monaco-editor, kbd, samp, textarea, input, select')
  const ownText = (el) => {
    let t = ''
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue
    return t.trim()
  }
  const textRects = (el, limit) => {
    // Rects of descendant text, ignoring text that an inner non-visible-overflow box handles itself.
    const rects = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let n, count = 0
    const range = document.createRange()
    while ((n = walker.nextNode()) && count < limit) {
      if (!n.nodeValue.trim()) continue
      const p = n.parentElement
      if (!p) continue
      let inner = false
      for (let a = p; a && a !== el; a = a.parentElement) {
        const s = cs(a)
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible' || s.display === 'none') { inner = true; break }
        if (s.position === 'absolute' || s.position === 'fixed') { inner = true; break }
      }
      if (inner) continue
      const ps = cs(p)
      if (ps.visibility === 'hidden' || ps.opacity === '0') continue
      count++
      range.selectNodeContents(n)
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) rects.push(r)
    }
    return rects
  }
  const union = (rects) => {
    if (!rects.length) return null
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
    for (const x of rects) { l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom) }
    return { left: l, top: t, right: r, bottom: b }
  }
  const outside = (inner, outer) => Math.max(outer.left - inner.left, inner.right - outer.right, outer.top - inner.top, inner.bottom - outer.bottom)
  const hasBox = (s) => {
    const alpha = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1 }
    if (alpha(s.backgroundColor) > 0.02 || (s.backgroundImage && s.backgroundImage !== 'none')) return true
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(s[`border${side}Width`]) > 0 && s[`border${side}Style`] !== 'none' && alpha(s[`border${side}Color`]) > 0.02) return true
    return parseFloat(s.borderTopLeftRadius) > 0 || parseFloat(s.borderBottomRightRadius) > 0
  }
  const push = (kind, el, amount, extra) => problems.push({ kind, selector: el ? selPath(el) : 'html', text: el ? clean(el.textContent) : '', amount: Math.round(amount * 10) / 10, ...extra })

  // 1. page-overflow: try to scroll sideways.
  const y0 = window.scrollY
  window.scrollTo(100000, y0)
  const sx = window.scrollX
  window.scrollTo(0, y0)
  const sw = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0)
  if (sx > 1 || sw - W > 1) {
    const hx = cs(de).overflowX, bx = document.body ? cs(document.body).overflowX : 'visible'
    const hidden = (v) => v === 'hidden' || v === 'clip'
    if (sx > 1 || (!hidden(hx) && !hidden(bx))) problems.push({ kind: 'page-overflow', selector: 'html', text: '', amount: Math.max(sw - W, sx) })
  }

  const all = document.body ? document.body.getElementsByTagName('*') : []
  for (const el of all) {
    if (el instanceof SVGElement) continue
    const tag = el.tagName
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE' || tag === 'BR') continue
    if (!visible(el)) continue
    const s = cs(el)
    const r = el.getBoundingClientRect()
    const own = ownText(el)
    const zone = skipZone(el)

    // 2. clipped
    if (!zone && !srOnly(el)) {
      const hid = (v) => v === 'hidden' || v === 'clip'
      const cx = hid(s.overflowX) && el.scrollWidth > el.clientWidth + 1
      const cy = hid(s.overflowY) && el.scrollHeight > el.clientHeight + 1
      if ((cx || cy) && el.textContent.trim()) {
        const bl = parseFloat(s.borderLeftWidth) || 0, bt = parseFloat(s.borderTopWidth) || 0
        const box = { left: r.left + bl, top: r.top + bt, right: r.left + bl + el.clientWidth, bottom: r.top + bt + el.clientHeight }
        let amt = 0
        for (const tr of textRects(el, 300)) {
          if (cx) amt = Math.max(amt, box.left - tr.left, tr.right - box.right)
          if (cy) amt = Math.max(amt, box.top - tr.top, tr.bottom - box.bottom)
        }
        if (amt > 1) push('clipped', el, amt, { axis: cx && cy ? 'xy' : cx ? 'x' : 'y', ellipsis: s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none') || undefined })
      }
    }

    // 3. spill
    const parent = el.parentElement
    if (own && !zone && parent && parent !== document.body && parent !== de && s.position !== 'absolute' && s.position !== 'fixed' && !srOnly(el)) {
      const ps = cs(parent)
      if (ps.display !== 'contents' && hasBox(ps) && ps.overflowX === 'visible' && ps.overflowY === 'visible') {
        const pr = parent.getBoundingClientRect()
        if (outside(r, pr) > 2) {
          const tu = union(textRects(el, 50))
          const amt = tu ? outside(tu, pr) : 0
          if (amt > 2) push('spill', el, amt)
        }
      }
    }

    // 4. off-viewport (outermost offender only)
    if (r.right > vw + 2 && r.left < vw && !srOnly(el)) {
      let contained = false
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const as = cs(a)
        if (as.overflowX !== 'visible') { contained = true; break }
      }
      const pr = parent && parent !== document.body ? parent.getBoundingClientRect() : null
      const parentAlso = pr && pr.right > vw + 2 && parent.checkVisibility && parent.checkVisibility()
      if (!contained && !parentAlso) push('off-viewport', el, r.right - vw)
    }

    // 6. tiny-text
    if (own && !srOnly(el)) {
      const fs = parseFloat(s.fontSize)
      if (fs < 11) push('tiny-text', el, 11 - fs, { fontSize: fs, text: clean(own) })
    }
  }

  // 5. svg-text-overflow, plus tiny SVG text after scaling.
  for (const t of document.querySelectorAll('svg text')) {
    if (t.closest('defs, clipPath, mask, symbol, marker, pattern')) continue
    const svg = t.ownerSVGElement
    if (!svg || !visible(svg)) continue
    const tr = t.getBoundingClientRect()
    if (tr.width === 0 || tr.height === 0) continue
    if (t.checkVisibility && !t.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue
    const amt = outside(tr, svg.getBoundingClientRect())
    if (amt > 2) push('svg-text-overflow', t, amt)
    const ctm = t.getScreenCTM()
    const scale = ctm ? Math.hypot(ctm.a, ctm.b) : 1
    const fs = parseFloat(cs(t).fontSize) * scale
    if (fs > 0 && fs < 11) push('tiny-text', t, 11 - fs, { fontSize: Math.round(fs * 10) / 10, svg: true })
  }

  // Interactives: every curriculum visual renders through VisualFrame, a <section aria-label class="not-prose ...">
  // whose first child is a <header>.
  const interactives = [...document.querySelectorAll('section.not-prose[aria-label]')].filter((s) => s.firstElementChild && s.firstElementChild.tagName === 'HEADER').length
  return {
    docHeight: Math.max(de.scrollHeight, document.body ? document.body.scrollHeight : 0),
    interactives,
    htmlTheme: de.getAttribute('data-theme') || de.className || '',
    hasLesson: !!document.querySelector('[data-testid=lesson-content]'),
    problems,
  }
}

async function runTask(browser, base, task, themeValue) {
  const vp = VIEWPORTS[task.viewport]
  const rec = { path: task.path, viewport: task.viewport, mode: task.mode, status: null, failed: false, attempts: 0, consoleErrors: [], docHeight: 0, interactives: 0, problems: [] }
  for (let attempt = 1; attempt <= 4; attempt++) {
    rec.attempts = attempt
    rec.consoleErrors = []
    const ctx = await browser.newContext({ ...vp, reducedMotion: 'reduce', deviceScaleFactor: 1 })
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('theme', t) } catch {}
      const css = '*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;scroll-behavior:auto!important;caret-color:transparent!important}'
      const add = () => { const st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st) }
      if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add)
    }, themeValue)
    const page = await ctx.newPage()
    page.on('console', (m) => { if (m.type() === 'error' && rec.consoleErrors.length < 20) rec.consoleErrors.push(m.text().slice(0, 300)) })
    page.on('pageerror', (e) => { if (rec.consoleErrors.length < 20) rec.consoleErrors.push('pageerror: ' + String(e.message).slice(0, 300)) })
    // A 200 page can still be broken when one of its scripts or styles got a 5xx from the edge:
    // it then never hydrates (no theme attribute, no visuals). Track that and retry the page.
    const badResources = []
    page.on('response', (r) => {
      const t = r.request().resourceType()
      if (r.status() >= 500 && ['script', 'stylesheet', 'font', 'document'].includes(t) && r.request().frame() === page.mainFrame()) badResources.push(`${r.status()} ${t} ${r.url().slice(0, 160)}`)
    })
    let retry = false
    try {
      const resp = await page.goto(base + task.path, { waitUntil: 'load', timeout: 60000 })
      rec.status = resp ? resp.status() : null
      const body = await page.evaluate(() => (document.body ? document.body.innerText.slice(0, 2000) : ''))
      if (rec.status === 503 || /error code:\s*1102/i.test(body) || (rec.status && rec.status >= 500)) {
        retry = true
        rec.error = `status ${rec.status}${/1102/.test(body) ? ' (error code 1102)' : ''}`
      } else {
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
        // Step through the page one viewport at a time so lazy interactives mount.
        const h = vp.viewport.height
        let y = 0
        for (let i = 0; i < 400; i++) {
          const total = await page.evaluate(() => document.documentElement.scrollHeight)
          if (y >= total) break
          y += h
          await page.evaluate((yy) => window.scrollTo(0, yy), y)
          await sleep(140)
        }
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
        await sleep(600)
        await page.evaluate(() => window.scrollTo(0, 0))
        await sleep(400)
        const m = await page.evaluate(measureInPage, vp.viewport.width)
        rec.docHeight = m.docHeight
        rec.interactives = m.interactives
        rec.htmlTheme = m.htmlTheme
        // Collapse identical problems into one keyed entry with a count.
        const byKey = new Map()
        for (const p of m.problems) {
          const k = problemKey(task, p)
          const e = byKey.get(k)
          if (e) { e.count++; e.amount = Math.max(e.amount, p.amount) } else byKey.set(k, { ...p, count: 1 })
        }
        rec.problems = [...byKey.values()]
        delete rec.error
        rec.resourceCheck = true
        if (isLessonPath(task.path) && !m.hasLesson) {
          retry = true
          rec.error = 'degraded: lesson content missing'
        } else if (badResources.length || !rec.htmlTheme) {
          retry = true
          rec.error = badResources.length ? `degraded: ${badResources.length} resource(s) returned 5xx (${badResources[0]})` : 'degraded: theme attribute missing (page did not hydrate)'
        }
      }
    } catch (e) {
      retry = true
      rec.error = String(e.message || e).split('\n')[0].slice(0, 300)
    }
    await ctx.close().catch(() => {})
    if (!retry) return rec
    if (attempt < 4) await sleep(1500 * 2 ** (attempt - 1))
  }
  rec.failed = true
  rec.problems = []
  return rec
}

async function cmdRun(args) {
  const base = String(args.base || '').replace(/\/$/, '')
  const out = args.out
  if (!base || !out) throw new Error('run needs --base <url> --out <dir>')
  const conc = Math.max(1, parseInt(args.concurrency || '3', 10))
  const themes = String(args.themes || 'default-dark,default-light').split(',')
  if (themes.length !== 2) throw new Error('--themes takes two values: <dark>,<light>')
  const themeFor = { dark: themes[0], light: themes[1] }
  let paths = loadPaths(args.paths && String(args.paths))
  if (args.only) paths = paths.filter((p) => p.includes(String(args.only)))
  fs.mkdirSync(out, { recursive: true })
  const outFile = path.join(out, 'sweep.json')

  const tasks = []
  for (const p of paths) for (const v of Object.keys(VIEWPORTS)) for (const m of MODES) tasks.push({ path: p, viewport: v, mode: m })
  const done = new Map()
  let prevDuration = 0
  if (args.resume && fs.existsSync(outFile)) {
    const prev = JSON.parse(fs.readFileSync(outFile, 'utf8'))
    prevDuration = (prev.meta && prev.meta.durationSec) || 0
    for (const r of prev.pages) if (!r.failed && !isDegraded(r)) done.set(taskId(r), r)
  }
  const todo = tasks.filter((t) => !done.has(taskId(t)))
  console.log(`sweep: ${paths.length} paths, ${tasks.length} page runs, ${todo.length} to do, concurrency ${conc}, themes dark=${themeFor.dark} light=${themeFor.light}`)

  const { chromium } = require(require.resolve('@playwright/test', { paths: [process.cwd()] }))
  const browser = await chromium.launch()
  const started = Date.now()
  const results = new Map(done)
  const write = (final) => {
    const pages = tasks.map((t) => results.get(taskId(t))).filter(Boolean)
    const data = { meta: { base, themes: themeFor, viewports: VIEWPORTS, modes: MODES, paths: paths.length, only: args.only || null, startedAt: new Date(started).toISOString(), durationSec: prevDuration + Math.round((Date.now() - started) / 1000), complete: final }, pages }
    fs.writeFileSync(outFile, JSON.stringify(data, null, 1))
  }
  let next = 0, finished = 0
  async function worker() {
    while (next < todo.length) {
      const t = todo[next++]
      const r = await runTask(browser, base, t, themeFor[t.mode])
      results.set(taskId(t), r)
      finished++
      const tag = r.failed ? `FAILED (${r.error})` : `${r.status} ${r.problems.length} problems, ${r.interactives} visuals`
      console.log(`[${finished}/${todo.length}] ${taskId(t)}  ${tag}`)
      if (finished % 20 === 0) write(false)
    }
  }
  await Promise.all(Array.from({ length: conc }, worker))
  await browser.close()
  write(true)
  const failed = [...results.values()].filter((r) => r.failed)
  console.log(`done in ${Math.round((Date.now() - started) / 1000)}s; ${failed.length} failed; wrote ${outFile}`)
  if (failed.length) for (const f of failed) console.log('  failed: ' + taskId(f) + ' ' + f.error)
}

function summarize(pages) {
  const s = {}
  for (const r of pages) {
    if (r.failed) continue
    const k = `${r.viewport}/${r.mode}`
    s[k] = s[k] || Object.fromEntries(KINDS.map((x) => [x, 0]))
    for (const p of r.problems) s[k][p.kind] += p.count
  }
  return s
}

function cmdDiff(args) {
  const [baseDir, afterDir] = args._.slice(1)
  if (!baseDir || !afterDir) throw new Error('diff needs <baselineDir> <afterDir>')
  const B = JSON.parse(fs.readFileSync(path.join(baseDir, 'sweep.json'), 'utf8'))
  const A = JSON.parse(fs.readFileSync(path.join(afterDir, 'sweep.json'), 'utf8'))
  const bMap = new Map(B.pages.map((r) => [taskId(r), r]))
  const pages = []
  const notCompared = []
  const totals = { new: Object.fromEntries(KINDS.map((k) => [k, 0])), gone: Object.fromEntries(KINDS.map((k) => [k, 0])) }
  for (const a of A.pages) {
    const id = taskId(a)
    const b = bMap.get(id)
    if (!b) { notCompared.push({ page: id, reason: 'not in baseline' }); continue }
    if (a.failed || b.failed) { notCompared.push({ page: id, reason: a.failed ? 'failed in after run' : 'failed in baseline' }); continue }
    const bk = new Map(b.problems.map((p) => [problemKey(b, p), p]))
    const ak = new Map(a.problems.map((p) => [problemKey(a, p), p]))
    const added = []
    for (const [k, p] of ak) {
      const old = bk.get(k)
      const delta = p.count - (old ? old.count : 0)
      if (delta > 0) added.push({ ...p, newCount: delta, existedBefore: !!old })
    }
    let gone = 0
    for (const [k, p] of bk) { const n = ak.get(k); const d = p.count - (n ? n.count : 0); if (d > 0) { gone += d; totals.gone[p.kind] += d } }
    for (const p of added) totals.new[p.kind] += p.newCount
    const extra = {}
    if (a.status !== b.status) extra.status = { before: b.status, after: a.status }
    const newErrors = a.consoleErrors.filter((e) => !NOISE.test(e) && !b.consoleErrors.includes(e))
    if (newErrors.length) extra.newConsoleErrors = newErrors
    if (b.interactives !== a.interactives) extra.interactives = { before: b.interactives, after: a.interactives }
    if (added.length || Object.keys(extra).length) pages.push({ page: id, path: a.path, viewport: a.viewport, mode: a.mode, added, resolved: gone, ...extra })
  }
  const missing = B.pages.filter((b) => !A.pages.some((a) => taskId(a) === taskId(b)))
  const result = { baseline: baseDir, after: afterDir, compared: A.pages.length - notCompared.length, notCompared, baselineOnly: missing.length, totals, pages }
  fs.writeFileSync(path.join(afterDir, 'diff.json'), JSON.stringify(result, null, 1))

  const L = []
  L.push('# Layout sweep diff', '')
  L.push(`Baseline: ${baseDir}`, `After: ${afterDir}`, '')
  L.push(`Compared ${result.compared} page runs. ${notCompared.length} not compared. ${missing.length} baseline runs absent from the after run (ignored).`, '')
  L.push('| kind | new | resolved |', '|---|---|---|')
  for (const k of KINDS) L.push(`| ${k}${k === 'tiny-text' ? ' (informational)' : ''} | ${totals.new[k]} | ${totals.gone[k]} |`)
  L.push('')
  const layout = pages.filter((p) => p.added.some((x) => x.kind !== 'tiny-text') || p.status || p.newConsoleErrors || p.interactives)
  const tiny = pages.filter((p) => p.added.some((x) => x.kind === 'tiny-text'))
  if (!layout.length && !tiny.length) L.push('No new problems.')
  if (layout.length) {
    L.push('## New layout problems by page', '')
    for (const p of layout) {
      const items = p.added.filter((x) => x.kind !== 'tiny-text')
      L.push(`### ${p.page} (${items.reduce((n, x) => n + x.newCount, 0)} new)`)
      if (p.status) L.push(`- status changed ${p.status.before} -> ${p.status.after}`)
      if (p.interactives) L.push(`- mounted visuals ${p.interactives.before} -> ${p.interactives.after}`)
      for (const e of p.newConsoleErrors || []) L.push(`- new console error: ${e.slice(0, 160)}`)
      for (const x of items) L.push(`- **${x.kind}** ${x.amount}px x${x.newCount}: \`${x.selector}\` "${x.text}"`)
      L.push('')
    }
  }
  if (tiny.length) {
    L.push('## New tiny text (informational)', '')
    for (const p of tiny) {
      L.push(`### ${p.page}`)
      for (const x of p.added.filter((y) => y.kind === 'tiny-text')) L.push(`- ${x.fontSize}px x${x.newCount}: \`${x.selector}\` "${x.text}"`)
      L.push('')
    }
  }
  if (notCompared.length) {
    L.push('## Not compared', '')
    for (const n of notCompared) L.push(`- ${n.page}: ${n.reason}`)
  }
  fs.writeFileSync(path.join(afterDir, 'diff.md'), L.join('\n') + '\n')
  console.log(L.join('\n'))
}

function cmdSummary(args) {
  const d = JSON.parse(fs.readFileSync(path.join(args._[1], 'sweep.json'), 'utf8'))
  console.log(JSON.stringify({ meta: d.meta, runs: d.pages.length, failed: d.pages.filter((r) => r.failed).map(taskId), byViewportMode: summarize(d.pages) }, null, 1))
}

const args = parseArgs(process.argv.slice(2))
const cmd = args._[0]
const fn = cmd === 'run' ? cmdRun : cmd === 'diff' ? cmdDiff : cmd === 'summary' ? cmdSummary : null
if (!fn) {
  console.error('usage: sweep.cjs run --base <url> --out <dir> [--only <substr>] [--concurrency N] [--themes dark,light] [--resume]\n       sweep.cjs diff <baselineDir> <afterDir>\n       sweep.cjs summary <dir>')
  process.exit(2)
}
Promise.resolve(fn(args)).catch((e) => { console.error(e); process.exit(1) })
