"use strict";

// Standalone Chromium checks. Each case starts from the same scratch lesson
// and alters only the paint, position or state that its gate should detect.
const { chromium } = require("playwright");
const { mkdtemp, writeFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { auditGates, auditResults, auditVisual, captureArtwork } = require("./audit.cjs");
const { measure } = require("./pixels.cjs");

const name = "Scratch chart";
const row = { key: "drawing", name, line: 1, domIndex: 0, hasStage: true, hasTokens: true };
const html = `<!doctype html><meta charset="utf-8">
<style>
  html { color: #171717; background: #fff }
  figure { width: 360px; margin: 12px; background: #fff; overflow: hidden }
  .fig-stage { border-radius: 8px; background: #f8f8f8; box-shadow: inset 0 1px #ddd }
  svg { display: block; font: 14px sans-serif }
  button { color: #141414; background: transparent; border: 1px solid #888; padding: 4px }
  button span { display: inline-block; width: 12px; height: 8px }
  button[aria-pressed=true] span { background: #043f72; color: #fff }
  td { padding: 4px }
  tr[aria-current=true] td { background: #1e2352; color: #fff }
</style>
<main data-lesson-article><figure class="fig-panel" data-gate-item="0">
  <div class="fig-stage">
    <svg role="img" aria-label="Scratch chart" width="360" height="176" viewBox="0 0 360 176">
      <rect id="focal" data-fig-focus="true" x="22" y="50" width="142" height="68" fill="#b6d4ee" stroke="#171717" stroke-width="3" rx="5"/>
      <text x="35" y="82">Current value</text>
      <path data-fig-mark="Threshold" aria-label="Threshold" d="M196 85H331" fill="none" stroke="#006b5e" stroke-width="3" stroke-dasharray="4 3"/>
      <text id="first" x="22" y="30">First label</text>
      <text id="second" x="198" y="30">Second label</text>
      <g data-fig-scale="Magnitude">
        <rect id="low" data-fig-order="1" x="180" y="119" width="52" height="29" fill="#ddd"/>
        <rect id="high" data-fig-order="2" x="260" y="119" width="52" height="29" fill="#444"/>
      </g>
    </svg>
  </div>
  <div class="fig-legend"><svg width="50" height="21" aria-hidden="true">
    <path id="swatch" data-fig-swatch="Threshold" d="M5 10H44" fill="none" stroke="#006b5e" stroke-width="3" stroke-dasharray="4 3"/>
  </svg></div>
  <div><button id="selected" type="button" aria-pressed="true">First <span aria-hidden="true"></span></button>
    <button type="button" aria-pressed="false">Second <span aria-hidden="true"></span></button></div>
  <table><tbody><tr aria-current="true"><td>Current</td></tr><tr><td>Other</td></tr></tbody></table>
</figure></main>`;

const cases = [
  ["G11", "push an axis label past the SVG viewport", 'id="second" x="198"', 'id="second" x="343"'],
  ["G12", "place two labels on the same baseline", 'id="second" x="198"', 'id="second" x="24"'],
  ["G13", "change the swatch dash pattern only", 'id="swatch" data-fig-swatch="Threshold" d="M5 10H44" fill="none" stroke="#006b5e" stroke-width="3" stroke-dasharray="4 3"', 'id="swatch" data-fig-swatch="Threshold" d="M5 10H44" fill="none" stroke="#006b5e" stroke-width="3"'],
  ["G14", "keep the old drawing inside a different frame", "#b6d4ee", "#dec497"],
  ["G14", "remove the stage depth", "box-shadow: inset 0 1px #ddd", "box-shadow: none"],
  ["G15", "paint a selected button exactly like its peer", "background: #043f72; color: #fff", "background: transparent; color: #141414"],
  ["G15", "paint selected row cells exactly like their peers", "background: #1e2352; color: #fff", "background: transparent; color: #171717"],
  ["G16", "reverse the ordered luminance", 'data-fig-order="1"', 'data-fig-order="3"'],
  ["G17", "lower the focal rim against its background", 'stroke="#171717" stroke-width="3"', 'stroke="#e3edf5" stroke-width="3"'],
];

async function main() {
  const scratch = await mkdtemp(path.join(tmpdir(), "figure-gate-mutations-"));
  const file = path.join(scratch, "index.html");
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 650 }, deviceScaleFactor: 2 });
    async function open(content) {
      await writeFile(file, content);
      await page.goto(pathToFileURL(file).href + "?case=" + Math.random());
      await page.evaluate(() => document.fonts.ready);
      return page.locator("figure");
    }
    const baseline = await open(html.replace("#b6d4ee", "#dec497"));
    const before = { artwork: { light: { 0: await captureArtwork(baseline) } } };
    async function check(content) {
      const root = await open(content);
      const results = await auditVisual(root, "light");
      const artwork = await captureArtwork(root);
      const pixels = await measure(page, [row]);
      return auditResults([{ width: 1440, theme: "light", rows: [row], audits: { 0: results }, artwork: { 0: artwork }, pixels }], before, "", []);
    }
    const control = await check(html);
    for (const gate of auditGates)
      if (control[gate].status !== "PASS")
        throw Error(`Clean fixture ${gate}: ${control[gate].summary}`);
    console.log("PASS G11–G17 clean scratch figure");
    for (const [gate, description, from, to] of cases) {
      const mutated = html.replace(from, to).replace(
        "background: #fff; overflow: hidden",
        gate === "G14" ? "background: #ffe4de; overflow: hidden" : "background: #fff; overflow: hidden",
      );
      if (html === mutated) throw Error("Mutation did not change the fixture: " + gate);
      const verdict = (await check(mutated))[gate];
      if (verdict.status !== "FAIL") throw Error(`${gate} unexpectedly passed: ${description}`);
      console.log(`${verdict.status} ${gate} ${description} — ${verdict.summary}`);
    }
  } finally {
    await browser?.close();
    await rm(scratch, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
