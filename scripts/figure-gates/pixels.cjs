"use strict";

const sharp = require("sharp");
const DPR = 2;
const linear = Array.from({ length: 256 }, (_, v) =>
  v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4,
);
const lum = (r, g, b) =>
  0.2126 * linear[Math.round(r)] +
  0.7152 * linear[Math.round(g)] +
  0.0722 * linear[Math.round(b)];
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// Run inside the page. Retain glyph bounds, actual CTM and per-element sample
// points. The two swatches of a legend are two marks even if their CSS matches.
function collectRegions(rows) {
  const regions = [];
  document
    .querySelectorAll("[data-gate-region]")
    .forEach((e) => e.removeAttribute("data-gate-region"));
  for (const [index, row] of rows.entries()) {
    if (row.domIndex == null || row.controlOnly) continue;
    const root = document.querySelector(`[data-gate-item="${row.domIndex}"]`);
    const regionsForRow = [];
    if (!root.matches("[data-mdx-interactive]")) {
      if (root.matches("svg,[data-diagram]")) regionsForRow.push(root);
      else regionsForRow.push(...root.querySelectorAll("svg"));
    } else {
      for (const el of root.querySelectorAll(
        "figure,svg,.fig-stage,.fig-titlebar,.fig-legend,.fig-chip,[aria-roledescription=slide],ol,table,[role=img],[class*='fig-'],[style*='--fig-']",
      )) {
        if (
          (el.closest("svg") && el.tagName !== "svg") ||
          el.closest("button,input,pre,code,fieldset,[role=tablist]") ||
          el.matches(".lucide,.fig-panel:not(figure)")
        )
          continue;
        if (
          el.matches("ol,table") &&
          !el.querySelector("[class*='fig-'],[style*='--fig-']")
        )
          continue;
        if (
          el.matches("figure") &&
          !el.querySelector("svg,[class*='fig-'],[style*='--fig-']")
        )
          continue;
        // A labelled HTML plate/trace can have its label beside the paint.
        let block =
          el.matches("span,div") && !el.textContent.trim()
            ? el.parentElement
            : el;
        // A trace or arrowhead may deliberately extend below the label box.
        const painted = el.getBoundingClientRect();
        while (block !== root && block.parentElement !== root) {
          const b = block.getBoundingClientRect();
          if (
            painted.top >= b.top &&
            painted.bottom <= b.bottom &&
            painted.left >= b.left &&
            painted.right <= b.right
          )
            break;
          block = block.parentElement;
        }
        if (regionsForRow.some((r) => r.contains(block))) continue;
        regionsForRow.push(block);
      }
    }
    for (const region of regionsForRow.filter(
      (r, i, list) => !list.some((s, j) => i !== j && s !== r && s.contains(r)),
    )) {
      for (const chip of region.querySelectorAll(".fig-chip")) {
        const rect = chip.getBoundingClientRect();
        if (
          !rect.width ||
          !rect.height ||
          getComputedStyle(chip).visibility !== "visible"
        )
          continue;
        chip.setAttribute("data-gate-region", String(regions.length));
        regions.push({
          id: regions.length,
          index,
          line: row.line,
          name: row.name,
          kit: !!chip.closest("[data-figure-kit],[data-diagram]"),
        });
      }
      const rect = region.getBoundingClientRect();
      if (
        !rect.width ||
        !rect.height ||
        getComputedStyle(region).visibility !== "visible"
      )
        continue;
      const id = regions.length;
      region.setAttribute("data-gate-region", String(id));
      regions.push({
        id,
        index,
        line: row.line,
        kit: ["architecture", "sequence", "timing"].includes(row.key),
        name: row.name,
      });
    }
  }
  return regions;
}
function readInk(root) {
  const rect = root.getBoundingClientRect();
  // Playwright encloses the element's document rect in whole CSS pixels.
  const box = {
    x: Math.floor(rect.x + scrollX) - scrollX,
    y: Math.floor(rect.y + scrollY) - scrollY,
  };
  const texts = [],
    marks = [];
  const cssColor = (value) => {
    const ctx = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data);
  };
  const visible = (e) => {
    if (e.closest("defs,marker,pattern,clipPath,mask,.sr-only,[hidden]"))
      return false;
    for (let el = e; el; el = el.parentElement) {
      const c = getComputedStyle(el);
      if (
        c.display === "none" ||
        c.visibility === "hidden" ||
        Number(c.opacity) === 0 ||
        el.classList.contains("invisible")
      )
        return false;
      if (el === root) break;
    }
    return true;
  };
  function alpha(e) {
    let a = 1;
    for (let n = e; n; n = n.parentElement)
      a *= Number(getComputedStyle(n).opacity);
    return a;
  }
  const tree = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (tree.nextNode()) {
    const n = tree.currentNode,
      e = n.parentElement,
      s = n.textContent.trim();
    if (
      !s ||
      !visible(e) ||
      e.closest("[data-gate-region]") !== root ||
      e.closest(
        "title,desc,style,script,option,:disabled,[aria-disabled=true],[data-taken=false],button,input,fieldset,[role=tablist]",
      )
    )
      continue;
    const svg = e instanceof SVGElement;
    if (svg && !e.closest("text")) continue;
    if (e.closest("[data-gate-region]") !== root) continue;
    const c = getComputedStyle(e);
    const range = new Range();
    range.selectNodeContents(n);
    const borderBox = e.getBoundingClientRect();
    const inset = (side) => parseFloat(c[`border${side}Width`]) || 0;
    const rects = [...range.getClientRects()]
      .map((r) => {
        if (svg) return r;
        const left = Math.max(r.x, borderBox.left + inset("Left"));
        const top = Math.max(r.y, borderBox.top + inset("Top"));
        const right = Math.min(r.right, borderBox.right - inset("Right"));
        const bottom = Math.min(r.bottom, borderBox.bottom - inset("Bottom"));
        return { x: left, y: top, width: right - left, height: bottom - top };
      })
      .filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) continue;
    const m = svg ? e.getScreenCTM() : null;
    const rgba = cssColor(svg ? c.fill : c.color);
    if (!rgba[3] || (svg && Number(c.fillOpacity) === 0)) continue;
    e.setAttribute("data-gate-text", "");
    texts.push({
      s,
      kit: !!e.closest("[data-figure-kit]"),
      rgba,
      opacity: alpha(e) * (svg ? Number(c.fillOpacity) : 1),
      size: parseFloat(c.fontSize) * (m ? Math.hypot(m.c, m.d) : 1),
      rects: rects.map((r) => [r.x - box.x, r.y - box.y, r.width, r.height]),
    });
  }
  const layers = [];
  const faceSelector =
    "polygon.fig-face-top,polygon.fig-face-left,polygon.fig-face-right";
  const seenSolids = new Set();
  for (const e of [root, ...root.querySelectorAll("*")]) {
    if (
      !visible(e) ||
      e.closest("[data-gate-region]") !== root ||
      e.closest(
        ".fig-fx,defs,marker,pattern,clipPath,mask,.lucide,button,input,fieldset,[role=tablist]",
      )
    )
      continue;
    const c = getComputedStyle(e);
    let rect = e.getBoundingClientRect();
    const cls = e.getAttribute("class") || "";
    let pts = [],
      kind,
      members = [e];
    const kitElement = e.closest("[data-figure-kit],[data-diagram]");
    if (e.matches("polygon") && seenSolids.has(e.parentElement)) continue;
    if (e.matches(faceSelector) && !kitElement) {
      const parent = e.parentElement;
      members = [
        ...parent.querySelectorAll(`:scope > :is(${faceSelector})`),
      ].filter(visible);
      if (seenSolids.has(parent)) continue;
      seenSolids.add(parent);
      // Only the silhouette has exterior pixels. Internal seams are shading.
      const faces = members.map((face) => ({
        face,
        screen: face.getScreenCTM(),
        inverse: face.getScreenCTM().inverse(),
      }));
      const inside = (p) =>
        faces.some(({ face, inverse }) =>
          face.isPointInFill(p.matrixTransform(inverse)),
        );
      for (const { face, screen } of faces) {
        const length = face.getTotalLength();
        for (let n = 1; n < 96; n++) {
          const distance = (length * n) / 96;
          const p = face.getPointAtLength(distance).matrixTransform(screen);
          const q = face
            .getPointAtLength(distance + 0.04)
            .matrixTransform(screen);
          const norm = Math.hypot(q.x - p.x, q.y - p.y);
          if (!norm) continue;
          const dx = (q.y - p.y) / norm,
            dy = (p.x - q.x) / norm;
          if (
            inside(new DOMPoint(p.x + dx, p.y + dy)) &&
            inside(new DOMPoint(p.x - dx, p.y - dy))
          )
            continue;
          pts.push([p.x - box.x, p.y - box.y]);
        }
      }
      members.push(
        ...parent.querySelectorAll(
          ':scope > polygon.fill-card, :scope > polygon[fill^="url(#"]',
        ),
      );
      kind = "solid-outline";
      rect = parent.getBoundingClientRect();
    } else if (e instanceof SVGGeometryElement) {
      // DESIGN section 14 explicitly classifies label-pill outlines and
      // non-cursor edge guides as decoration. Their text is measured above.
      const kit = e.closest("[data-diagram]");
      const labelPill =
        kit &&
        e.localName === "rect" &&
        e.parentElement.parentElement.querySelector(":scope > polyline") &&
        e.parentElement.querySelector(":scope > text");
      const guide =
        kit &&
        e.localName === "line" &&
        e.classList.contains("stroke-muted-foreground/25");
      if (labelPill || guide || (!kitElement && e.matches(".fig-band")))
        continue;
      const paintServer = e.getAttribute("fill")?.match(/^url\(#(.+)\)$/);
      const hatch =
        paintServer &&
        document.getElementById(paintServer[1])?.localName === "pattern";
      const stroke =
        c.stroke !== "none" &&
        parseFloat(c.strokeWidth) > 0 &&
        parseFloat(c.strokeOpacity) > 0;
      const solid =
        (e.classList.contains("fig-solid") && !stroke) ||
        (!stroke &&
          c.fill !== "none" &&
          /(fill-fig-)/.test(cls) &&
          !/(-fill|-body)\b/.test(cls));
      if (!stroke && !solid && !hatch) continue;
      const m = e.getScreenCTM(),
        b = e.getBBox(),
        len = e.getTotalLength();
      if (!len) continue;
      if (solid || hatch) {
        kind = hatch ? "hatch" : "solid";
        const subdivisions = hatch ? 16 : 5;
        for (let x = 1; x <= subdivisions; x++)
          for (let y = 1; y <= subdivisions; y++) {
            const p = new DOMPoint(
              b.x + (b.width * x) / (subdivisions + 1),
              b.y + (b.height * y) / (subdivisions + 1),
            );
            if (e.isPointInFill(p)) pts.push(p);
          }
      }
      if (!pts.length) {
        kind = "stroke";
        const count = Math.min(420, Math.max(16, Math.ceil(len / 1.5)));
        for (let i = 0; i < count; i++)
          pts.push(e.getPointAtLength(((i + 0.5) * len) / count));
      }
      pts = pts.map((p) => {
        const q = p.matrixTransform(m);
        return [q.x - box.x, q.y - box.y];
      });
    } else {
      if (!rect.width || !rect.height) continue;
      if (!kitElement && /--fig-well|fig-well/.test(cls)) continue;
      const border = /border-(?:[lrtb]-)?fig-|border[^ ]*--fig-/.test(cls);
      const solid =
        (/bg-fig-(?!\w+-(?:body|fill))/.test(cls) && !e.textContent.trim()) ||
        e.matches(".fig-solid");
      if (!border && !solid) continue;
      kind = solid ? "css-solid" : "css-border";
      for (let k = 2; k <= 8; k++) {
        const x = rect.x + (rect.width * k) / 10 - box.x,
          y = rect.y + (rect.height * k) / 10 - box.y;
        if (solid) pts.push([x, rect.y + rect.height / 2 - box.y]);
        else {
          if (parseFloat(c.borderTopWidth))
            pts.push([x, rect.y + parseFloat(c.borderTopWidth) / 2 - box.y]);
          if (parseFloat(c.borderLeftWidth))
            pts.push([rect.x + parseFloat(c.borderLeftWidth) / 2 - box.x, y]);
          if (parseFloat(c.borderBottomWidth))
            pts.push([
              x,
              rect.bottom - parseFloat(c.borderBottomWidth) / 2 - box.y,
            ]);
          if (parseFloat(c.borderRightWidth))
            pts.push([
              rect.right - parseFloat(c.borderRightWidth) / 2 - box.x,
              y,
            ]);
        }
      }
    }
    if (!pts.length) continue;
    // Hide disjoint marks together. The background photograph must retain
    // every overlapping object, especially the plate underneath a hatch.
    const bounds = [
      rect.left - 3,
      rect.top - 3,
      rect.right + 3,
      rect.bottom + 3,
    ];
    let layer = layers.findIndex((group) =>
      group.every(
        ([l, t, r, b]) =>
          r < bounds[0] || b < bounds[1] || l > bounds[2] || t > bounds[3],
      ),
    );
    if (layer < 0) {
      layer = layers.length;
      layers.push([]);
    }
    layers[layer].push(bounds);
    for (const member of members) {
      member.setAttribute("data-gate-layer", String(layer));
      member.setAttribute("data-gate-mark", kind);
    }
    marks.push({
      kind,
      layer,
      kit: !!kitElement,
      label: [e.tagName, cls, e.getAttribute("data-testid")]
        .filter(Boolean)
        .join(" "),
      pts,
    });
  }
  return { texts, marks };
}
const hiddenText =
  "[data-gate-text]{-webkit-text-fill-color:transparent!important;text-shadow:none!important} svg [data-gate-text]{fill:transparent!important;stroke:transparent!important}";
const hiddenMark =
  "[data-gate-mark=stroke]{stroke:transparent!important}[data-gate-mark=solid-outline],[data-gate-mark=solid]{stroke:transparent!important;fill:transparent!important}[data-gate-mark=hatch]{fill:transparent!important}[data-gate-mark=css-solid]{background:transparent!important}[data-gate-mark=css-border]{border-color:transparent!important}";

async function sampleRegion(locator) {
  await locator.scrollIntoViewIfNeeded();
  const data = await locator.evaluate(readInk);
  // Screenshots of the same element have identical origin even far below the
  // fold. Scroll wide kit stages to include both ends of the actual drawing.
  const scrollers = locator.locator(".fig-stage");
  const scroll = await scrollers.evaluateAll((es) =>
    es
      .filter((e) => e.scrollWidth > e.clientWidth + 1)
      .map((e) => ({
        max: e.scrollWidth - e.clientWidth,
        step: e.clientWidth,
      })),
  );
  const max = Math.max(0, ...scroll.map((e) => e.max));
  const step = Math.max(1, Math.min(...scroll.map((e) => e.step)));
  const offsets = [0];
  while (offsets.at(-1) < max)
    offsets.push(Math.min(max, offsets.at(-1) + step));
  const tr = data.texts.map(() => Infinity),
    mr = data.marks.map(() => []);
  for (const offset of offsets) {
    await scrollers.evaluateAll(
      (es, x) =>
        es.forEach((e) => {
          e.scrollLeft = x;
        }),
      offset,
    );
    const geometry = offset ? await locator.evaluate(readInk) : data;
    const shot = async (style) => {
      const tag = style
        ? await locator.page().addStyleTag({ content: style })
        : null;
      try {
        return await sharp(
          await locator.screenshot({ animations: "disabled", timeout: 45000 }),
        )
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
      } finally {
        if (tag) await tag.evaluate((e) => e.remove());
      }
    };
    const actual = await shot();
    const bgText = data.texts.length ? await shot(hiddenText) : actual;

    const w = actual.info.width,
      h = actual.info.height;
    if ([bgText].some((im) => im.info.width !== w || im.info.height !== h))
      throw Error("Visual resized during pixel capture");
    const pixel = (x, y) => 3 * (Math.round(y) * w + Math.round(x));
    const valid = (x, y) =>
      x >= 0 && y >= 0 && Math.round(x) < w && Math.round(y) < h;
    const l = (buf, k) => lum(buf[k], buf[k + 1], buf[k + 2]);
    for (const [i, t] of geometry.texts.entries()) {
      const bg = bgText.data,
        a = (t.opacity * t.rgba[3]) / 255;
      let fallback = Infinity,
        painted = Infinity;
      for (const [rx, ry, rw, rh] of t.rects) {
        for (
          let y = Math.max(0, Math.ceil(ry * DPR));
          y < Math.min(h, (ry + rh) * DPR);
          y++
        )
          for (
            let x = Math.max(0, Math.ceil(rx * DPR));
            x < Math.min(w, (rx + rw) * DPR);
            x++
          ) {
            const k = pixel(x, y);
            const ink = t.rgba
              .slice(0, 3)
              .map((v, j) => a * v + (1 - a) * bg[k + j]);
            const cr = contrast(l(bg, k), lum(...ink));
            fallback = Math.min(fallback, cr);
            // A bounding box also contains neighbouring rules and glyphs.
            // Match the pixel to an antialiased blend of this label's ink.
            const delta = ink.map((value, j) => value - bg[k + j]);
            const change = delta.map((_, j) => actual.data[k + j] - bg[k + j]);
            const norm = delta.reduce((sum, value) => sum + value * value, 0);
            const cover =
              change.reduce((sum, value, j) => sum + value * delta[j], 0) /
              norm;
            if (
              cover > 0.35 &&
              cover < 1.12 &&
              change.every((value, j) => Math.abs(value - cover * delta[j]) < 5)
            )
              painted = Math.min(painted, cr);
          }
      }
      tr[i] = Math.min(tr[i], Number.isFinite(painted) ? painted : fallback);
    }
    for (const layer of new Set(geometry.marks.map((m) => m.layer))) {
      const rule = hiddenMark.replaceAll(
        "[data-gate-mark",
        `[data-gate-layer="${layer}"][data-gate-mark`,
      );
      const bgMark = await shot(rule);
      if (bgMark.info.width !== w || bgMark.info.height !== h)
        throw Error("Mark resized during pixel capture");
      for (const [i, m] of geometry.marks.entries()) {
        if (m.layer !== layer) continue;
        for (const [x, y] of m.pts) {
          if (!valid(x * DPR, y * DPR)) continue;
          let best = 1;
          for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++) {
              const xx = Math.round(x * DPR) + dx,
                yy = Math.round(y * DPR) + dy;
              if (!valid(xx, yy)) continue;
              const k = pixel(xx, yy);
              best = Math.max(
                best,
                contrast(l(actual.data, k), l(bgMark.data, k)),
              );
            }
          mr[i].push(best);
        }
      }
    }
  }
  await scrollers.evaluateAll((es) =>
    es.forEach((e) => {
      e.scrollLeft = 0;
    }),
  );
  await locator.evaluate((e) => {
    for (const n of [
      e,
      ...e.querySelectorAll("[data-gate-text],[data-gate-mark]"),
    ]) {
      n.removeAttribute("data-gate-text");
      n.removeAttribute("data-gate-mark");
      n.removeAttribute("data-gate-layer");
    }
  });
  return {
    texts: data.texts.map((t, i) => ({
      label: t.s,
      kit: t.kit,
      size: t.size,
      ratio: Number.isFinite(tr[i]) ? tr[i] : null,
    })),
    marks: data.marks.map((m, i) => {
      const visiblePoints =
        m.kind === "solid-outline"
          ? mr[i].filter((ratio) => ratio > 1.03)
          : mr[i];
      const rs = (visiblePoints.length ? visiblePoints : mr[i]).sort(
        (a, b) => a - b,
      );
      return {
        label: m.label,
        kit: m.kit,
        ratio:
          rs[
            Math.floor(
              rs.length *
                (m.kind === "solid" || m.kind === "css-solid" ? 0.5 : 0.75),
            )
          ] ?? null,
      };
    }),
  };
}
async function measure(page, rows) {
  // Sticky site navigation occludes pixels when Playwright scrolls its crop
  // into view. Isolate the artwork without changing document flow or theme.
  await page.evaluate(() => {
    for (const e of document.querySelectorAll("body *")) {
      if (
        e.closest("[data-lesson-article]") ||
        e.querySelector("[data-lesson-article]")
      )
        continue;
      if (["sticky", "fixed"].includes(getComputedStyle(e).position))
        e.setAttribute("data-gate-overlay", "");
    }
  });
  const overlay = await page.addStyleTag({
    content: "[data-gate-overlay]{visibility:hidden!important}",
  });
  const regions = await page.evaluate(collectRegions, rows);
  const out = [];
  for (const r of regions) {
    const el = page.locator(`[data-gate-region="${r.id}"]`);
    const samples = await sampleRegion(el);
    out.push({ ...r, ...samples });
  }
  await overlay.evaluate((e) => e.remove());
  return out;
}
module.exports = { measure, collectRegions };
