#!/usr/bin/env node
/*
 * measure-lazy-interactive-heights.cjs
 *
 * What it measures. Every lazy MDX interactive (LazyMdxInteractive) shows a
 * placeholder of a reserved height while its code loads, so the lesson does
 * not move when the interactive swaps in. The reserved heights come from
 * src/components/mdx/lazy-mdx-interactives.ts. This tool checks them in a real
 * browser, per lesson and per viewport band:
 *
 *   reserved  the height the placeholder ([data-interactive-placeholder]) took
 *             for that instance before the interactive swapped in;
 *   rendered  the height of the interactive once it has rendered and has been
 *             stable for 500 ms (fonts loaded): the union of the slot's child
 *             boxes, margins excluded, which is how the registry's heights are
 *             defined ("rendered height ... margins excluded");
 *   delta     rendered - reserved.
 *
 * The placeholder only appears on a client-side navigation: on a hard load the
 * server renders the interactives in full and the slot keeps that HTML (see
 * server-markup-snapshot.ts). So each lesson is opened the way a learner
 * reaches it from the site: load /curriculum, then window.next.router.push to
 * the lesson in a fresh browser context, with a MutationObserver recording each
 * placeholder's height as it is inserted. If a placeholder is never seen (its
 * code was already loaded), the reserved height falls back to the value the
 * slot was given (InteractiveSlot's height / midHeight / mobileHeight props).
 *
 * Each instance's MDX props (the object lazyMdxInteractivePlaceholder sees)
 * are read from React's fiber tree: the slot div [data-mdx-interactive] ->
 * InteractiveSlot -> LazyMdxInteractive, whose props minus `name` are exactly
 * that object. Which rule supplied the reserved value (prop, variant, estimate,
 * measured entry or the default) is worked out by evaluating the registry
 * itself (transpiled with esbuild) against those props.
 *
 * Per page and band it also records the layout shift a PerformanceObserver
 * ("layout-shift", entries without recent input) reports from the lesson's
 * first paint until the end of a top-to-bottom scroll at reading speed
 * (default 400 px every 300 ms): `load` up to the scroll, `total` to its end.
 * The shift of the route change itself (the hub page replaced by the lesson)
 * is left out of both and reported apart as `navigation`. The observer only
 * counts shifts of content in the viewport, and the interactives swap in
 * while the reader is still at the top, so it also records how much the page
 * height changed from first paint to settled (`pageHeightChange`). Because
 * of that, CLS stays near 0 on almost every page and says little; pages are
 * ranked by `sumAbsDelta` (the sum of |delta| over the page's instances, the
 * distance the content below them moves) and then by |pageHeightChange|, with
 * CLS kept as a secondary figure.
 *
 * Footprint. `delta` compares boxes with margins excluded. An interactive whose
 * outer margin differs from the placeholder's (my-8) moves the page by a
 * different amount, so each instance also records its footprint: the gap
 * between the previous sibling's bottom and the next sibling's top, while its
 * placeholder shows (when it was seen) and once it has rendered.
 * `footprintDelta` is the change in that gap, and `marginDelta` is
 * footprintDelta - delta: nonzero when the margins differ. An instance with
 * |marginDelta| over the tolerance is listed under "marginMismatches".
 *
 * Bands: desktop 1440x900; mid 1100x900 (inside MID_BAND 1024-1279, the width
 * the registry's midHeight comment says it was measured at); phone 390x844 at
 * device scale 3. Optional (not run by default): tablet 768x1024, checked
 * against `height`, which also holds from 640 to 1023 px although it was
 * measured with the 1440 px column; ask for it with --bands ...,tablet. The phone band does not emulate touch by default, because the
 * registry's phone heights were measured without it; --phone-touch adds
 * isMobile and touch (some interactives lay out differently on a coarse pointer).
 *
 * Run (a dev or production server must be running; it does not start one):
 *   NODE_PATH=$PWD/node_modules node scripts/measure-lazy-interactive-heights.cjs \
 *     [--base http://localhost:3000] [--out heights.json] \
 *     [--lessons <slug|mdx path>,...] [--tiers T1,T2,...] \
 *     [--bands desktop,mid,phone] [--tolerance 4] [--concurrency 3] \
 *     [--scroll-step 400] [--scroll-interval 300] [--phone-touch]
 * A lesson slug is its path under content/curriculum without .mdx, e.g.
 * T1_Foundational/F2A_Core_Data_Types/index. Default: every lesson.
 * Exit status: 0 when every instance is within the tolerance, 1 when any is
 * over it, 2 on a usage error. A page that fails twice is recorded under
 * "failedPages" and the run carries on.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content", "curriculum");
const REGISTRY = path.join(ROOT, "src", "components", "mdx", "lazy-mdx-interactives.ts");

const USAGE =
  "usage: node scripts/measure-lazy-interactive-heights.cjs [--base URL] [--out FILE.json] [--lessons a,b | --tiers T1,T2] [--bands desktop,mid,phone] [--tolerance PX] [--concurrency N] [--scroll-step PX] [--scroll-interval MS] [--phone-touch]";

const BANDS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, key: "height" },
  mid: { viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, key: "midHeight" },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: false, hasTouch: false, key: "mobileHeight" },
  tablet: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false, key: "height" },
};
const DEFAULT_BANDS = ["desktop", "mid", "phone"];

function parseArgs(argv) {
  const opts = { base: "http://localhost:3000", out: null, lessons: null, tiers: null, bands: DEFAULT_BANDS.slice(), tolerance: 4, concurrency: 3, scrollStep: 400, scrollInterval: 300 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.includes("=") ? arg.split(/=(.*)/s) : [arg, undefined];
    const value = () => (inline !== undefined ? inline : argv[++i]);
    switch (flag) {
      case "--base": opts.base = value().replace(/\/$/, ""); break;
      case "--out": opts.out = path.resolve(value()); break;
      case "--lessons": opts.lessons = value().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--tiers": opts.tiers = value().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--bands": opts.bands = value().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--tolerance": opts.tolerance = Number(value()); break;
      case "--concurrency": opts.concurrency = Math.max(1, Number(value()) | 0); break;
      case "--scroll-step": opts.scrollStep = Number(value()); break;
      case "--scroll-interval": opts.scrollInterval = Number(value()); break;
      case "--phone-touch": BANDS.phone.isMobile = true; BANDS.phone.hasTouch = true; break;
      case "-h": case "--help": console.log(USAGE); process.exit(0); break;
      default: console.error(`unknown option ${arg}\n${USAGE}`); process.exit(2);
    }
  }
  for (const band of opts.bands) if (!BANDS[band]) { console.error(`unknown band ${band}\n${USAGE}`); process.exit(2); }
  if (!Number.isFinite(opts.tolerance) || opts.tolerance < 0) { console.error(`bad --tolerance\n${USAGE}`); process.exit(2); }
  return opts;
}

/** Every lesson slug under content/curriculum, in path order. */
function allLessons() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".mdx")) out.push(path.relative(CONTENT, full).replace(/\\/g, "/").replace(/\.mdx$/, ""));
    }
  };
  walk(CONTENT);
  return out;
}

