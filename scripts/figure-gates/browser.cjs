"use strict";

const { chromium } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");
const { literalColours } = require("./source.cjs");
const { measure, collectRegions } = require("./pixels.cjs");

const article = "[data-lesson-article]";
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  });
}
async function openDetails(page) {
  await page.locator(article + " details").evaluateAll((nodes) =>
    nodes.forEach((el) => {
      el.open = true;
    }),
  );
  await settle(page);
}

// One entry per embed and per independent drawing. Inner SVG glyphs are parts
// of their containing figure. Only UI icons and code samples are ignored.
function inventory() {
  const root = document.querySelector("[data-lesson-article]");
  const candidates = root.querySelectorAll(
    "[data-mdx-interactive], figure, svg, img, picture, canvas, video, object, iframe, [role=img]",
  );
  const found = [];
  for (const e of candidates) {
    if (e.closest("pre,code") || found.some((row) => row.element.contains(e)))
      continue;
    if (
      e.matches("svg") &&
      (e.matches(".lucide, .recharts-surface[aria-hidden=true]") ||
        (e.closest("a,button") &&
          !e.hasAttribute("viewBox") &&
          !e.hasAttribute("role")))
    )
      continue;
    const slot = e.getAttribute("data-mdx-interactive");
    const diagram = e.getAttribute("data-diagram");
    const drawing = e.matches("svg") || !!e.querySelector("svg:not(.lucide)");
    const key = slot || diagram || (drawing ? "drawing" : "picture");
    const tokens =
      '[class*="-fig-"],[class~="fig-well"],[class~="fig-solid"],[style*="--fig-"]';
    const stage =
      ".fig-stage, .fig-well, [class*='--fig-well'], [style*='--fig-well']";
    // A new kit diagram nested in an old interactive does not restyle its
    // containing instrument. Inspect the actual mounted component frame.
    let frame = e.firstElementChild;
    while (frame && getComputedStyle(frame).display === "contents")
      frame = frame.firstElementChild;
    const panel = slot
      ? !!frame?.matches(".fig-panel")
      : e.matches(".fig-panel") ||
        !!e.querySelector(".fig-panel") ||
        !!e.closest(".fig-panel");
    const recap = e.closest('section.glass-liquid[aria-label^="Visual recap"]');
    const parts = [e, ...e.querySelectorAll("*")];
    // Browser style serialization resolves literal rgb() values in inline
    // style, but retains var() paints. Ignore a fragment URL or unrelated attrs.
    const paint = parts
      .flatMap((el) =>
        [...el.attributes]
          .filter((a) =>
            /^(class|style|fill|stroke|color|stop-color|flood-color|bgcolor)$/.test(
              a.name,
            ),
          )
          .map((a) => a.value),
      )
      .join("\n");
    const hasTokens = e.matches(tokens) || !!e.querySelector(tokens);
    const compositions =
      !slot && !diagram && drawing
        ? (e.matches("svg") ? [e] : [...e.querySelectorAll("svg")]).filter(
            (svg) =>
              !svg.closest(".fig-legend") &&
              (svg.getAttribute("aria-hidden") !== "true" || svg === e) &&
              svg.getBoundingClientRect().width > 0,
          )
        : [];
    const drawingWords = compositions.map((svg) => ({
      titles: [...svg.querySelectorAll("title")].map((e) =>
        e.textContent.trim(),
      ),
      descriptions: [...svg.querySelectorAll("desc")].map((e) =>
        e.textContent.trim(),
      ),
      words: [...svg.querySelectorAll("text")]
        .flatMap((e) => [e.textContent.trim()])
        .concat(
          [...e.querySelectorAll(".fig-legend .fig-chip")].map((el) =>
            el.textContent.trim(),
          ),
        ),
    }));
    const unstyled = compositions.filter(
      (svg) => !(svg.matches(tokens) || svg.querySelector(tokens)),
    ).length;
    const titleStrip =
      !!e.querySelector(".fig-titlebar") ||
      !compositions.some((svg) => svg.querySelector("title")) ||
      !!recap;
    const hasStage = e.matches(stage) || !!e.querySelector(stage);
    const controlOnly =
      !!slot &&
      !drawing &&
      !hasTokens &&
      !panel &&
      !!e.querySelector("[data-testid=interview-playground]");
    const name =
      slot ||
      e.querySelector("svg title, title")?.textContent ||
      e.getAttribute("aria-label") ||
      e.getAttribute("alt") ||
      e.querySelector("figcaption")?.textContent ||
      e.tagName;
    e.setAttribute("data-gate-item", String(found.length));
    found.push({
      element: e,
      key,
      name,
      panel,
      hasStage,
      hasTokens,
      drawingWords,
      unstyled,
      titleStrip,
      recap: !!recap,
      controlOnly,
      paint,
      box: e.getBoundingClientRect().toJSON(),
    });
  }
  return found.map(({ element, box, ...row }) => row);
}
function reconcile(source, dom) {
  const rows = [];
  let pos = 0;
  for (const item of source) {
    if (dom[pos]?.key !== item.key) {
      rows.push({
        name: item.name,
        line: item.line,
        key: item.key,
        look: "old",
        reason:
          "Source visual has no matching rendered instance at this position",
      });
      continue;
    }
    const { paint, drawingWords, ...el } = dom[pos++];
    const sameWords = (a, b) =>
      a.join(" ").replace(/\s+/g, " ").trim() ===
      b.join(" ").replace(/\s+/g, " ").trim();
    const stale =
      item.kind === "drawing" &&
      (!drawingWords.length ||
        drawingWords.some(
          (d) =>
            !item.words.versions.some(
              (v) =>
                sameWords(d.titles, v.titles.flat()) &&
                sameWords(d.descriptions, v.descriptions.flat()) &&
                sameWords(d.words, v.words),
            ),
        ));
    const colours = literalColours(paint).map((c) => c.token);
    const kit = item.kind === "kit";
    const stage =
      el.hasStage || el.recap || (item.kind === "interactive" && el.hasTokens);
    const styled =
      (el.panel || el.recap) &&
      stage &&
      el.hasTokens &&
      !el.unstyled &&
      el.titleStrip;
    rows.push({
      ...el,
      name: item.name,
      line: item.line,
      domIndex: pos - 1,
      stale,
      colours: [...new Set(colours)],
      kitColours: kit ? [...new Set(colours)] : [],
      look: el.controlOnly
        ? "controls only"
        : (styled || kit) && !stale
          ? "new look"
          : "old",
    });
  }
  for (; pos < dom.length; pos++)
    rows.push({
      name: dom[pos].name,
      key: dom[pos].key,
      domIndex: pos,
      look: "old",
      reason: "Rendered visual absent from source inventory",
    });
  return rows;
}
async function scrollLesson(page) {
  return page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto";
    const maxOverflow = () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth;
    let overflow = maxOverflow();
    window.scrollTo(0, 0);
    for (
      let y = 0;
      y < document.documentElement.scrollHeight;
      y += Math.max(1, window.innerHeight - 60)
    ) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(r));
      overflow = Math.max(overflow, maxOverflow());
    }
    window.scrollTo(0, 0);
    return overflow;
  });
}
async function captureArt(page, rows, dir, theme) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, row] of rows.entries()) {
    if (row.controlOnly || row.domIndex == null) continue;
    const node = page.locator(`[data-gate-item="${row.domIndex}"]`);
    const box = await node.boundingBox();
    const target = box?.height
      ? node
      : node.locator(":scope > :visible").first();
    await target.screenshot({
      path: path.join(dir, `${String(i + 1).padStart(2, "0")}-${theme}.png`),
      animations: "disabled",
      timeout: 30000,
    });
  }
}
// A learner must reveal a prediction before its plot exists. Capture the
// default words first, then open each available answer and nested disclosure.
async function reveal(page) {
  const answers = page
    .locator(article + " [data-mdx-interactive]")
    .getByRole("button", {
      name: /reveal without predicting|reveal (?:the )?answer|show without predicting/i,
    });
  for (const button of await answers.elementHandles())
    if ((await button.isVisible()) && (await button.isEnabled()))
      await button.click();
  await openDetails(page);
}
// Snapshot figure names and descriptions as well as innerText (which omits
// SVG text). Hydration-generated id values compare by their referenced text.
function interactiveWords() {
  const normalized = (s) => s.replace(/\s+/g, " ").trim();
  return [
    ...document.querySelectorAll(
      "[data-lesson-article] [data-mdx-interactive]",
    ),
  ].map((slot) => {
    const strings = [],
      aria = [];
    for (const el of slot.querySelectorAll("*")) {
      if (
        el.matches("svg text,svg title,svg desc,figcaption") &&
        !el.closest("[data-fig-title]")
      ) {
        strings.push([el.localName, normalized(el.textContent)]);
      }
      const attributes = [];
      for (const a of el.attributes) {
        if (!a.name.startsWith("aria-")) continue;
        // Accessibility-neutral decorations may be added to the painting.
        if (
          a.name === "aria-hidden" &&
          a.value === "true" &&
          (el.closest(".fig-fx") || !el.textContent.trim())
        )
          continue;
        const value =
          /^aria-(labelledby|describedby|controls|owns|details|errormessage|activedescendant)$/.test(
            a.name,
          )
            ? a.value.split(/\s+/).map((id) => {
                const target = document.getElementById(id);
                return target
                  ? [target.localName, normalized(target.textContent)]
                  : ["missing", id];
              })
            : a.value;
        attributes.push([a.name, value]);
      }
      if (attributes.length)
        aria.push(attributes.sort((a, b) => a[0].localeCompare(b[0])));
    }
    return { name: slot.getAttribute("data-mdx-interactive"), strings, aria };
  });
}

