#!/usr/bin/env node
/**
 * Generates the mark, the app icons and the social image as static files under
 * src/app/, where the Next.js metadata file conventions serve them (favicon.ico,
 * icon.svg, icon1.png, icon2.png, apple-icon.png, opengraph-image.png and
 * twitter-image.png, with their .alt.txt files). The outputs are committed, so
 * nothing renders at request time; run this again after changing the mark or
 * the dark-mode colour tokens:
 *
 *   node scripts/generate-brand-images.mjs
 *
 * The mark (DESIGN.md; SPEC-phases-2-4.md, phase 4): one clock pulse (a low
 * line, a rising edge, a high line, a falling edge) drawn as a 2.5 px accent
 * stroke on the dark page colour in a rounded square, on a 32 px grid.
 * Colours are read from the dark-mode block of src/app/globals.css, so the
 * files follow the tokens. Rendering uses the Playwright library's Chromium.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(root, 'src/app');

export const SITE_NAME = 'SV/UVM Hub';
export const HEADLINE = 'SystemVerilog and UVM, one clock edge at a time';
export const SOCIAL_ALT = `${SITE_NAME}: ${HEADLINE}. The mark, a single clock pulse, on the course's colour field.`;

/** The pulse on the 32-unit grid: low from x 6 to 13, up to the high level, high to x 26, then down. */
export const PULSE_PATH = 'M6 22H13V10H26V22';
export const MARK_STROKE = 2.5;
export const MARK_RADIUS = 7;

/** The dark-mode tokens the images use, from the block of globals.css that html[data-theme="dark"] opens. */
export function readDarkTokens(css) {
  const block = /html\[data-theme="dark"\]\s*\{([\s\S]*?)\n\s*\}/.exec(css)?.[1];
  if (!block) throw new Error('No dark-mode block in globals.css');
  const token = (name) => {
    const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(block);
    if (!match) throw new Error(`globals.css dark block has no --${name}`);
    return match[1].trim();
  };
  const hsl = (name) => `hsl(${token(name)})`;
  return {
    background: hsl('background'),
    foreground: hsl('foreground'),
    muted: hsl('muted-foreground'),
    primary: hsl('primary'),
    border: hsl('border'),
    fields: [1, 2, 3, 4].map((n) => `hsl(${token(`field-${n}`)} / ${token(`field-${n}-alpha`)})`),
  };
}

/**
 * The mark as an SVG document: the rounded square in the page colour and the
 * pulse in the accent. `radius: 0` draws a full-bleed square, for the Apple
 * touch icon: iOS applies its own mask and fills transparent corners with black.
 */
export function markSvg(tokens, { radius = MARK_RADIUS } = {}) {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">',
    `<rect width="32" height="32"${radius ? ` rx="${radius}"` : ''} fill="${tokens.background}"/>`,
    `<path d="${PULSE_PATH}" fill="none" stroke="${tokens.primary}" stroke-width="${MARK_STROKE}" stroke-linecap="square" stroke-linejoin="miter"/>`,
    '</svg>',
    '',
  ].join('\n');
}

function fontFace(family, file, weight) {
  const url = pathToFileURL(path.join(root, 'public/fonts', file)).href;
  return `@font-face{font-family:"${family}";src:url("${url}") format("woff2");font-weight:${weight};font-style:normal;}`;
}

/**
 * The social image: the page colour, the four-tier colour field as the landing
 * page draws it ([data-page-field="all"] in globals.css), the mark, the site
 * name as the wordmark sets it, and the headline.
 */
export function socialHtml(tokens) {
  const [f1, f2, f3, f4] = tokens.fields;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFace('Plex', 'ibm-plex-sans/ibm-plex-sans-latin-500-normal.woff2', 500)}
