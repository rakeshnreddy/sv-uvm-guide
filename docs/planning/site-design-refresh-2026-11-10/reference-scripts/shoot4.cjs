// Shots of the four figures of F1A redrawn last: lifecycle, shift left, career ladder, coverage of an incomplete plan.
// Usage: PHASE=before|after [W=1440] [ONLY=life,shift,ladder,coverage] [THEMES=dark,light] [SUFFIX=--390] [FORCED=1] [PRINT=1] node shoot4.cjs
const { chromium } = require('playwright');
const OUT = '<scratch>/figures/art/shots';
const URL = 'http://localhost:3210/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';
const PHASE = process.env.PHASE || 'after';
const W = +(process.env.W || 1440);
const IDS = { life: 'f1a-life-title', shift: 'f1a-shift-title', ladder: 'f1a-ladder-title', coverage: 'f1a-signoff-title', a: 'f1a-journey-title', b: 'f1a-respin-title' };
const ONLY = (process.env.ONLY || 'life,shift,ladder,coverage').split(',');
const THEMES = (process.env.THEMES || 'dark,light').split(',');
const style = PHASE === 'before' ? 'before' : 'rich';
const SUFFIX = process.env.SUFFIX || '';
(async () => {
  const browser = await chromium.launch();
  for (const theme of THEMES) {
    const ctx = await browser.newContext({
      colorScheme: theme, viewport: { width: W, height: +(process.env.H || 1900) }, deviceScaleFactor: 2,
      forcedColors: process.env.FORCED ? 'active' : 'none',
    });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch (e) {} }, theme);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message.split('\n')[0]));
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 180000 });
    if (process.env.PRINT) await page.emulateMedia({ media: 'print' });
    for (const key of ONLY) {
      const handle = await page.evaluateHandle((id) => (document.getElementById(id) || document.getElementById(id + '-s'))?.closest('figure'), IDS[key]);
      const el = handle.asElement();
      if (!el) { console.log('MISSING', key); continue; }
      await el.evaluate((n) => { let d = n.parentElement; while (d) { if (d.tagName === 'DETAILS' && !d.open) d.open = true; d = d.parentElement; } });
      await el.evaluate((n) => { const r = n.getBoundingClientRect(); window.scrollBy(0, r.top - (window.innerWidth < 640 ? 170 : 90)); });
      await page.waitForTimeout(500);
      const file = `${OUT}/f1a-${key}--${style}--${theme}${SUFFIX}.png`;
      const box = await el.boundingBox();
      await page.screenshot({ path: file, clip: { x: Math.max(0, box.x - 8), y: box.y - 8, width: Math.min(W, box.width + 16), height: box.height + 16 } });
      const info = await el.evaluate((n) => [...n.querySelectorAll('svg[role="img"]')].filter((s) => s.getBoundingClientRect().width > 0).map((s) => {
        const vb = s.viewBox.baseVal, w = s.getBoundingClientRect().width, k = w / vb.width;
        const px = [...s.querySelectorAll('text')].map((t) => parseFloat(getComputedStyle(t).fontSize) * k);
        return `${s.getAttribute('aria-labelledby')} viewBox ${vb.width}x${vb.height} shown ${Math.round(w)} wide, text ${Math.min(...px).toFixed(2)} to ${Math.max(...px).toFixed(2)} px`;
      }));
      console.log('ok', file.split('/').pop(), Math.round(box.width) + 'x' + Math.round(box.height), '|', info.join(' ; '));
    }
    await ctx.close();
  }
  await browser.close();
})();