function normalizeLesson(value) {
  let slug = value.replace(/\\/g, "/");
  const marker = "content/curriculum/";
  if (slug.includes(marker)) slug = slug.slice(slug.indexOf(marker) + marker.length);
  slug = slug.replace(/^\/?curriculum\//, "").replace(/^\//, "").replace(/\.mdx$/, "");
  return slug;
}

function selectLessons(opts) {
  const lessons = allLessons();
  if (opts.lessons) {
    return opts.lessons.map(normalizeLesson).map((slug) => {
      if (!fs.existsSync(path.join(CONTENT, `${slug}.mdx`))) console.error(`warning: no lesson file for ${slug}`);
      return slug;
    });
  }
  if (opts.tiers) {
    const tiers = opts.tiers.map((t) => t.toLowerCase());
    return lessons.filter((slug) => {
      const dir = slug.split("/")[0].toLowerCase();
      return tiers.some((t) => dir === t || dir.startsWith(`${t}_`));
    });
  }
  return lessons;
}

/** The registry module, transpiled so the tool applies its exact rules. */
function loadRegistry() {
  const esbuild = require("esbuild");
  const source = fs.readFileSync(REGISTRY, "utf8");
  const { code } = esbuild.transformSync(source, { loader: "ts", format: "cjs", target: "node18" });
  const mod = { exports: {} };
  new Function("module", "exports", "require", code)(mod, mod.exports, require);
  return mod.exports;
}

const positivePixels = (value) => {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

/** Which rule gave this instance its reserved height in a band: prop, variant, estimate, measured or default. */
function reservedSource(registry, name, props, band) {
  const meta = registry.lazyMdxInteractiveMeta[name] || {};
  const own = positivePixels(props[registry.PLACEHOLDER_HEIGHT_PROP]);
  const ownBand =
    band === "mid" ? positivePixels(props[registry.PLACEHOLDER_MID_HEIGHT_PROP]) : band === "phone" ? positivePixels(props[registry.PLACEHOLDER_MOBILE_HEIGHT_PROP]) : undefined;
  if (own !== undefined || ownBand !== undefined) return { source: "prop" };
  const variantIndex = meta.variants ? meta.variants.findIndex((v) => { try { return v.when(props); } catch { return false; } }) : -1;
  if (variantIndex >= 0) return { source: "variant", variant: variantIndex };
  if (meta.estimate) { try { if (meta.estimate(props)) return { source: "estimate" }; } catch { /* fall through */ } }
  if (meta.height !== undefined) return { source: "measured" };
  return { source: "default" };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  return JSON.stringify(value === undefined ? null : value);
}

// ---------------------------------------------------------------- in the page

/** Installed on the hub page before the client-side navigation. */
function installRecorders() {
  window.__lmi = { placeholders: [], shifts: [], pushAt: null, countFrom: null };
  const rec = window.__lmi;
  const seen = new WeakSet();
  const capture = (ph) => {
    if (seen.has(ph)) return;
    seen.add(ph);
    const slot = ph.closest("[data-mdx-interactive]");
    if (!slot) return;
    const entry = { slot, height: ph.getBoundingClientRect().height, footprint: null, t: performance.now() };
    rec.placeholders.push(entry);
    // The neighbours are laid out by the next frame; read the gap then, if the placeholder still shows.
    requestAnimationFrame(() => {
      if (!slot.querySelector("[data-interactive-placeholder]")) return;
      // A neighbouring slot is display: contents (no box of its own), so take its children's union.
      const box = (el) => {
        if (getComputedStyle(el).display !== "contents") return el.getBoundingClientRect();
        const rects = [...el.children].map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0);
        return rects.length ? { top: Math.min(...rects.map((r) => r.top)), bottom: Math.max(...rects.map((r) => r.bottom)) } : null;
      };
      const prev = slot.previousElementSibling && box(slot.previousElementSibling), next = slot.nextElementSibling && box(slot.nextElementSibling);
      // A negative gap means a neighbour is not laid out yet (it renders later); leave the footprint unknown.
      if (prev && next && next.top - prev.bottom >= 0) entry.footprint = Math.round((next.top - prev.bottom) * 100) / 100;
    });
  };
  new MutationObserver((mutations) => {
    for (const m of mutations) for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      // Shifts count from the frame after the lesson's first paint, so the route change itself is left out.
      if (rec.countFrom === null && rec.pushAt !== null && (node.matches("[data-lesson-article]") || node.querySelector("[data-lesson-article]"))) {
        rec.countFrom = Infinity;
        requestAnimationFrame(() => requestAnimationFrame(() => { rec.countFrom = performance.now(); rec.firstHeight = document.documentElement.scrollHeight; }));
      }
      if (node.matches("[data-interactive-placeholder]")) capture(node);
      for (const ph of node.querySelectorAll("[data-interactive-placeholder]")) capture(ph);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) rec.shifts.push({ t: e.startTime, value: e.value });
    }).observe({ type: "layout-shift", buffered: false });
  } catch (e) { rec.noLayoutShift = String(e); }
}