// A closed lesson disclosure may suppress innerText for a display:contents
// slot. Reveal only the enclosing lesson details needed to read the default
// state. Leave the interactive's own controls and disclosures alone.
function openDetailsForEmptyEmbeds(slots) {
  let opened = false;
  for (const slot of slots) {
    if (slot.innerText.trim()) continue;
    for (
      let detail = slot.parentElement?.closest("details:not([open])");
      detail;
      detail = detail.parentElement?.closest("details:not([open])")
    ) {
      detail.open = true;
      opened = true;
    }
  }
  return opened;
}

async function scenario(browser, opts, width, theme) {
  const ctx = await browser.newContext({
    viewport: { width, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: theme,
    reducedMotion: "reduce",
  });
  const errors = [];
  try {
    await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme);
    const page = await ctx.newPage();
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    const response = await page.goto(opts.url + "/curriculum/" + opts.route, {
      waitUntil: "networkidle",
      timeout: 180000,
    });
    if (!response?.ok()) throw Error("Lesson HTTP " + response?.status());
    await page.locator(article).waitFor();
    await page.waitForFunction(
      () =>
        !document.querySelector(
          "[data-interactive-snapshot],[data-interactive-placeholder]",
        ),
      null,
      { timeout: 60000 },
    );
    await settle(page);
    if (
      await page
        .locator("html")
        .evaluate((e, t) => e.getAttribute("data-theme") !== t, theme)
    )
      throw Error("Wrong rendered theme");
    const slots = page.locator(article + " [data-mdx-interactive]");
    if (await slots.evaluateAll(openDetailsForEmptyEmbeds)) await settle(page);
    const texts = await slots.evaluateAll((es) =>
      es.map((e) => ({
        name: e.dataset.mdxInteractive,
        text: e.innerText.replace(/\s+/g, " ").trim(),
      })),
    );
    const defaultWords = await page.evaluate(interactiveWords);
    await openDetails(page);
    const overflow = await scrollLesson(page);
    await reveal(page);
    const revealedWords = await page.evaluate(interactiveWords);
    const dom = await page.evaluate(inventory);
    const staged = await page.evaluate(
      collectRegions,
      dom.map((row, domIndex) => ({ ...row, domIndex })),
    );
    // The shared fidelity badge, prediction controls and the code editor keep
    // the site's UI style. G1 checks paint inside the actual interactive art.
    const paints = await page.evaluate(
      (regions) =>
        regions.map((r) => {
          const el = document.querySelector(`[data-gate-region="${r.id}"]`);
          return [
            r.index,
            [el, ...el.querySelectorAll("*")]
              .flatMap((n) =>
                [...n.attributes]
                  .filter((a) =>
                    /^(class|style|fill|stroke|color|stop-color|flood-color|bgcolor)$/.test(
                      a.name,
                    ),
                  )
                  .map((a) => a.value),
              )
              .join("\n"),
          ];
        }),
      staged,
    );
    const rows = reconcile(
      opts.visuals,
      dom.map((e, i) => ({
        ...e,
        paint:
          e.key === e.name
            ? paints
                .filter(([index]) => index === i)
                .map(([, p]) => p)
                .join("\n")
            : e.paint,
      })),
    );
    for (const row of rows)
      if (row.domIndex != null) {
        const kitPaint = await page
          .locator(`[data-gate-item="${row.domIndex}"] [data-figure-kit]`)
          .evaluateAll((kits) => kits.map((kit) => kit.outerHTML).join("\n"));
        row.kitColours = [
          ...new Set([
            ...(row.kitColours || []),
            ...literalColours(kitPaint).map((c) => c.token),
          ]),
        ];
      }
    if (opts.images && width === 1440)
      await captureArt(page, rows, opts.images, theme);
    let pixels = null,
      measurementError = null;
    if (!opts.capture) {
      try {
        pixels = await measure(page, rows);
      } catch (error) {
        measurementError = error.message;
        pixels = [];
      }
    }
    if (await page.locator("[data-interactive-error]").count())
      errors.push("Interactive rendered its error boundary");
    return {
      width,
      theme,
      rows,
      texts,
      defaultWords,
      revealedWords,
      pixels,
      measurementError,
      overflow: Math.max(overflow, await scrollLesson(page)),
      errors,
    };
  } finally {
    await ctx.close();
  }
}
async function inspectBrowser(opts) {
  const browser = await chromium.launch();
  try {
    const results = [];
    for (const width of opts.capture ? [1440] : [1440, 390]) {
      // Independent contexts keep colours and the opened lesson states isolated.
      results.push(
        ...(await Promise.all(
          ["dark", "light"].map((theme) =>
            scenario(browser, opts, width, theme),
          ),
        )),
      );
    }
    return results;
  } finally {
    await browser.close();
  }
}
module.exports = { inspectBrowser, openDetailsForEmptyEmbeds, reconcile };
