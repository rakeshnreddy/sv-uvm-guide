// Captures screenshots and page metrics from the live site for the design review.
// Run from the project root: node <this file> <outDir>
const path = require('path')
const fs = require('fs')
const { chromium } = require(require.resolve('@playwright/test', { paths: [process.cwd()] }))

// BASE=http://localhost:3000 captures a local dev server; ONLY=home,lesson-f1a limits the pages; QUICK=1 skips the extra themes.
const BASE = process.env.BASE || 'https://sv-uvm-guide.rakesh-n99.workers.dev'
const OUT = process.argv[2]
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true })

const PAGES = [
  ['home', '/'],
  ['curriculum', '/curriculum'],
  ['tier-t1', '/curriculum/T1_Foundational'],
  ['module-f1a', '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs'],
  ['lesson-f1a', '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index'],
  ['lesson-uvm-phasing', '/curriculum/T2_Intermediate/I-UVM-1C_UVM_Phasing/index'],
  ['practice', '/practice'],
  ['lab-basics', '/practice/lab/basics-1'],
  ['viz-uvm-phasing', '/practice/visualizations/uvm-phasing'],
  ['exercises', '/exercises'],
  ['interview-prep', '/interview-prep'],
  ['dashboard', '/dashboard'],
  ['knowledge-hub', '/knowledge-hub'],
  ['resources', '/resources'],
  ['projects', '/projects'],
  ['assessment', '/assessment'],
  ['history', '/history'],
  ['learning-strategies', '/learning-strategies'],
  ['settings', '/settings'],
  ['placement-quiz', '/quiz/placement'],
  ['not-found', '/this-page-does-not-exist'],
]
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null
if (ONLY) for (let i = PAGES.length - 1; i >= 0; i--) if (!ONLY.has(PAGES[i][0])) PAGES.splice(i, 1)
const LIGHT = new Set(process.env.LIGHT_ALL ? PAGES.map(([n]) => n) : ['home', 'curriculum', 'lesson-f1a', 'practice', 'dashboard', 'knowledge-hub'])
const EXTRA_THEMES = ['ocean-light', 'sunset-dark', 'forest-light', 'violet-dark']
const VIEW = {
  desktop: { viewport: { width: 1440, height: 900 } },
  tablet: { viewport: { width: 820, height: 1180 }, hasTouch: true },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
}

const metrics = []

async function measure(page) {
  return page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
    }
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1].split(',').map((x) => parseFloat(x))
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
    }
    const lum = (c) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    const bgOf = (el) => {
      // Nearest opaque background colour. Gradients and images are not handled, so results are approximate.
      let e = el
      let hasImage = false
      while (e) {
        const s = getComputedStyle(e)
        if (s.backgroundImage && s.backgroundImage !== 'none') hasImage = true
        const c = parse(s.backgroundColor)
        if (c && c.a > 0.9) return { c, hasImage }
        e = e.parentElement
      }
      return { c: { r: 255, g: 255, b: 255, a: 1 }, hasImage }
    }
    const lowContrast = []
    const seen = new Set()
    const textEls = Array.from(document.querySelectorAll('p, a, button, h1, h2, h3, h4, li, span, label, td, th, summary, small')).slice(0, 1500)
    for (const el of textEls) {
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1).map((n) => n.textContent.trim()).join(' ')
      if (!own || !vis(el)) continue
      const s = getComputedStyle(el)
      const fg = parse(s.color)
      if (!fg) continue
      const { c: bg, hasImage } = bgOf(el)
      const l1 = lum(fg), l2 = lum(bg)
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      const size = parseFloat(s.fontSize)
      const large = size >= 24 || (size >= 18.66 && parseInt(s.fontWeight, 10) >= 700)
      if (ratio < (large ? 3 : 4.5)) {
        const key = s.color + '|' + JSON.stringify(bg) + '|' + Math.round(size)
        if (seen.has(key)) continue
        seen.add(key)
        lowContrast.push({ text: own.slice(0, 50), ratio: Math.round(ratio * 100) / 100, color: s.color, bg: `rgb(${bg.r},${bg.g},${bg.b})`, size, approx: hasImage || fg.a < 1 })
      }
    }
    const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight }
    const targets = Array.from(document.querySelectorAll('a, button, select, input, [role="button"]')).filter((el) => vis(el) && inView(el))
    const small = targets.filter((el) => { const r = el.getBoundingClientRect(); return r.height < 40 || r.width < 40 })
    const fontOf = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontFamily.split(',')[0].trim() + ' ' + getComputedStyle(el).fontSize + '/' + getComputedStyle(el).lineHeight + ' w' + getComputedStyle(el).fontWeight : null }
    const res = performance.getEntriesByType('resource')
    const js = res.filter((r) => r.initiatorType === 'script' || /\.js(\?|$)/.test(r.name))
    const nav = performance.getEntriesByType('navigation')[0]
    return {
      title: document.title,
      theme: document.documentElement.getAttribute('data-theme'),
      htmlClass: document.documentElement.className,
      h1: Array.from(document.querySelectorAll('h1')).map((h) => h.textContent.trim().slice(0, 90)),
      headings: Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 40).map((h) => h.tagName + ' ' + h.textContent.trim().slice(0, 70)),
      overflowX: document.documentElement.scrollWidth - innerWidth,
      docHeight: document.documentElement.scrollHeight,
      fonts: { body: fontOf('body'), p: fontOf('main p'), h1: fontOf('h1'), h2: fontOf('h2'), code: fontOf('pre code, code'), navLink: fontOf('header a') },
      headerLinks: Array.from(document.querySelectorAll('header a, header button')).filter(vis).map((a) => (a.textContent.trim() || a.getAttribute('aria-label') || '?').slice(0, 40) + (a.getAttribute('href') ? ' -> ' + a.getAttribute('href') : '')),
      landmarks: { header: document.querySelectorAll('header').length, nav: document.querySelectorAll('nav').length, main: document.querySelectorAll('main').length, footer: document.querySelectorAll('footer').length, aside: document.querySelectorAll('aside').length },
      navLabels: Array.from(document.querySelectorAll('nav')).map((n) => n.getAttribute('aria-label') || '(unlabelled)'),
      mainTextWidth: (() => { const p = document.querySelector('main p'); return p ? Math.round(p.getBoundingClientRect().width) : null })(),
      tapTargets: { total: targets.length, small: small.length, sample: small.slice(0, 12).map((el) => { const r = el.getBoundingClientRect(); return (el.textContent.trim() || el.getAttribute('aria-label') || el.tagName).slice(0, 30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) }) },
      lowContrast: lowContrast.slice(0, 25),
      domNodes: document.querySelectorAll('*').length,
      jsTransferKB: Math.round(js.reduce((a, r) => a + (r.transferSize || 0), 0) / 1024),
      jsFiles: js.length,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadMs: nav ? Math.round(nav.loadEventEnd) : null,
      lcpMs: window.__lcp || null,
    }
  })
}