/** Every slot in document order: name, its MDX props (from the fiber tree), the slot's reserved heights, the placeholder seen. */
function readSlots() {
  const clean = (value, depth = 0) => {
    if (value === null || value === undefined) return value === null ? null : undefined;
    if (typeof value === "function") return "[function]";
    if (typeof value !== "object") return value;
    if (value.$$typeof) return "[element]";
    if (depth > 8) return "[deep]";
    if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
    const out = {};
    for (const [k, v] of Object.entries(value)) { const c = clean(v, depth + 1); if (c !== undefined) out[k] = c; }
    return out;
  };
  const rec = window.__lmi || { placeholders: [] };
  return [...document.querySelectorAll("[data-mdx-interactive]")].map((slot, index) => {
    const name = slot.getAttribute("data-mdx-interactive");
    const key = Object.keys(slot).find((k) => k.startsWith("__reactFiber$"));
    let fiber = key ? slot[key] : null;
    let props = null, slotProps = null;
    for (let i = 0; fiber && i < 10; i++, fiber = fiber.return) {
      const type = fiber.type;
      const fname = typeof type === "function" ? type.displayName || type.name : null;
      const mp = fiber.memoizedProps || {};
      if (!slotProps && fname === "InteractiveSlot") slotProps = { height: mp.height, midHeight: mp.midHeight, mobileHeight: mp.mobileHeight, title: mp.title };
      if (fname === "LazyMdxInteractive" || (slotProps && mp.name === name && !("componentProps" in mp) && typeof type === "function")) {
        const { name: _n, ...rest } = mp;
        props = clean(rest);
        break;
      }
    }
    const seen = rec.placeholders.find((p) => p.slot === slot);
    return {
      index, name, props, slotProps,
      placeholderHeight: seen ? seen.height : null,
      footprintBefore: seen ? seen.footprint ?? null : null,
      propsFrom: props ? "fiber" : null,
    };
  });
}

