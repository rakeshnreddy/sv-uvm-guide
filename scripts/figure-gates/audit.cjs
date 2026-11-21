"use strict";

const sharp = require("sharp");
const { createConnection } = require("node:net");

const allWidths = [1440, 1280, 768, 390];
const auditGates = ["G11", "G12", "G13", "G14", "G15", "G16", "G17"];

function selectVisuals(visuals, query) {
  if (!query) return visuals.map((_, index) => index);
  const at = query.match(/^(.*)@(\d+)$/);
  const key = at ? at[1] : query;
  const indexes = visuals.flatMap((row, index) =>
    (row.key === key || row.name === key || row.tag === key || (!key && at)) &&
    (!at || row.line === Number(at[2]))
      ? [index]
      : [],
  );
  if (indexes.length !== 1) {
    const choices = indexes.map((index) => visuals[index].line).join(", ");
    throw Error(choices
      ? `Ambiguous visual "${query}". Add @line (${choices}).`
      : `No visual matches "${query}". Use its exact title or component key, optionally with @line.`);
  }
  return indexes;
}

function focalWaiver(report, row, released = false) {
  let heading = "";
  for (const line of report.split("\n")) {
    const section = line.match(/^#+\s+(.*)$/);
    if (section) heading = section[1].trim();
    const declaration = line.match(/^\s*(?:[-*]\s+)?(?:(.*?)\s*(?:—|\|)\s*)?(no focal part|focal part):\s*(\S.*)$/i);
    if (declaration && (released || /^no /i.test(declaration[2])) &&
        [row.name, (row.key || row.name) + "@" + row.line, row.name + "@" + row.line].includes(declaration[1] || heading))
      return declaration[3].trim();
  }
  return null;
}

function artworkDifference(before, after) {
  if (!before || !after) return null;
  if (!after.length) return 0;
  if (!before.length) return 1;
  const diff = (left, right) => {
    if (left.length !== right.length) return 1;
    let changed = 0;
    for (let i = 0; i < left.length; i += 3)
      if (Math.max(...[0, 1, 2].map(channel => Math.abs(left[i + channel] - right[i + channel]))) >= 14)
        changed++;
    return changed * 3 / left.length;
  };
  const original = before.map(image => Buffer.from(image, "base64"));
  const current = after.map(image => Buffer.from(image, "base64"));
  // A new decorative child cannot mask an unchanged main drawing.
  return Math.min(...original.map(image => Math.min(...current.map(other => diff(image, other)))));
}

function requireServer(origin) {
  const url = new URL(origin);
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: url.hostname.replace(/^\[|\]$/g, ""), port: Number(url.port) || (url.protocol === "https:" ? 443 : 80) });
    const failed = () => {
      socket.destroy();
      reject(Error(`Figure gate server is unavailable at ${origin}. Start it or pass a reachable --url.`));
    };
    socket.once("error", failed);
    socket.setTimeout(1500, failed);
    socket.once("connect", () => {
      socket.destroy();
      resolve();
    });
  });
}