async function run(viewName, theme, pages, segments) {
  const browser = await chromium.launch()
  const context = await browser.newContext({ ...VIEW[viewName], deviceScaleFactor: 1 })
  await context.addInitScript((t) => {
    try { localStorage.setItem('theme', t) } catch (e) {}
    try { new PerformanceObserver((l) => { const e = l.getEntries(); window.__lcp = Math.round(e[e.length - 1].startTime) }).observe({ type: 'largest-contentful-paint', buffered: true }) } catch (e) {}
  }, theme)
  for (const [name, url] of pages) {
    const page = await context.newPage()
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 200)))
    const tag = `${name}.${viewName}.${theme}`
    try {
      let resp
      try { resp = await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 40000 }) }
      catch (e) { resp = await page.goto(BASE + url, { waitUntil: 'load', timeout: 40000 }) }
      await page.waitForTimeout(1200)
      const m = await measure(page)
      const h = VIEW[viewName].viewport.height
      const n = name === 'home' ? Math.min(9, Math.ceil(m.docHeight / h)) : Math.min(segments, Math.ceil(m.docHeight / h))
      for (let i = 0; i < n; i++) {
        await page.evaluate((y) => window.scrollTo(0, y), i * h)
        await page.waitForTimeout(700)
        await page.screenshot({ path: path.join(OUT, 'shots', `${tag}.s${i}.png`) })
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      // Interactions, dark theme only: mobile menu, search dialog, user menu.
      if (theme === 'default-dark' && (name === 'home' || name === 'lesson-f1a' || name === 'curriculum')) {
        const tryClick = async (label, re) => {
          const btn = page.getByRole('button', { name: re }).first()
          if (await btn.count() && await btn.isVisible().catch(() => false)) {
            await btn.click({ timeout: 3000 }).catch(() => {})
            await page.waitForTimeout(700)
            await page.screenshot({ path: path.join(OUT, 'shots', `${tag}.${label}.png`) })
            await page.keyboard.press('Escape').catch(() => {})
            await page.waitForTimeout(300)
            return true
          }
          return false
        }
        m.interactions = {
          menu: await tryClick('menu', /menu|navigation/i),
          search: await tryClick('search', /search/i),
          outline: await tryClick('outline', /outline|contents|sidebar/i),
        }
      }
      metrics.push({ page: name, url, view: viewName, themeSet: theme, status: resp ? resp.status() : null, shots: n, errors: errors.slice(0, 6), ...m })
      console.log('ok', tag, resp ? resp.status() : '-', 'h=' + m.docHeight, 'overflowX=' + m.overflowX)
    } catch (e) {
      metrics.push({ page: name, url, view: viewName, themeSet: theme, failed: String(e).slice(0, 300) })
      console.log('FAIL', tag, String(e).slice(0, 160))
    }
    await page.close()
  }
  await browser.close()
}

;(async () => {
  const light = PAGES.filter(([n]) => LIGHT.has(n))
  const two = PAGES.filter(([n]) => n === 'home' || n === 'lesson-f1a')
  await Promise.all([
    run('desktop', 'default-dark', PAGES, 3),
    run('mobile', 'default-dark', PAGES, 3),
  ])
  await Promise.all([
    run('desktop', 'default-light', light, 3),
    run('mobile', 'default-light', light, 3),
    run('tablet', 'default-dark', two, 2),
  ])
  if (!process.env.QUICK) for (const t of EXTRA_THEMES) await run('desktop', t, two, 2)
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(metrics, null, 1))
  console.log('done', metrics.length, 'loads')
})()