function slotState(index) {
  const slot = document.querySelectorAll("[data-mdx-interactive]")[index];
  if (!slot) return { missing: true };
  let top = Infinity, bottom = -Infinity;
  for (const c of slot.children) {
    const r = c.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
  }
  // A neighbouring slot is display: contents (no box of its own), so take its children's union.
  const box = (el) => {
    if (getComputedStyle(el).display !== "contents") return el.getBoundingClientRect();
    const rects = [...el.children].map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0);
    return rects.length ? { top: Math.min(...rects.map((r) => r.top)), bottom: Math.max(...rects.map((r) => r.bottom)) } : null;
  };
  const prev = slot.previousElementSibling && box(slot.previousElementSibling), next = slot.nextElementSibling && box(slot.nextElementSibling);
  return {
    height: Number.isFinite(top) ? Math.round((bottom - top) * 100) / 100 : 0,
    footprint: prev && next ? Math.round((next.top - prev.bottom) * 100) / 100 : null,
    placeholder: !!slot.querySelector("[data-interactive-placeholder]"),
    error: !!slot.querySelector("[data-interactive-error]"),
    snapshot: !!slot.querySelector("[data-interactive-snapshot]"),
  };
}

// ---------------------------------------------------------------- per page

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measurePage(browser, opts, lesson, band) {
  const cfg = BANDS[band];
  const context = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor, isMobile: cfg.isMobile, hasTouch: cfg.hasTouch, colorScheme: "light", reducedMotion: "no-preference" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  try {
    await page.goto(`${opts.base}/curriculum`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForFunction(() => window.next && window.next.router, null, { timeout: 60000 });
    await page.evaluate(installRecorders);
    const target = `/curriculum/${lesson}`;
    await page.evaluate((t) => { window.__lmi.pushAt = performance.now(); window.next.router.push(t); }, target);
    await page.waitForFunction((t) => location.pathname === t && document.querySelector("[data-lesson-article]"), target, { timeout: 120000 });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    const slots = await page.evaluate(readSlots);
    // Every interactive's chunk loads as soon as it renders; wait for the swaps (or errors) before scrolling.
    await page.waitForFunction(() => !document.querySelector("[data-interactive-placeholder]"), null, { timeout: 60000 }).catch(() => {});
    const SHIFTS = () => {
      const r = window.__lmi;
      const from = r.countFrom === null || r.countFrom === Infinity ? Infinity : r.countFrom;
      return { counted: r.shifts.filter((e) => e.t >= from).reduce((s, e) => s + e.value, 0), navigation: r.shifts.filter((e) => e.t < from).reduce((s, e) => s + e.value, 0) };
    };
    await page.waitForFunction(() => window.__lmi.countFrom !== null && window.__lmi.countFrom !== Infinity, null, { timeout: 10000 }).catch(() => {});
    const loadShift = (await page.evaluate(SHIFTS)).counted;
    const heights = await page.evaluate(() => ({ first: window.__lmi.firstHeight ?? null, settled: document.documentElement.scrollHeight }));

    // Read top to bottom at reading speed.
    await page.evaluate(() => window.scrollTo(0, 0));
    for (let i = 0; i < 400; i++) {
      const done = await page.evaluate((step) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (window.scrollY >= max - 1) return true;
        window.scrollBy(0, step);
        return false;
      }, opts.scrollStep);
      if (done) break;
      await sleep(opts.scrollInterval);
    }
    await sleep(500);
    const { counted: totalShift, navigation: navigationShift } = await page.evaluate(SHIFTS);

    // Each instance: into view, rendered, stable for 500 ms.
    const instances = [];
    for (const slot of slots) {
      await page.evaluate((i) => document.querySelectorAll("[data-mdx-interactive]")[i]?.scrollIntoView({ block: "start" }), slot.index);
      await page.evaluate(() => document.fonts.ready.then(() => true));
      let last = null, stableSince = Date.now(), state = null;
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        state = await page.evaluate(slotState, slot.index);
        if (state.missing || state.error) break;
        const key = `${state.height}|${state.placeholder}|${state.snapshot}`;
        if (key !== last) { last = key; stableSince = Date.now(); }
        else if (!state.placeholder && Date.now() - stableSince >= 500) break;
        await sleep(100);
      }
      const reservedFromSlot = slot.slotProps ? slot.slotProps[cfg.key] : null;
      const reserved = slot.placeholderHeight != null ? Math.round(slot.placeholderHeight * 100) / 100 : reservedFromSlot;
      const rendered = state && !state.missing && !state.error && !state.placeholder ? Math.round(state.height) : null;
      const delta = rendered != null && reserved != null ? Math.round(rendered - reserved) : null;
      const footprintAfter = rendered != null && state.footprint != null ? Math.round(state.footprint) : null;
      const footprintBefore = slot.footprintBefore != null ? Math.round(slot.footprintBefore) : null;
      const footprintDelta = footprintAfter != null && footprintBefore != null ? footprintAfter - footprintBefore : null;
      instances.push({
        lesson,
        index: slot.index,
        component: slot.name,
        props: slot.props,
        propsFrom: slot.propsFrom,
        band,
        reserved: reserved == null ? null : Math.round(reserved),
        reservedSeen: slot.placeholderHeight != null,
        reservedConfigured: reservedFromSlot,
        rendered,
        delta,
        footprintBefore,
        footprintAfter,
        footprintDelta,
        marginDelta: footprintDelta != null && delta != null ? footprintDelta - delta : null,
        state: state ? (state.missing ? "missing" : state.error ? "error" : state.placeholder ? "placeholder" : "rendered") : "unknown",
      });
    }
    const sumAbsDelta = instances.reduce((sum, i) => sum + Math.abs(i.delta ?? 0), 0);
    return { lesson, band, instances, layoutShift: { sumAbsDelta, load: round4(loadShift), total: round4(totalShift), navigation: round4(navigationShift), pageHeightAtFirstPaint: heights.first, pageHeightSettled: heights.settled, pageHeightChange: heights.first == null ? null : heights.settled - heights.first }, errors };
  } finally {
    await context.close().catch(() => {});
  }
}