// Called inside Chromium. Keep all geometry in CSS pixels, including nested SVGs.
function readVisual(root) {
  const findings = [];
  const note = (gate, label, value, element = root) => findings.push({
    gate, label, value, kit: !!element.closest("[data-figure-kit],[data-diagram]"),
  });
  const elements = [root, ...root.querySelectorAll("*")];
  const excluded = "defs,title,desc,marker,pattern,clipPath,mask,.sr-only,.fig-fx,.fig-titlebar,[hidden]";
  const rendered = (element) => {
    for (let parent = element; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)
        return false;
      if (parent === root) break;
    }
    return true;
  };
  const visible = (element) => !element.closest(excluded) && rendered(element);
  const labelOf = (e) => e.getAttribute("aria-label") || e.getAttribute("data-testid") ||
    (e.matches("button,[role=tab],li") ? e.textContent.trim().replace(/\s+/g, " ").slice(0, 80) : "") ||
    e.localName;
  const geometry = elements.filter(e => e instanceof SVGGeometryElement && visible(e));
  const labels = [];
  const bounds = root.getBoundingClientRect();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const tolerance = 0.8;
  const beyond = (box, frame, x = true, y = true) => Math.max(0,
    ...(x ? [frame.left - box.left, box.right - frame.right] : []),
    ...(y ? [frame.top - box.top, box.bottom - frame.bottom] : []),
  );
  const intersection = (a, b) => {
    const left = Math.max(a.left, b.left), right = Math.min(a.right, b.right);
    const top = Math.max(a.top, b.top), bottom = Math.min(a.bottom, b.bottom);
    return right - left > 1.5 && bottom - top > 1.5 ? { left, right, top, bottom } : null;
  };
  const tree = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (tree.nextNode()) {
    const node = tree.currentNode, element = node.parentElement, text = node.textContent.trim();
    if (!text || !visible(element)) continue;
    const svgText = element.closest("svg text");
    if (element instanceof SVGElement && !svgText) continue;
    if (!svgText && element.closest("button,pre,code,[role=tablist],select,textarea,summary")) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const style = getComputedStyle(element);
    context.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(" ");
    const ink = context.measureText(text);
    const matrix = svgText && element.getScreenCTM();
    const baseline = matrix && Math.abs(matrix.b) < 0.001 && Math.abs(matrix.c) < 0.001 &&
      element.getNumberOfChars?.() ? element.getStartPositionOfChar(0).matrixTransform(matrix).y : null;
    for (const rangeBox of range.getClientRects()) {
      // A Range rectangle includes the font's ascent and descent even for a
      // line without ascenders or descenders. Compare the glyph bounds.
      let box = rangeBox;
      if (baseline != null) box = {
        left: rangeBox.left, right: rangeBox.right, width: rangeBox.width,
        top: baseline - ink.actualBoundingBoxAscent * matrix.d,
        bottom: baseline + ink.actualBoundingBoxDescent * matrix.d,
        height: (ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent) * matrix.d,
      };
      else if (!svgText && range.getClientRects().length === 1) {
        const ascent = ink.fontBoundingBoxAscent, descent = ink.fontBoundingBoxDescent;
        const y = rangeBox.top + (rangeBox.height + ascent - descent) / 2;
        box = { ...rangeBox.toJSON(), top: y - ink.actualBoundingBoxAscent,
          bottom: y + ink.actualBoundingBoxDescent, height: ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent };
      }
      if (box.width <= 0 || box.height <= 0) continue;
      labels.push({ text, element, svgText, box });
    }
  }
  for (const label of labels) {
    let horizontalScroll = false;
    for (let e = label.element.parentElement; e; e = e.parentElement) {
      const style = getComputedStyle(e), frame = e.getBoundingClientRect();
      const svg = e instanceof SVGSVGElement;
      const panel = e.matches(".fig-panel");
      const clips = (v) => ["hidden", "clip", "scroll", "auto"].includes(v);
      const scrolls = (v) => v === "scroll" || v === "auto";
      const x = svg || (panel && !horizontalScroll) || (clips(style.overflowX) && !scrolls(style.overflowX) && !horizontalScroll);
      const y = svg || panel || (clips(style.overflowY) && !scrolls(style.overflowY));
      const excess = beyond(label.box, frame, x, y);
      if (excess > tolerance) {
        note("G11", label.text, `${excess.toFixed(1)} px past ${svg ? "SVG viewport" : panel ? "figure panel" : labelOf(e)}`, label.element);
        break;
      }
      if (scrolls(style.overflowX) && e.scrollWidth > e.clientWidth) horizontalScroll = true;
      if (style.clipPath !== "none" && label.svgText) {
        const id = style.clipPath.match(/#([^"')]+)/)?.[1];
        const clip = id && document.getElementById(id);
        const rect = clip?.querySelector(":scope > rect");
        const matrix = e instanceof SVGGraphicsElement && e.getScreenCTM();
        if (rect && matrix && clip.getAttribute("clipPathUnits") !== "objectBoundingBox") {
          const shape = rect.getBBox();
          const corners = [new DOMPoint(label.box.left, label.box.top), new DOMPoint(label.box.right, label.box.top),
            new DOMPoint(label.box.left, label.box.bottom), new DOMPoint(label.box.right, label.box.bottom)];
          const inverse = matrix.inverse();
          if (corners.some(point => {
            const p = point.matrixTransform(inverse);
            return p.x < shape.x - tolerance || p.y < shape.y - tolerance ||
              p.x > shape.x + shape.width + tolerance || p.y > shape.y + shape.height + tolerance;
          })) note("G11", label.text, "extends past SVG clip #" + id, label.element);
        }
      }
      if (e.matches("[data-lesson-article]") || (panel && !root.contains(e))) break;
    }
  }
  const reported = new Set();
  for (let i = 0; i < labels.length; i++) {
    const a = labels[i];
    for (const b of labels.slice(i + 1)) {
      if (a.element === b.element || (a.svgText && a.svgText === b.svgText)) continue;
      const overlap = intersection(a.box, b.box);
      if (!overlap) continue;
      const pair = a.text + " / " + b.text;
      if (!reported.has(pair)) {
        reported.add(pair);
        note("G12", pair, `${(overlap.right - overlap.left).toFixed(1)} × ${(overlap.bottom - overlap.top).toFixed(1)} px text overlap`, a.element);
      }
    }
  }

  const svgPaint = geometry.map(e => {
    const c = getComputedStyle(e), matrix = e.getScreenCTM();
    if (!matrix) return null;
    const filled = c.fill !== "none" && Number(c.fillOpacity) !== 0;
    const stroked = c.stroke !== "none" && parseFloat(c.strokeWidth) > 0 && Number(c.strokeOpacity) !== 0;
    if (!filled && !stroked) return null;
    const padding = stroked ? parseFloat(c.strokeWidth) * Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d)) / 2 : 0;
    const rect = e.getBoundingClientRect();
    return { e, filled, stroked, inverse: matrix.inverse(), box: {
      left: rect.left - padding, top: rect.top - padding, right: rect.right + padding, bottom: rect.bottom + padding,
    }};
  }).filter(Boolean);
  for (const a of labels.filter(label => label.svgText)) {
    for (const mark of svgPaint) {
      // Only shapes within the same composition can cover its glyphs.
      if (mark.e.ownerSVGElement !== a.element.ownerSVGElement || mark.e.closest(".fig-legend")) continue;
      const overlap = intersection(a.box, mark.box);
      if (!overlap) continue;
      const test = (x, y, mode) => mark.e[mode](new DOMPoint(x, y).matrixTransform(mark.inverse));
      const inset = 0.75;
      // A label deliberately contained in a body does not collide with that body.
      const container = [[a.box.left + inset, a.box.top + inset], [a.box.right - inset, a.box.top + inset],
        [a.box.left + inset, a.box.bottom - inset], [a.box.right - inset, a.box.bottom - inset]]
        .every(([x, y]) => test(x, y, "isPointInFill"));
      if (container && mark.e.matches("rect,circle,ellipse,polygon,path")) continue;
      const inside = ["isPointInStroke", ...(mark.filled ? ["isPointInFill"] : [])];
      let hit = 0;
      for (let y = overlap.top + 0.5; y < overlap.bottom; y += Math.max(1, (overlap.bottom - overlap.top) / 9))
        for (let x = overlap.left + 0.5; x < overlap.right; x += Math.max(1, (overlap.right - overlap.left) / 16))
            if (inside.some(mode => (mode !== "isPointInStroke" || mark.stroked) && test(x, y, mode))) hit++;
      const pair = a.text + " / " + labelOf(mark.e);
      if (hit >= 3 && !reported.has(pair)) {
        reported.add(pair);
        note("G12", pair, "label intersects a painted mark", a.element);
      }
    }
  }

  const rgba = (value) => {
    if (!value || /^(none|url\()/.test(value)) return [0, 0, 0, 0];
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = "transparent";
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    return Array.from(context.getImageData(0, 0, 1, 1).data);
  };
  const rgb = (value) => rgba(value).slice(0, 3).join(",");
  const legend = ".fig-legend,[data-fig-legend],[role=list][aria-label*=legend i],[aria-label*=key i][data-fig-key]";
  const sample = (e) => {
    const c = getComputedStyle(e);
    if (e instanceof SVGGeometryElement) {
      if (c.stroke !== "none" && parseFloat(c.strokeWidth) && Number(c.strokeOpacity) > 0)
        return { color: rgb(c.stroke), dash: c.strokeDasharray };
      if (c.fill !== "none") {
        const id = c.fill.match(/#([^"')]+)/)?.[1];
        const stops = id && document.getElementById(id)?.querySelectorAll("stop");
        return { color: rgb(stops?.length ? getComputedStyle(stops[0]).stopColor : c.fill), dash: "none" };
      }
      return null;
    }
    if (c.borderStyle && c.borderStyle !== "none" && parseFloat(c.borderTopWidth))
      return { color: rgb(c.borderTopColor), dash: c.borderTopStyle === "solid" ? "none" : c.borderTopStyle };
    return rgba(c.backgroundColor)[3] ? { color: rgb(c.backgroundColor), dash: "none" } : null;
  };
  const styleKey = (v) => v && v.color + " / " + v.dash;
  const equivalent = (a, b) => a && b && a.color === b.color &&
    (a.dash === b.dash || (a.dash === "dashed" && /\d/.test(b.dash)) || (b.dash === "dashed" && /\d/.test(a.dash)));
  const swatches = elements.filter(e => visible(e) && (
    e.hasAttribute("data-fig-swatch") ||
    (e.closest(legend) && (e instanceof SVGGeometryElement || e.matches(".fig-solid,.fig-chip > span[aria-hidden],.key-swatch")))));
  const swatchStyles = swatches.map(sample);
  const authoredMarks = elements.filter(e => visible(e) && !e.closest(legend) &&
    (e instanceof SVGGeometryElement || e.matches("[data-fig-mark],.fig-solid")));
  const paints = new Map(authoredMarks.map(mark => [mark, sample(mark)]));
  for (const [i, swatch] of swatches.entries()) {
    const paint = swatchStyles[i];
    if (!paint || ![...paints.values()].some(mark => equivalent(mark, paint)))
      note("G13", swatch.getAttribute("data-fig-swatch") || swatch.parentElement.textContent.trim() || labelOf(swatch), "no matching mark for " + (styleKey(paint) || "unpainted swatch"), swatch);
  }
  const directlyLabelled = (mark) => {
    const direct = mark.closest("[data-fig-label],[aria-label],[aria-labelledby]");
    const rectangle = mark.getBoundingClientRect();
    const nearby = mark.ownerSVGElement && labels.some(label => {
      if (label.element.ownerSVGElement !== mark.ownerSVGElement) return false;
      const { left, right, top, bottom } = label.box;
      const scale = Math.abs(mark.getScreenCTM().d);
      const horizontal = Math.min(right, rectangle.right) > Math.max(left, rectangle.left);
      const vertical = Math.min(bottom, rectangle.bottom) > Math.max(top, rectangle.top);
      return (horizontal && Math.max(top - rectangle.bottom, rectangle.top - bottom) <= 28 * scale) ||
        (vertical && Math.max(left - rectangle.right, rectangle.left - right) <= 24 * scale);
    });
    return (direct && direct !== root && direct !== mark.ownerSVGElement) ||
      nearby || mark.querySelector("title") ||
      (mark.parentElement.matches("g") && mark.parentElement.querySelector(":scope > text"));
  };
  const labelledPaints = authoredMarks.filter(directlyLabelled).map(mark => paints.get(mark));
  const unlabelled = new Set();
  for (const mark of authoredMarks.filter(e => e.matches("[data-fig-mark],.fig-trace,.fig-ramp-mark"))) {
    const paint = paints.get(mark);
    if (paint && !unlabelled.has(styleKey(paint)) &&
      ![...swatchStyles, ...labelledPaints].some(other => equivalent(other, paint))) {
      unlabelled.add(styleKey(paint));
      note("G13", mark.getAttribute("data-fig-mark") || styleKey(paint), "meaningful mark has no matching swatch or direct label", mark);
    }
  }

  const active = [
    '[aria-pressed="true"]','[aria-selected="true"]','[aria-current]:not([aria-current="false"])',
    '[data-state="active"]','[data-state="selected"]','[data-state="checked"]','[data-state="correct"]','[data-state="wrong"]','[data-state="incorrect"]',
    '[data-fig-state="selected"]','[data-fig-state="active"]','[data-fig-state="correct"]','[data-fig-state="wrong"]',
    '[data-lit="true"]','[data-active="true"]','[data-selected="true"]','[data-entry="true"]',
    '[data-verdict="correct"]','[data-verdict="wrong"]','.fig-selected','.is-selected','.is-active','.is-correct','.is-wrong',
  ].join(",");
  const relative = rgb => rgb.slice(0, 3).reduce((sum, c, i) => {
    const m = c / 255;
    return sum + [0.2126, 0.7152, 0.0722][i] * (m <= 0.04045 ? m / 12.92 : ((m + 0.055) / 1.055) ** 2.4);
  }, 0);
  const layered = (front, behind) => front.slice(0, 3).map((c, i) =>
    c * (front[3] / 255) + behind[i] * (1 - front[3] / 255));
  const paintState = (e) => {
    const c = getComputedStyle(e);
    let background = [255, 255, 255];
    const ancestors = [];
    for (let n = e.parentElement; n; n = n.parentElement) ancestors.unshift(n);
    for (const n of ancestors) background = layered(rgba(getComputedStyle(n).backgroundColor), background);
    const svg = e instanceof SVGGeometryElement;
    const fill = rgba(svg ? c.fill : c.backgroundColor);
    const gradient = !svg && /gradient\(/.test(c.backgroundImage);
    const firstStop = gradient ? c.backgroundImage.match(/(?:rgba?|hsla?|oklch|color)\([^)]*\)/)?.[0] : null;
    const body = firstStop ? rgba(firstStop) : fill;
    const fillPixel = layered(body, background);
    const border = rgba(svg ? c.stroke : c.borderTopColor);
    const outline = rgba(c.outlineColor);
    const hasBorder = svg ? c.stroke !== "none" : parseFloat(c.borderTopWidth) > 0;
    const hasOutline = c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0;
    const shadow = c.boxShadow.match(/(?:rgba?|color)\([^)]*\)/)?.[0];
    return {
      filled: body[3] > 0 || gradient,
      pattern: [c.backgroundImage, c.boxShadow, c.borderTopStyle, c.borderTopWidth,
        c.outlineStyle, c.outlineWidth, c.strokeDasharray].join("|"),
      colors: [fillPixel, layered(hasBorder ? border : [0,0,0,0], fillPixel),
        layered(hasOutline ? outline : [0,0,0,0], background), layered(rgba(shadow), background),
        layered(rgba(c.color), fillPixel)],
    };
  };
  const stateComparisons = [];
  const paintsForState = (element) => new Map([[
    "state", element,
  ], ...[...element.querySelectorAll(":scope > td,:scope > th,[aria-hidden=true],[data-fig-indicator]")]
    .flatMap(part => {
      const box = part.getBoundingClientRect();
      const owner = part.parentElement.closest(active);
      if (!visible(part) || box.width <= 2 || box.height <= 2 || (owner !== element && element.contains(owner)))
        return [];
      const position = [];
      for (let child = part; child !== element; child = child.parentElement)
        position.unshift([...child.parentElement.children].indexOf(child));
      return [[position.join("."), part]];
    })]);
  const points = (element) => {
    const box = element.getBoundingClientRect();
    const positions = [];
    for (const fraction of [0.25, 0.5, 0.75]) {
      for (const offset of [0.5, 2, -1]) {
        positions.push([box.left + box.width * fraction, box.top + offset],
          [box.left + offset, box.top + box.height * fraction]);
      }
    }
    return positions.map(([x, y]) => [x - bounds.x, y - bounds.y]);
  };
  for (const e of elements.filter(e => e.matches(active) && visible(e))) {
    // A progress-list annotation describes the separate method/step control.
    // Checking the whole card as if it were that control compares unrelated copy.
    if (e.matches('li[aria-current="step"]:not([tabindex],[role],[data-fig-state],[data-fig-indicator])')) continue;
    const peers = [...e.parentElement.children].filter(peer =>
      peer !== e && !peer.matches(active) && peer.localName === e.localName &&
      peer.getAttribute("role") === e.getAttribute("role") && visible(peer));
    if (!peers.length) continue;
    const state = paintsForState(e);
    for (const peer of peers) {
      const normal = paintsForState(peer);
      const comparisons = [...state].flatMap(([position, part]) => {
        const sibling = normal.get(position);
        if (!sibling || part.localName !== sibling.localName) return [];
        const a = paintState(part), b = paintState(sibling);
        const ratio = Math.max(...a.colors.map((color, i) => {
          const x = relative(color), y = relative(b.colors[i]);
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        }));
        return [{ part, peer: sibling, ratio, fillCue: a.filled && !b.filled,
          renderingDiffers: ratio > 1.01 || a.pattern !== b.pattern }];
      });
      if (comparisons.some(part => part.ratio >= 3 || part.fillCue)) continue;
      stateComparisons.push({
        label: e.matches("tr") ? e.querySelector('th[scope="row"]')?.textContent.trim() || labelOf(e) : labelOf(e),
        parts: comparisons.map(({ part, peer, ratio, renderingDiffers }) =>
          ({ ratio, renderingDiffers, active: points(part), inactive: points(peer) })),
        kit: !!e.closest("[data-figure-kit],[data-diagram]"),
      });
    }
  }

  const ramp = [];
  const groups = new Map();
  for (const e of elements.filter(visible)) {
    if (e.closest(legend)) continue;
    const classes = e.getAttribute("class") || "";
    const rule = classes.match(/(?:^|\s)(fill|stroke|bg|border-t|border)-fig-ramp-(\d)(?=\s|\/|$)/);
    const fillRef = e.getAttribute("fill")?.match(/^url\(#(.+)\)$/);
    const gradient = fillRef && document.getElementById(fillRef[1]);
    const gradientRank = gradient?.getAttribute("class")?.match(/fig-ramp-(\d)(?:-body)?\b/)?.[1];
    const cssGradientRank = classes.match(/--fig-ramp-(\d)-body\b/)?.[1];
    const rank = Number(e.getAttribute("data-fig-order") || rule?.[2] || gradientRank || cssGradientRank);
    if (!Number.isFinite(rank) || rank < 1) continue;
    const paint = rule?.[1] || (cssGradientRank ? "background" : "fill");
    const style = getComputedStyle(e);
    const group = e.closest("[data-fig-scale],svg") || root;
    if (!groups.has(group)) groups.set(group, groups.size);
    const rect = e.getBoundingClientRect();
    if (!rect.width && !rect.height) continue;
    const xs = [0.25, 0.5, 0.75], ys = [0.25, 0.5, 0.75];
    const samples = [];
    if (paint === "stroke" && e instanceof SVGGeometryElement) {
      const matrix = e.getScreenCTM();
      const length = e.getTotalLength();
      for (let i = 1; i < 24; i++) {
        const local = e.getPointAtLength(length * i / 24);
        if (!e.isPointInStroke(local)) continue;
        const p = local.matrixTransform(matrix);
        samples.push([p.x - bounds.x, p.y - bounds.y]);
      }
    } else for (const x of xs) for (const y of ys) {
      const yy = paint.startsWith("border") ? rect.top + Math.max(0.5, parseFloat(getComputedStyle(e).borderTopWidth) / 2) : rect.top + rect.height * y;
      const xx = rect.left + rect.width * x;
      if (e instanceof SVGGeometryElement && !e.isPointInFill(new DOMPoint(xx, yy).matrixTransform(e.getScreenCTM().inverse()))) continue;
      samples.push([xx - bounds.x, yy - bounds.y]);
    }
    if (samples.length) ramp.push({
      rank, group: groups.get(group) + "/" + paint + "/" + (paint === "stroke" ? style.strokeDasharray : ""),
      expected: paint === "stroke" ? rgba(style.stroke).slice(0, 3) : null,
      label: labelOf(e), samples, kit: !!e.closest("[data-figure-kit],[data-diagram]"),
    });
  }
  const focus = elements.filter(e => e.matches("[data-fig-focus]:not([data-fig-focus=false])") && visible(e));
  const depth = elements.some(e => {
    // The painted body can be dropped in forced colors without being absent in
    // the normal view. Depth still requires a surface inside the figure.
    if (e.closest(excluded.replace(",.fig-fx", "")) || !rendered(e) ||
      e.matches(".fig-panel") || e.closest(legend)) return false;
    if (e.matches(".fig-face-left,.fig-face-right")) return true;
    const style = getComputedStyle(e);
    if (e instanceof SVGGeometryElement) {
      const paint = style.fill.match(/#([^"')]+)/)?.[1] || e.getAttribute("fill")?.match(/^url\(#(.+)\)$/)?.[1];
      const server = paint && document.getElementById(paint);
      return !!server && ["linearGradient", "radialGradient"].includes(server.localName);
    }
    return /gradient\(/.test(style.backgroundImage) || style.boxShadow.includes("inset");
  }) || elements.some(e => e.matches(".fig-rim-top,.fig-rim-end,.fig-shadow") && rendered(e) &&
    e.ownerSVGElement?.querySelector(".fig-stop-top,.fig-stop-level,.fig-stop-shade"));
  return { findings, ramp, stateComparisons, depth, focus: focus.length, labels: labels.length, geometry: svgPaint.length };
}

const srgb = Array.from({ length: 256 }, (_, n) => {
  const x = n / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
});
const luminance = (buffer, offset) =>
  srgb[buffer[offset]] * 0.2126 + srgb[buffer[offset + 1]] * 0.7152 + srgb[buffer[offset + 2]] * 0.0722;

function pixelLuminance(screenshot, point) {
  const { data, info } = screenshot;
  const [x, y] = point.map(Math.round);
  return x >= 0 && y >= 0 && x < info.width && y < info.height
    ? luminance(data, 3 * (y * info.width + x))
    : null;
}

function rampFindings(entries, screenshot, theme) {
  const byGroup = new Map();
  for (const item of entries) {
    const valid = item.samples
      .map(point => {
        if (!item.expected) return pixelLuminance(screenshot, point);
        const x = Math.round(point[0]), y = Math.round(point[1]);
        let best = Infinity, picked = null;
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
          if (xx < 0 || yy < 0 || xx >= screenshot.info.width || yy >= screenshot.info.height) continue;
          const offset = 3 * (yy * screenshot.info.width + xx);
          const distance = item.expected.reduce((sum, channel, i) =>
            sum + (channel - screenshot.data[offset + i]) ** 2, 0);
          if (distance < best) {
            best = distance;
            picked = luminance(screenshot.data, offset);
          }
        }
        return best < 3 * 50 ** 2 ? picked : null;
      })
      .filter(value => value != null);
    if (!valid.length) continue;
    const group = byGroup.get(item.group) || new Map();
    const step = group.get(item.rank) || [];
    step.push(...valid);
    group.set(item.rank, step);
    byGroup.set(item.group, group);
  }
  const findings = [];
  for (const [group, steps] of byGroup) {
    const values = [...steps].sort(([a], [b]) => a - b).map(([rank, samples]) =>
      [rank, samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)]]);
    for (let i = 1; i < values.length; i++) {
      const [low, a] = values[i - 1], [high, b] = values[i];
      if ((theme === "dark" ? b - a : a - b) < -0.008)
        findings.push({ gate: "G16", label: `ramp ${low} → ${high}`, value: `luminance ${a.toFixed(3)} → ${b.toFixed(3)}`, kit: entries.filter(e => e.group === group).every(e => e.kit) });
    }
  }
  return findings;
}

function stateFindings(entries, screenshot) {
  const failures = new Map();
  for (const entry of entries) {
    const ratio = Math.max(...entry.parts.map(part => {
      const ratios = [];
      if (part.renderingDiffers) {
        for (const [i, point] of part.active.entries()) {
          const a = pixelLuminance(screenshot, point);
          const b = pixelLuminance(screenshot, part.inactive[i]);
          if (a != null && b != null)
            ratios.push((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
        }
      }
      ratios.sort((a, b) => a - b);
      return Math.max(part.ratio, ratios[Math.floor(0.75 * (ratios.length - 1))] ?? 1);
    }));
    const previous = failures.get(entry.label);
    if (ratio < 3 && (!previous || ratio < previous.ratio))
      failures.set(entry.label, { ...entry, ratio });
  }
  return [...failures.values()].map(({ label, kit, ratio }) =>
    ({ gate: "G15", label, kit, value: `${ratio.toFixed(2)}:1 against an inactive sibling` }));
}

async function auditVisual(locator, theme) {
  await locator.scrollIntoViewIfNeeded();
  const view = await locator.evaluate(readVisual);
  if (view.ramp.length || view.stateComparisons.length) {
    const screenshot = await visualScreenshot(locator, { scale: "css" });
    const pixels = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    view.findings.push(...rampFindings(view.ramp, pixels, theme),
      ...stateFindings(view.stateComparisons, pixels));
  }
  const { stateComparisons, ramp, ...result } = view;
  return { ...result, ramp: ramp.length, states: stateComparisons.length };
}

async function visualScreenshot(locator, options) {
  try {
    return await locator.screenshot({ ...options, animations: "disabled", timeout: 8000 });
  } catch (error) {
    if (error.name !== "TimeoutError") throw error;
    // An animated or lazy frame can keep changing its bounds. Crop its current
    // document box directly when the locator cannot wait for it to be stable.
    const clip = await locator.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const x = Math.max(0, Math.floor(rect.left + scrollX));
      const y = Math.max(0, Math.floor(rect.top + scrollY));
      return { x, y, width: Math.ceil(rect.right + scrollX) - x, height: Math.ceil(rect.bottom + scrollY) - y };
    });
    if (clip.width <= 0 || clip.height <= 0) throw error;
    return locator.page().screenshot({ ...options, clip, fullPage: true, animations: "disabled", timeout: 60000 });
  }
}

// Run in Chromium before reveal. Keep the crop on the drawing, not its frame.
function markArtwork(root) {
  const candidates = [root, ...root.querySelectorAll("[data-fig-art],svg,canvas,img,[role=img],.fig-stage")];
  const isVisibleArt = (e) => {
    const box = e.getBoundingClientRect();
    return box.width >= 16 && box.height >= 16 &&
      !e.closest(".fig-legend,button,pre,code,[hidden],.lucide,.sr-only,.fig-fx") &&
      getComputedStyle(e).visibility === "visible";
  };
  const visible = candidates.filter(isVisibleArt);
  const declared = visible.filter(e => e.matches("[data-fig-art]"));
  const physical = visible.filter(e => e.matches("svg,canvas,img,[role=img]"));
  const stages = visible.filter(e => e.matches(".fig-stage") && e.querySelector(
    "[data-fig-focus],[data-fig-mark],.fig-solid,[class*=border-fig-],[class*=stroke-fig-]",
  ));
  const chosen = declared.length ? declared : physical.length ? physical : stages;
  const parts = chosen.filter(e => !chosen.some(parent => parent !== e && parent.contains(e)));
  for (const e of parts) e.setAttribute("data-gate-art", "");
  return {
    parts: parts.length,
    kitOnly: parts.length > 0 && parts.every(e => e.closest("[data-figure-kit],[data-diagram]")),
  };
}

async function captureArtwork(locator) {
  const info = await locator.evaluate(markArtwork);
  const parts = [];
  const screenshotStyle = "[data-gate-art]{background-color:#808080!important;box-shadow:none!important;}[data-gate-overlay]{visibility:hidden!important;}";
  for (const part of await locator.locator("[data-gate-art]").or(locator.and(locator.page().locator("[data-gate-art]"))).all()) {
    const screenshot = await visualScreenshot(part, { scale: "css", style: screenshotStyle });
    const image = await sharp(screenshot).resize(48, 36, { fit: "fill" }).flatten({ background: "#808080" }).removeAlpha().raw().toBuffer();
    parts.push(image.toString("base64"));
  }
  await locator.evaluate(root => {
    root.removeAttribute("data-gate-art");
    for (const child of root.querySelectorAll("[data-gate-art]")) child.removeAttribute("data-gate-art");
  });
  return { kitOnly: info.kitOnly, parts };
}

function auditResults(matrix, saved, report, kitNotes, { released = false, skipPixels = false, decisions = [] } = {}) {
  const grouped = Object.fromEntries(auditGates.map(gate => [gate, []]));
  const checks = Object.fromEntries(auditGates.map(gate => [gate, 0]));
  const add = (item, view, row, kit = false) => {
    const finding = { ...item, figure: row.name, line: row.line, width: view.width, theme: view.theme };
    (kit || item.kit ? kitNotes : grouped[item.gate]).push(finding);
  };
  for (const view of matrix) {
    for (const [index, row] of view.rows.entries()) {
      if (row.controlOnly || row.domIndex == null || !view.audits[index]) continue;
      const audit = view.audits[index];
      const beforeReveal = view.initialAudits?.[index];
      const artwork = view.artwork[index];
      const initial = matrix.find(s => s.width === 1440 && s.theme === view.theme);
      const kit = row.kind === "kit" || initial?.artwork?.[index]?.kitOnly ||
        row.look === "kit-drawn, not redesigned";
      const waiver = focalWaiver(report, row, released);
      for (const id of ["G11", "G12", "G13", "G15", "G16"]) checks[id]++;
      const unique = new Map([...beforeReveal?.findings ?? [], ...audit.findings]
        .map(finding => [JSON.stringify(finding), finding]));
      for (const finding of unique.values()) add(finding, view, row, kit);
      if (view.width === 1440) {
        checks.G14++;
        const focusCount = Math.max(audit.focus, beforeReveal?.focus || 0);
        if (!kit && !skipPixels && !artwork?.parts.length) {
          decisions.push({ figure: row.name, line: row.line, theme: view.theme, width: view.width,
            reason: "No drawing isolated in the default state or after the first reveal", crop: view.decisionCrops?.[index] });
        } else {
          const hasDepth = audit.depth || beforeReveal?.depth;
          const hasStage = row.hasStage || row.recap || (skipPixels && row.panel && row.kind === "interactive" && hasDepth);
          const reason = !hasStage || !row.hasTokens || !hasDepth ? "missing a stage with depth" :
            focusCount > 1 ? `${focusCount} focal declarations in one visual` :
            !focusCount && !waiver ? "missing a declared focal part or a report reason" : null;
          if (reason) add({ gate: "G14", label: "design declaration", value: reason }, view, row, kit);
          if (released && !waiver)
            decisions.push({ figure: row.name, line: row.line, theme: view.theme, width: view.width,
              reason: "No focal part named in the released lesson records" });
          if (!kit && !skipPixels) {
            const before = saved?.artwork?.[view.theme]?.[index];
            const delta = artworkDifference(before?.parts, artwork.parts);
            if (delta == null || delta < 0.055)
              add({ gate: "G14", label: "first drawing pixels", value: delta == null
                ? "missing comparable art capture"
                : `${(delta * 100).toFixed(2)}% changed (floor 5.5%)` }, view, row);
          }
        }
      }
      for (const [state, visual, regions] of [
        ["default", beforeReveal, view.initialFocus || []], ["revealed", audit, view.pixels],
      ]) {
        if (!visual?.focus) continue;
        checks.G17++;
        const focus = regions.filter(region => region.index === index).flatMap(region =>
          region.marks.filter(mark => mark.focal).map(mark => ({ ...mark, kit: mark.kit || region.kit })));
        if (!focus.length) add({ gate: "G17", label: "focal outline", value: state + " focal part has no measurable outline" }, view, row, kit);
        for (const mark of focus.filter(mark => mark.ratio == null || mark.ratio < 3))
          add({ gate: "G17", label: mark.label, value: mark.ratio == null ? `unmeasured ${state} focal outline` : `${mark.ratio.toFixed(2)}:1 ${state} focal outline` }, view, row, kit || mark.kit);
      }
    }
  }
  return Object.fromEntries(auditGates.map(gate => {
    const skipped = gate === "G14" && skipPixels;
    const failed = grouped[gate].length || (gate !== "G17" && !checks[gate]);
    return [gate, {
      status: failed ? "FAIL" : skipped ? "SKIPPED" : "PASS",
      summary: (skipped ? "F1A is the approved reference without a before capture; pixel comparison skipped. " : "") +
        `${checks[gate]} visual views checked, ${grouped[gate].length} findings` +
        (grouped[gate].length ? ` — ${grouped[gate][0].figure} @${grouped[gate][0].line}: ${grouped[gate][0].label} (${grouped[gate][0].value})` : ""),
      details: grouped[gate],
    }];
  }));
}

module.exports = {
  allWidths, auditGates, selectVisuals, artworkDifference, focalWaiver, requireServer,
  auditResults, auditVisual, captureArtwork, visualScreenshot,
};
