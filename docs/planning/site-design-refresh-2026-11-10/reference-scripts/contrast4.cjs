// Measured contrast of the four figures of F1A redrawn last, from pixels, in both themes, at 1440 and 390.
//   Text: the computed fill (with its opacity) over every pixel behind its box; the worst ratio is reported. Floor 4.5.
//   Marks (a stroke that is drawn, or a solid mark): the mark as painted against what is behind it, at points along its
//   outline (a stroke) or at its centre (a solid mark); the typical point of each mark, then the worst mark of each kind.
//   Floor 3. Decoration (fig-fx) is left out, and so are hairlines drawn at a stroke opacity below 1 (tray borders, as in figure A).
// Usage: [IDS=f1a-journey-title,...] [ALL=1] node contrast4.cjs
const { chromium } = require('playwright');
const sharp = require('sharp');
const URL = 'http://localhost:3210/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';
const IDS = (process.env.IDS || 'f1a-life-title,f1a-shift-title,f1a-ladder-title,f1a-signoff-title').split(',');
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  for (const W of [1440, 390]) for (const theme of ['dark', 'light']) {
    const DPR = 2;
    const ctx = await browser.newContext({ colorScheme: theme, viewport: { width: W, height: 1400 }, deviceScaleFactor: DPR });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch (e) {} }, theme);
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 180000 });
    for (const id of IDS) {
      const sel = W < 640 ? `#${id}-s` : `#${id}`;
      const svg = await page.evaluateHandle((s) => document.querySelector(s).closest('svg'), sel);
      await svg.evaluate((n) => { let d = n.parentElement; while (d) { if (d.tagName === 'DETAILS' && !d.open) d.open = true; d = d.parentElement; } const r = n.getBoundingClientRect(); window.scrollBy(0, r.top - 200); });
      // Lazy interactives near the figure change height as they load: wait until the drawing has stopped moving.
      let box = await svg.boundingBox();
      for (let i = 0; i < 20; i++) { await page.waitForTimeout(400); const b2 = await svg.boundingBox(); const still = Math.abs(b2.y - box.y) < 0.01 && Math.abs(b2.x - box.x) < 0.01; box = b2; if (still && i > 1) break; }
      const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) };
      const data = await svg.evaluate((n, clip) => {
        const rgba = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,/]+/).map(parseFloat); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; };
        const fx = (e) => !!e.closest('.fig-fx') || !!e.closest('defs');
        const texts = [...n.querySelectorAll('text')].map((t) => {
          const cs = getComputedStyle(t), b = t.getBoundingClientRect(), c = rgba(cs.fill);
          return { s: t.textContent, fill: c, a: c[3] * parseFloat(cs.fillOpacity) * parseFloat(cs.opacity), box: [b.x - clip.x, b.y - clip.y, b.width, b.height] };
        });
        const marks = [];
        for (const e of n.querySelectorAll('line, path, rect, circle, polygon')) {
          if (fx(e)) continue;
          const cs = getComputedStyle(e), m = e.getScreenCTM();
          const solid = e.classList.contains('fig-solid');
          const stroked = cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0 && parseFloat(cs.strokeOpacity) > 0;
          if (!solid && !stroked) continue;
          const kind = `${e.tagName} ${(e.getAttribute('class') || '').replace(/\s+/g, ' ')}${e.closest('g[class]') && !solid ? ' in ' + e.closest('g[class]').getAttribute('class') : ''}${e.getAttribute('stroke-dasharray') ? ' dashed' : ''}`;
          const faint = stroked && parseFloat(cs.strokeOpacity) < 1;
          const pts = [];
          if (solid) { const b = e.getBBox(); pts.push([b.x + b.width / 2, b.y + b.height / 2], [b.x + b.width * 0.4, b.y + b.height * 0.5], [b.x + b.width * 0.6, b.y + b.height * 0.5]); }
          else { const len = e.getTotalLength(), k = Math.min(400, Math.max(24, Math.round(len / 1.5))); for (let i = 0; i <= k; i++) { const p = e.getPointAtLength((len * i) / k); pts.push([p.x, p.y]); } }
          marks.push({ kind, faint, solid, pts: pts.map(([x, y]) => [m.a * x + m.c * y + m.e - clip.x, m.b * x + m.d * y + m.f - clip.y]) });
        }
        return { texts, marks };
      }, clip);
      const shotA = await page.screenshot({ clip });
      await svg.evaluate((n) => { n.setAttribute('data-measure', '1'); const st = document.createElement('style'); st.id = 'measure-style'; st.textContent = 'svg[data-measure] text{visibility:hidden!important} svg[data-measure] :is(line,path,rect,circle,polygon):not(.fig-fx):not(.fig-fx *){stroke:transparent!important} svg[data-measure] .fig-solid{fill:transparent!important}'; document.head.appendChild(st); });
      await page.waitForTimeout(150);
      const shotB = await page.screenshot({ clip });
      await svg.evaluate((n) => { n.removeAttribute('data-measure'); document.getElementById('measure-style').remove(); });
      const after = await svg.boundingBox();
      if (Math.abs(after.y - box.y) > 0.01 || Math.abs(after.x - box.x) > 0.01) { bad++; console.log(`  FAIL ${id}: the drawing moved while it was measured (${box.y} to ${after.y}); run again`); }
      const A = await sharp(shotA).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
      const B = await sharp(shotB).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
      // A computed point can sit up to 1.5 device pixels off the painted line (the drawing is snapped to device pixels),
      // so a point is read as the best of the 5 by 5 device pixels round it. A pixel that is not on the mark is the same
      // in both shots and reads 1, so this cannot raise a reading above what the mark itself gives.
      const near = (x, y) => { let m = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) m = Math.max(m, ratio(px(A, x + dx / DPR, y + dy / DPR), px(B, x + dx / DPR, y + dy / DPR))); return m; };
      const px = (img, x, y) => { const X = Math.min(img.info.width - 1, Math.max(0, Math.round(x * DPR))), Y = Math.min(img.info.height - 1, Math.max(0, Math.round(y * DPR))), i = (Y * img.info.width + X) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
      let worstText = { r: 99 };
      for (const t of data.texts) {
        let w = 99;
        for (let y = t.box[1]; y <= t.box[1] + t.box[3]; y += 1) for (let x = t.box[0]; x <= t.box[0] + t.box[2]; x += 1) {
          const bg = px(B, x, y), fg = t.fill.slice(0, 3).map((c, i) => t.a * c + (1 - t.a) * bg[i]);
          w = Math.min(w, ratio(fg, bg));
        }
        if (w < worstText.r) worstText = { r: w, s: t.s };
        if (w < 4.5) { bad++; console.log(`  FAIL text ${w.toFixed(2)} ${JSON.stringify(t.s)}`); }
      }
      const kinds = new Map();
      for (const mk of data.marks) {
        // The typical point on the mark, not its best one: the 75th percentile along a stroke (a dash 5 3 is drawn on
        // 62% of its length, and a point where another line crosses must not count), the median of a solid mark.
        const rs = mk.pts.map(([x, y]) => near(x, y)).sort((a, b) => a - b);
        const best = rs[Math.min(rs.length - 1, Math.floor(rs.length * (mk.solid ? 0.5 : 0.75)))];
        const k = (mk.faint ? '[hairline] ' : '') + mk.kind;
        if (!kinds.has(k) || best < kinds.get(k)) kinds.set(k, best);
      }
      console.log(`${id}${W < 640 ? '-s' : ''} ${theme} ${W}: ${data.texts.length} texts, worst ${worstText.r.toFixed(2)} (${JSON.stringify(worstText.s)}); ${data.marks.length} marks`);
      for (const [k, v] of [...kinds].sort((a, b) => a[1] - b[1])) {
        const floorMiss = v < 3 && !k.startsWith('[hairline]');
        if (floorMiss) bad++;
        if (floorMiss || process.env.ALL || v < 3.6) console.log(`  ${floorMiss ? 'FAIL' : '    '} ${v.toFixed(2)}  ${k}`);
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log(bad ? `${bad} under the floor` : 'every text at 4.5:1 or more, every mark at 3:1 or more');
  process.exit(bad ? 1 : 0);
})();