const round4 = (n) => Math.round(n * 10000) / 10000;

// ---------------------------------------------------------------- main

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let chromium;
  try { ({ chromium } = require("playwright")); } catch { console.error("playwright not found: run with NODE_PATH=<repo>/node_modules"); process.exit(2); }
  const registry = loadRegistry();
  const lessons = selectLessons(opts);
  const jobs = [];
  for (const lesson of lessons) for (const band of opts.bands) jobs.push({ lesson, band });
  console.log(`measuring ${lessons.length} lessons x ${opts.bands.length} bands (${jobs.length} pages) against ${opts.base}, tolerance ${opts.tolerance}px, concurrency ${opts.concurrency}`);

  const browser = await chromium.launch();
  const pages = [];
  const failedPages = [];
  let next = 0, done = 0;
  const started = Date.now();
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      let result = null, lastError = null;
      for (let attempt = 1; attempt <= 2 && !result; attempt++) {
        try { result = await measurePage(browser, opts, job.lesson, job.band); }
        catch (e) { lastError = String(e && e.message ? e.message : e).split("\n")[0].slice(0, 300); if (attempt === 1) console.log(`  retry ${job.band} ${job.lesson}: ${lastError}`); }
      }
      done++;
      const tag = `[${done}/${jobs.length} ${Math.round((Date.now() - started) / 1000)}s]`;
      if (!result) { failedPages.push({ ...job, error: lastError }); console.log(`${tag} FAILED ${job.band} ${job.lesson}: ${lastError}`); continue; }
      for (const inst of result.instances) {
        const src = inst.props ? reservedSource(registry, inst.component, inst.props, inst.band) : { source: "unknown" };
        inst.reservedSource = src.source;
        if (src.variant !== undefined) inst.variant = src.variant;
        inst.over = inst.delta == null ? inst.state !== "rendered" : Math.abs(inst.delta) > opts.tolerance;
      }
      pages.push(result);
      const over = result.instances.filter((i) => i.over).length;
      console.log(`${tag} ${job.band.padEnd(7)} ${job.lesson}: ${result.instances.length} instances, ${over} over, CLS ${result.layoutShift.total}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency, jobs.length) }, worker));
  await browser.close();

  const order = (a, b) => a.lesson.localeCompare(b.lesson) || a.index - b.index || opts.bands.indexOf(a.band) - opts.bands.indexOf(b.band);
  const instances = pages.flatMap((p) => p.instances).sort(order);
  const exceeding = instances.filter((i) => i.over);

  // Per component: each distinct props signature, its heights per band, and where it occurs.
  const components = {};
  for (const inst of instances) {
    const comp = (components[inst.component] ??= { component: inst.component, instances: 0, signatures: {} });
    const signature = stableStringify(inst.props || {});
    const sig = (comp.signatures[signature] ??= { signature, props: inst.props, rendered: {}, reserved: {}, delta: {}, lessons: [] });
    (sig.rendered[inst.band] ??= []).push(inst.rendered);
    (sig.reserved[inst.band] ??= []).push(inst.reserved);
    (sig.delta[inst.band] ??= []).push(inst.delta);
    if (!sig.lessons.includes(inst.lesson)) sig.lessons.push(inst.lesson);
  }
  const instanceKeys = new Set();
  for (const inst of instances) if (!instanceKeys.has(`${inst.lesson}#${inst.index}`)) { instanceKeys.add(`${inst.lesson}#${inst.index}`); components[inst.component].instances++; }
  const componentSummary = Object.values(components)
    .sort((a, b) => a.component.localeCompare(b.component))
    .map((c) => ({ ...c, signatures: Object.values(c.signatures) }));

  // Ranked by how far the content moves (sum of |delta|), then by the page height change; CLS is secondary (see the header).
  const layoutShift = pages
    .map((p) => ({ lesson: p.lesson, band: p.band, ...p.layoutShift }))
    .sort((a, b) => b.sumAbsDelta - a.sumAbsDelta || Math.abs(b.pageHeightChange ?? 0) - Math.abs(a.pageHeightChange ?? 0) || b.total - a.total);
  const marginMismatches = instances.filter((i) => i.marginDelta != null && Math.abs(i.marginDelta) > opts.tolerance);
  const output = {
    measuredAt: new Date().toISOString(),
    base: opts.base,
    tolerance: opts.tolerance,
    bands: Object.fromEntries(opts.bands.map((b) => [b, { ...BANDS[b].viewport, deviceScaleFactor: BANDS[b].deviceScaleFactor, isMobile: BANDS[b].isMobile, hasTouch: BANDS[b].hasTouch, registryKey: BANDS[b].key }])),
    lessons: lessons.length,
    pages: pages.length,
    failedPages,
    instances,
    components: componentSummary,
    exceeding,
    marginMismatches,
    layoutShift,
    pageErrors: pages.filter((p) => p.errors.length).map((p) => ({ lesson: p.lesson, band: p.band, errors: p.errors })),
  };
  if (opts.out) { fs.mkdirSync(path.dirname(opts.out), { recursive: true }); fs.writeFileSync(opts.out, JSON.stringify(output, null, 1)); }

  // Short table of the instances over tolerance.
  const rows = exceeding.slice().sort((a, b) => Math.abs(b.delta ?? 1e9) - Math.abs(a.delta ?? 1e9));
  console.log("");
  console.log(`${instances.length} instance measurements on ${pages.length} pages; ${exceeding.length} over ${opts.tolerance}px; ${failedPages.length} pages failed`);
  for (const band of opts.bands) console.log(`  ${band}: ${exceeding.filter((i) => i.band === band).length} over of ${instances.filter((i) => i.band === band).length}`);
  if (rows.length) {
    console.log("");
    console.log(`${"delta".padStart(6)} ${"reserved".padStart(8)} ${"rendered".padStart(8)}  ${"band".padEnd(7)} ${"source".padEnd(8)} component @ lesson#index`);
    for (const r of rows.slice(0, 60)) console.log(`${String(r.delta ?? r.state).padStart(6)} ${String(r.reserved).padStart(8)} ${String(r.rendered).padStart(8)}  ${r.band.padEnd(7)} ${String(r.reservedSource).padEnd(8)} ${r.component} @ ${r.lesson}#${r.index}`);
    if (rows.length > 60) console.log(`  ... and ${rows.length - 60} more${opts.out ? ` (see ${opts.out})` : ""}`);
  }
  console.log("");
  console.log("pages that move most (sum of |delta| px, page height change px, CLS):");
  for (const p of layoutShift.slice(0, 10)) console.log(`  ${String(p.sumAbsDelta).padStart(6)} ${String(p.pageHeightChange).padStart(6)} ${String(p.total).padStart(7)}  ${p.band.padEnd(7)} ${p.lesson}`);
  if (marginMismatches.length) {
    console.log("");
    console.log(`${marginMismatches.length} instances whose footprint moves by more than ${opts.tolerance}px apart from their delta (outer margin differs from the placeholder's):`);
    for (const r of marginMismatches.slice(0, 20)) console.log(`  margin ${String(r.marginDelta).padStart(4)} delta ${String(r.delta).padStart(5)}  ${r.band.padEnd(7)} ${r.component} @ ${r.lesson}#${r.index}`);
  }
  if (opts.out) console.log(`\nwrote ${opts.out}`);
  process.exit(exceeding.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