${fontFace('Plex', 'ibm-plex-sans/ibm-plex-sans-latin-600-normal.woff2', 600)}
${fontFace('Mono', 'jetbrains-mono/jetbrains-mono-latin-700-normal.woff2', 700)}
html,body{margin:0;width:1200px;height:630px;background:${tokens.background};}
.frame{position:relative;width:1200px;height:630px;overflow:hidden;font-family:Plex,sans-serif;}
.field{position:absolute;inset:0;
  background-image:radial-gradient(44% 56% at 8% 6%, ${f1}, transparent 70%),
    radial-gradient(46% 62% at 38% 0%, ${f2}, transparent 70%),
    radial-gradient(46% 62% at 68% 8%, ${f3}, transparent 70%),
    radial-gradient(38% 52% at 96% 30%, ${f4}, transparent 70%);
  -webkit-mask-image:linear-gradient(to bottom,#000 40%,transparent);}
.content{position:absolute;inset:0;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between;}
.brand{display:flex;align-items:center;gap:20px;}
.brand svg{width:72px;height:72px;display:block;}
.wordmark{font-size:34px;line-height:1;white-space:nowrap;}
.wordmark .sv{font-family:Mono,monospace;font-weight:700;color:${tokens.foreground};font-variant-ligatures:none;}
.wordmark .hub{font-weight:500;color:${tokens.muted};margin-left:0.3em;}
h1{margin:0;max-width:16em;font-size:76px;line-height:1.05;font-weight:500;letter-spacing:-0.025em;color:${tokens.foreground};text-wrap:balance;}
</style></head><body><div class="frame"><div class="field"></div><div class="content">
<div class="brand">${markSvg(tokens)}<span class="wordmark"><span class="sv">SV/UVM</span><span class="hub">Hub</span></span></div>
<h1>${HEADLINE}</h1>
</div></div></body></html>`;
}

/** An .ico holding PNG images (supported by every current browser), largest last. */
export function icoFromPngs(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const directory = Buffer.alloc(16 * entries.length);
  let offset = 6 + directory.length;
  entries.forEach(({ size, png }, index) => {
    const at = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, at);
    directory.writeUInt8(size >= 256 ? 0 : size, at + 1);
    directory.writeUInt8(0, at + 2);
    directory.writeUInt8(0, at + 3);
    directory.writeUInt16LE(1, at + 4);
    directory.writeUInt16LE(32, at + 6);
    directory.writeUInt32LE(png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, directory, ...entries.map((entry) => entry.png)]);
}

/** Renders the mark at `size` px: with a transparent background, or opaque for the full-bleed Apple icon. */
async function renderMark(page, svg, size, { opaque = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  const html = `<!doctype html><html><head><style>html,body{margin:0;background:transparent;}svg{display:block;width:${size}px;height:${size}px;}</style></head><body>${svg}</body></html>`;
  await page.setContent(html);
  return page.screenshot({ omitBackground: !opaque, clip: { x: 0, y: 0, width: size, height: size } });
}

async function main() {
  const tokens = readDarkTokens(fs.readFileSync(path.join(appDir, 'globals.css'), 'utf8'));
  const svg = markSvg(tokens);
  const write = (name, data) => {
    fs.writeFileSync(path.join(appDir, name), data);
    console.log(`wrote src/app/${name}`);
  };

  write('icon.svg', svg);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const png = {};
    for (const size of [16, 32, 48, 192]) png[size] = await renderMark(page, svg, size);
    write('icon1.png', png[32]);
    write('icon2.png', png[192]);
    // An opaque full-bleed square: iOS rounds the corners itself.
    write('apple-icon.png', await renderMark(page, markSvg(tokens, { radius: 0 }), 180, { opaque: true }));
    write('favicon.ico', icoFromPngs([16, 32, 48].map((size) => ({ size, png: png[size] }))));

    // The social image goes through a file:// page so the self-hosted fonts load.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-images-'));
    const file = path.join(dir, 'social.html');
    fs.writeFileSync(file, socialHtml(tokens));
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => document.fonts.ready);
    const social = await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } });
    fs.rmSync(dir, { recursive: true, force: true });
    write('opengraph-image.png', social);
    write('twitter-image.png', social);
    write('opengraph-image.alt.txt', SOCIAL_ALT);
    write('twitter-image.alt.txt', SOCIAL_ALT);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
