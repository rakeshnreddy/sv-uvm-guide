"use strict";

// Inspect the MDX tree. Examples inside fenced code and JSX-looking prose are not visuals.
const fs = require("node:fs");
const path = require("node:path");
const matter = require("gray-matter");
const kit = new Set([
  "ArchitectureDiagram",
  "SequenceDiagram",
  "TimingDiagram",
]);
const kits = {
  ArchitectureDiagram: "architecture",
  SequenceDiagram: "sequence",
  TimingDiagram: "timing",
};
const pictures = new Set([
  "img",
  "picture",
  "canvas",
  "video",
  "object",
  "iframe",
  "Image",
]);
const norm = (s) => s.replace(/\s+/g, " ").trim();
const attr = (node, name) =>
  node.attributes?.find((a) => a.name === name)?.value;
const hasClass = (node, name) =>
  String(attr(node, "className") || "")
    .split(/\s+/)
    .includes(name);
function walk(node, visit) {
  if (visit(node) !== false)
    for (const child of node.children || []) walk(child, visit);
}
function descendants(node, predicate) {
  const found = [];
  walk(node, (n) => {
    if (predicate(n)) found.push(n);
  });
  return found;
}
function strings(node) {
  const words = [];
  walk(node, (n) => {
    if (n.type === "text" || n.type === "inlineCode") words.push(n.value);
    if (/^mdx(?:Text|Flow)Expression$/.test(n.type)) {
      const expression = n.data?.estree?.body?.[0]?.expression;
      words.push(
        expression?.type === "Literal"
          ? String(expression.value)
          : "{" + n.value + "}",
      );
    }
  });
  return words.filter((s) => s.trim());
}
function literalColours(source) {
  // Only literal paint. SVG fragment references such as url(#abc) are IDs.
  const withoutIds = source.replace(
    /url\(\s*['"]?#[\w:.-]+['"]?\s*\)|(?:\bhref|\bid)\s*=\s*["']#?[\w:.-]+["']/gi,
    (s) => " ".repeat(s.length),
  );
  const colour =
    /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})(?![\w-])|\b(?:rgb|hsl)a?\(\s*[-+.\d]|\b(?:bg|text|fill|stroke|border(?:-[trblxyse])?|from|via|to|ring(?:-offset)?|divide|outline|decoration|shadow|accent|caret|placeholder|gradient|underline-offset)-(?:slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b|\b(?:bg|text|fill|stroke|border(?:-[trblxyse])?|ring|from|via|to|shadow)-(?:black|white)\b/gi;
  return Array.from(withoutIds.matchAll(colour), (m) => ({
    token: m[0],
    line: source.slice(0, m.index).split("\n").length,
  }));
}
function accessible(node, suffix = "") {
  const entries = [];
  walk(node, (n) => {
    const attributes = {};
    for (const a of n.attributes || []) {
      if (!(a.name === "role" || a.name?.startsWith("aria-"))) continue;
      if (
        a.name === "aria-hidden" &&
        (hasClass(n, "fig-fx") ||
          hasClass(n, "fig-titlebar") ||
          (n !== node &&
            !strings(n).length &&
            (a.value === "true" || a.value == null)))
      )
        continue;
      let value =
        typeof a.value === "object" && a.value ? a.value.value : a.value;
      if (suffix && ["aria-labelledby", "aria-describedby"].includes(a.name)) {
        value = String(value)
          .split(/\s+/)
          .map((id) => (id.endsWith(suffix) ? id.slice(0, -suffix.length) : id))
          .join(" ");
      }
      attributes[a.name] = value;
    }
    if (Object.keys(attributes).length)
      entries.push([
        n.name,
        Object.fromEntries(Object.entries(attributes).sort()),
      ]);
  });
  return entries;
}
function handWords(node) {
  const drawings = descendants(
    node,
    (n) => n.name === "svg" && attr(n, "aria-hidden") !== "true",
  );
  const captions = descendants(node, (n) => n.name === "figcaption").map(
    strings,
  );
  const strips = descendants(node, (n) => hasClass(n, "fig-titlebar")).map(
    (n) => strings(n).join(""),
  );
  const loose = [];
  const wrapperAttributes = [];
  function outside(n) {
    if (
      drawings.includes(n) ||
      n.name === "figcaption" ||
      hasClass(n, "fig-titlebar")
    )
      return;
    if (n.type === "text" || /^mdx(?:Text|Flow)Expression$/.test(n.type))
      loose.push(...strings(n));
    if (
      n.attributes &&
      !(n.name === "svg" && attr(n, "aria-hidden") === "true")
    ) {
      wrapperAttributes.push(...accessible({ ...n, children: [] }));
    }
    (n.children || []).forEach(outside);
  }
  outside(node);
  return {
    captions,
    strips,
    wrapperAttributes,
    versions: drawings.map((svg, i) => {
      const titles = descendants(svg, (n) => n.name === "title").map(strings);
      const descriptions = descendants(svg, (n) => n.name === "desc").map(
        strings,
      );
      const words = [];
      walk(svg, (n) => {
        if (["title", "desc"].includes(n.name)) return false;
        if (n.type === "text" || /^mdx(?:Text|Flow)Expression$/.test(n.type))
          words.push(...strings(n));
      });
      const ids = descendants(svg, (n) => attr(n, "id")).map((n) =>
        attr(n, "id"),
      );
      const refs = descendants(
        svg,
        (n) => attr(n, "aria-labelledby") || attr(n, "aria-describedby"),
      ).flatMap((n) =>
        ["aria-labelledby", "aria-describedby"].flatMap((k) =>
          String(attr(n, k) || "")
            .split(/\s+/)
            .filter(Boolean),
        ),
      );
      return {
        words: [...words, ...loose],
        titles,
        descriptions,
        aria: accessible(svg, i ? "-s" : ""),
        badRefs: refs.filter((id) => !ids.includes(id)),
      };
    }),
  };
}
async function inspectSource(source, loaders = new Map()) {
  const [{ unified }, { default: parse }, { default: mdx }] = await Promise.all(
    [import("unified"), import("remark-parse"), import("remark-mdx")],
  );
  const body = matter(source).content;
  const prefix = source.slice(0, source.length - body.length);
  const tree = unified().use(parse).use(mdx).parse(body);
  const visuals = [];
  const permittedRoles = [];
  const edits = [];
  const start = (n) => n.position.start.offset;
  const end = (n) => n.position.end.offset;
  walk(tree, (n) => {
    let kind;
    if (
      (n.name === "figure" && descendants(n, (c) => c.name === "svg").length) ||
      n.name === "svg"
    )
      kind = "drawing";
    else if (kit.has(n.name)) kind = "kit";
    else if (loaders.has(n.name)) kind = "interactive";
    else if (
      pictures.has(n.name) ||
      n.type === "image" ||
      n.type === "imageReference" ||
      n.name === "figure"
    )
      kind = "picture";
    if (!kind) return;
    const raw = body.slice(start(n), end(n));
    const title = descendants(n, (c) => c.name === "title")[0];
    const name =
      attr(n, "title") ||
      (title && strings(title).join("")) ||
      attr(n, "aria-label") ||
      n.alt ||
      attr(n, "alt") ||
      n.name ||
      n.url;
    const item = {
      kind,
      name,
      tag: n.name || n.type,
      key: kits[n.name] || (kind === "interactive" ? n.name : kind),
      line: n.position.start.line + prefix.split("\n").length - 1,
      raw,
    };
    visuals.push(item);
    if (kind === "drawing") {
      item.words = handWords(n);
      edits.push([start(n), end(n), "[[drawing]]"]);
    } else {
      // Remove only permitted keys inside their actual JSX attributes / object data.
      for (const a of n.attributes || []) {
        if (
          (kind === "kit" && a.name === "focus") ||
          (kind === "interactive" &&
            /^placeholder(?:Mid|Mobile)?Height$/.test(a.name))
        ) {
          const jsx = require("@babel/parser").parseExpression(raw, {
            plugins: ["jsx"],
          });
          const property = jsx.openingElement.attributes.find(
            (p) => p.name?.name === a.name,
          );
          let at = start(n) + property.start;
          while (at > start(n) && /\s/.test(body[at - 1])) at--;
          edits.push([at, start(n) + property.end, ""]);
        } else if (
          kind === "kit" &&
          ["nodes", "participants"].includes(a.name)
        ) {
          for (const obj of a.value?.data?.estree?.body?.[0]?.expression
            ?.elements || []) {
            for (const p of obj?.properties || []) {
              if (
                p.key?.name !== "role" ||
                !["design", "testbench"].includes(p.value?.value)
              )
                continue;
              const id = obj.properties.find((k) => k.key?.name === "id")?.value
                ?.value;
              permittedRoles.push({
                visual: visuals.length - 1,
                id,
                role: p.value.value,
              });
              let from = p.start,
                to = p.end;
              while (from && /\s/.test(body[from - 1])) from--;
              if (body[from - 1] === ",") from--;
              else if (/^\s*,/.test(body.slice(to)))
                to += body.slice(to).match(/^\s*,/)[0].length;
              edits.push([from, to, ""]);
            }
          }
        }
      }
    }
    return false;
  });
  let prose = body;
  for (const [a, b, replacement] of edits.sort((a, b) => b[0] - a[0]))
    prose = prose.slice(0, a) + replacement + prose.slice(b);
  return { prose: prefix + prose, visuals, permittedRoles };
}
function compareWords(base, current) {
  const failures = [];
  if (base.prose !== current.prose)
    failures.push(
      "Prose, figure order, or protected embed props differ from base",
    );
  for (const role of base.permittedRoles) {
    if (
      !current.permittedRoles.some(
        (r) =>
          r.visual === role.visual && r.id === role.id && r.role === role.role,
      )
    ) {
      failures.push(
        `Existing kit role changed on ${role.id} at visual ${role.visual + 1}`,
      );
    }
  }
  const drawings = (v) => v.visuals.filter((i) => i.kind === "drawing");
  const before = drawings(base),
    after = drawings(current);
  if (before.length !== after.length)
    failures.push(`Drawing count ${before.length} → ${after.length}`);
  for (const [i, item] of after.entries()) {
    if (!before[i]) continue;
    const a = item.words,
      b = before[i].words,
      want = b.versions[0];
    const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    if (
      !same(a.captions, b.captions) ||
      !same(a.wrapperAttributes, b.wrapperAttributes)
    )
      failures.push(item.name + ": caption or wrapper aria changed");
    if (
      !a.versions.length ||
      a.strips.length > 1 ||
      a.strips.some((s) => !want?.titles.flat().includes(s))
    )
      failures.push(item.name + ": missing drawing or incorrect title strip");
    a.versions.forEach((v, j) => {
      for (const key of ["words", "titles", "descriptions", "aria"])
        if (!same(v[key], want?.[key])) {
          const index = v[key].findIndex(
            (value, k) => !same(value, want?.[key]?.[k]),
          );
          failures.push(
            `${item.name} composition ${j + 1}: ${key}[${index < 0 ? v[key].length : index}] differs (${JSON.stringify(want?.[key]?.[index])} → ${JSON.stringify(v[key][index])})`,
          );
        }
      if (v.badRefs.length)
        failures.push(
          item.name + ": dangling aria reference " + v.badRefs.join(", "),
        );
    });
  }
  return failures;
}
function loadEmbeds() {
  const source = fs.readFileSync(
    path.join(__dirname, "../../src/components/mdx/LazyMdxInteractive.tsx"),
    "utf8",
  );
  return new Map(
    Array.from(
      source.matchAll(/^\s*(\w+):\s*\(\)\s*=>\s*import\("@\/(.*?)"\)/gm),
      (m) => [m[1], "src/" + m[2] + ".tsx"],
    ),
  );
}
module.exports = {
  inspectSource,
  compareWords,
  literalColours,
  loadEmbeds,
  norm,
};
