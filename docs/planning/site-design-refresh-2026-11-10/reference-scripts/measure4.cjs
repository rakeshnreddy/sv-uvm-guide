// Width in drawing units of each string of the four figures, at the sizes they are drawn with.
const { chromium } = require('playwright');
const items = JSON.parse(process.argv[2] || '[]');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
  await p.goto('http://localhost:3210/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index', { waitUntil: 'networkidle', timeout: 180000 });
  const out = await p.evaluate((items) => {
    const host = document.getElementById('f1a-journey-title').closest('svg');
    const NS = 'http://www.w3.org/2000/svg';
    return items.map(([size, weight, s]) => {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('font-size', size); if (weight) t.setAttribute('font-weight', weight);
      t.textContent = s; host.appendChild(t);
      const w = t.getComputedTextLength(); t.remove();
      return `${w.toFixed(1)}\t${size}${weight ? '/' + weight : ''}\t${s}`;
    }).join('\n');
  }, items);
  console.log(out);
  await b.close();
})();
