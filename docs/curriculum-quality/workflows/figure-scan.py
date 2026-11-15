#!/usr/bin/env python3
"""List every figure in lesson MDX files and what a colour pass could do.

Usage:
  figure-scan.py [--tiers T3_Advanced,T4_Expert] [--json OUT] [--work-only] [lesson.mdx ...]
  figure-scan.py --selftest

With no files and no --tiers it scans all of content/curriculum. For each
lesson it prints every figure with its line range:

- ArchitectureDiagram: title, nodes, nodes of kind "generic" (or no kind)
  with no role, edges.
- SequenceDiagram: title, participants, participants with neither kind nor role.
- For both: each node or participant of a side-overridable kind (fifo, reg;
  the guard's SIDE_OVERRIDABLE_KINDS) with the side it draws now, as "check
  the side": a fifo draws as testbench and a reg as the register model unless
  its role says "design". Read the lesson's words and give an RTL FIFO,
  buffer, queue or hardware register role: "design".
- TimingDiagram: counted only (the kit already colours values); its caption
  still gets the WARNING below.
- hand-drawn <svg>: monochrome (only currentColor and neutrals), a little
  colour, or colourful; whether any data-fig is present; whether its
  figcaption names a colour (a colour pass must keep that sentence true).
  For a monochrome figure with solid candidates (shapes filled in
  currentColor, not empty, with no text anchored on them), the note says that
  a mark with its own text label beside it may take data-fig="<role> solid",
  and that one without keeps its ladder; with none it says "no solid
  candidates".
- For every figure: a WARNING when its caption (kit caption prop, read
  also when it is written as JSX or a template string, or <Caption>, or the
  svg's figcaption) or the paragraph just before or after it names a colour
  or uses an appearance word a colour pass can make false (shaded, darker,
  highlighted, hollow, greyed, black, white, faded, tinted, filled, open dot,
  solid, outline, thick, bold, dim, faint, empty, dark, light…). In a kit
  caption "solid" does not warn: kit roles never change a line's style.
- For a hand-drawn svg, the same WARNING for its own text: aria-label,
  <title>, <desc> and the words drawn in <text>, which are lesson text too.
- A hand-drawn svg that already has data-fig is not a candidate, but the line
  says how many currentColor shapes are still unmarked.

A lesson where no figure is a candidate is reported as "nothing to do".
Standard library only. The rules for assigning roles are in
docs/planning/site-design-refresh-2026-11-10/DESIGN.md section 13.
"""
import argparse
import importlib.util
import json
import os
import re
import sys

# The guard's JSX-aware tag and attribute reader (a "'" in JSX text, as in
# caption={<>the DUT's flops</>}, is a letter, not the start of a string).
_spec = importlib.util.spec_from_file_location("figure_guard", os.path.join(os.path.dirname(os.path.abspath(__file__)), "figure-guard.py"))
guard = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(guard)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
CURRICULUM = os.path.join(ROOT, "content", "curriculum")

KIT = ("ArchitectureDiagram", "SequenceDiagram", "TimingDiagram")
HUES = ("rose", "amber", "cyan", "violet", "emerald", "sky", "indigo", "teal", "red", "green", "blue", "yellow", "orange", "purple", "pink", "lime", "fuchsia")
NEUTRAL_CLASS = ("current", "none", "transparent", "foreground", "muted", "background", "card", "border", "subtle", "slate", "gray", "zinc", "neutral", "stone", "black", "white")
COLOUR_WORDS = re.compile(
    r"\b(red|green|blue|cyan|amber|yellow|orange|violet|purple|indigo|teal|emerald|rose|pink|grey|gray|slate|sky|magenta|colou?red|colou?r)\b",
    re.I,
)
# Words about how a part looks, which a colour pass can make false or ambiguous
# ("the shaded boxes", "darker = more often", "the greyed rows", "an open dot").
APPEARANCE_WORDS = re.compile(
    r"\b(shaded|shading|shade|darker|darkest|lighter|lightest|highlighted|highlight|hollow|gr[ae]yed(?: out)?|black|white|faded|tinted|tint|filled|unfilled|open (?:dot|circle|marker)s?"
    r"|solid|outlined|outlines?|thick|thin|bold|dim|dimmed|faint|heavy|empty|blank|dark|light|pale|bright|opaque)\b",
    re.I,
)
# Kit roles never change a line's style, so in a kit caption "solid", "dashed"
# and the like describe the kit's own edge styles and stay true; warning on
# them there would be noise.
KIT_QUIET_WORDS = {"solid", "dashed", "dotted"}


def blank_code_fences(text):
    """Replace fenced code blocks with spaces (keeping newlines) so their contents are not scanned."""
    return re.sub(r"```[\s\S]*?```", lambda m: re.sub(r"[^\n]", " ", m.group(0)), text)


def line_of(text, index):
    return text.count("\n", 0, index) + 1


def jsx_element_end(text, start):
    """End index (exclusive) of the JSX opening tag that starts at `start`, honouring strings, braces and JSX in props."""
    m = re.match(r"<[A-Za-z][\w.:-]*", text[start:])
    return min(len(text), guard._tag_end(text, start + m.end()) + 1)


def tag_props(tag):
    """{name: (quote, value)} for the top-level props of an opening tag's text."""
    m = re.match(r"<[A-Za-z][\w.:-]*", tag)
    return {n: (q, v) for n, q, v, _, _ in guard.parse_attrs(tag, m.end() if m else 0, len(tag))}


def prop_expression(tag, name):
    """The text of a {…} prop (without the outer braces), or None."""
    q, v = tag_props(tag).get(name, (None, None))
    return v if q == "{" else None


def strip_jsx(expr):
    """Readable words of a JSX or string expression: tags, braces and quotes removed."""
    t = re.sub(r"<[^<>]*>", " ", expr)
    t = re.sub(r"[{}`]|\$\{", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def prop_string(tag, name, jsx=False):
    """A string prop: name="…", name={"…"} or name={'…'}; with jsx, also a JSX
    or template-string value (caption={<>…</>}, caption={`…`}) as plain words."""
    q, v = tag_props(tag).get(name, (None, None))
    if v is None:
        return None
    if q in ('"', "'"):
        return v
    m = re.fullmatch(r"""\s*(?:"([^"]*)"|'([^']*)')\s*""", v)
    if m:
        return next(g for g in m.groups() if g is not None)
    return strip_jsx(v) if jsx else None


def array_items(expr):
    """Top-level items of a JS array literal, as text."""
    if expr is None:
        return []
    expr = expr.strip()
    if not expr.startswith("["):
        return []
    items, depth, quote, cur = [], 0, None, []
    i = 1
    while i < len(expr):
        c = expr[i]
        if quote:
            cur.append(c)
            if c == "\\" and i + 1 < len(expr):
                cur.append(expr[i + 1])
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
            cur.append(c)
        elif c in "{[(":
            depth += 1
            cur.append(c)
        elif c in "}])":
            if depth == 0:
                break
            depth -= 1
            cur.append(c)
        elif c == "," and depth == 0:
            items.append("".join(cur).strip())
            cur = []
        else:
            cur.append(c)
        i += 1
    tail = "".join(cur).strip()
    if tail:
        items.append(tail)
    return [x for x in items if x]


def key_value(obj, key):
    m = re.search(r"""(?:^|[{,\s])["']?""" + key + r"""["']?\s*:\s*["']([^"']*)["']""", obj)
    return m.group(1) if m else None


# What a side-overridable kind draws as with no role, or with its default side.
SIDE_DEFAULT = {"fifo": "testbench", "reg": "register model (testbench side)"}


def side_checks(objs):
    """[(label, kind, side drawn now)] for each part of a side-overridable kind."""
    out = []
    for obj in objs:
        kind = key_value(obj, "kind")
        if kind not in guard.SIDE_OVERRIDABLE_KINDS:
            continue
        role = key_value(obj, "role")
        out.append((key_value(obj, "label") or key_value(obj, "id") or "?", kind, "design" if role == "design" else SIDE_DEFAULT.get(kind, "testbench")))
    return out


def untyped(obj):
    kind = key_value(obj, "kind")
    role = key_value(obj, "role")
    return (kind is None or kind == "generic") and role is None


def classify_svg(svg):
    """monochrome, little or colourful, after svgscan2.cjs."""
    shapes = [s for s in re.findall(r"<(?:rect|path|circle|ellipse|line|polyline|polygon|text)\b[^>]*>", svg)]

    def coloured(el):
        for attr in ("fill", "stroke"):
            m = re.search(attr + r'="([^"]+)"', el)
            if m and not re.search(r"currentColor|none|transparent|url\(", m.group(1)):
                return True
        cls = re.search(r'className="([^"]+)"', el)
        if cls:
            for token in cls.group(1).split():
                m = re.match(r"(?:[a-z]+:)*(?:fill|stroke|text|bg|border)-([a-z]+)", token)
                if m and m.group(1) in HUES:
                    return True
        return False

    hues = set()
    for m in re.finditer(r'(?:fill|stroke)="(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})"', svg):
        hues.add(re.sub(r"rgba?\((\d+,\s*\d+,\s*\d+).*", r"\1", m.group(1)))
    for m in re.finditer(r"\b(?:fill|stroke|text|bg|border)-(" + "|".join(HUES) + r")-", svg):
        hues.add(m.group(1))
    n = len(shapes)
    k = sum(1 for s in shapes if coloured(s))
    if k == 0 and not re.search(r'data-fig="(?!tint")', svg):
        return "monochrome", n, k
    if k == 0:
        return "little", n, k
    share = k / n if n else 0
    return ("little" if share < 0.3 or len(hues) <= 1 else "colourful"), n, k


def filled_marks(svg):
    """Shapes filled in currentColor (bars, dots, cells, swatches) that
    data-fig="<role> solid" could fill with a role colour: not an empty one
    (fill opacity or opacity 0) and not one with a <text> or <tspan> anchored
    inside its box (text never sits on a solid fill). The same tests as the guard."""
    masked = guard.mask_code(svg)
    opens, _ = guard.scan_tags(masked)
    anchors = guard.text_anchors(masked, opens, 0, len(masked))
    count = 0
    for ta, tb, tag in opens:
        if tag not in guard.SOLID_TAGS or tb >= len(masked):
            continue
        names = {n: (q, v) for n, q, v, _, _ in guard.parse_attrs(masked, ta + 1 + len(tag), tb)}
        if names.get("fill", (None, None))[1] != "currentColor" or names.get("fill", (None,))[0] not in ('"', "'"):
            continue
        if "strokeDasharray" in names or "stroke-dasharray" in names or guard.zero_opacity(names):
            continue
        box = guard.shape_box(tag, names)
        if box and any(box[0] <= x <= box[2] and box[1] <= y <= box[3] for x, y in anchors):
            continue
        count += 1
    return count


def colour_words(text):
    """Colour names and appearance words in `text` (both can be made false by a colour pass)."""
    words = {w.lower() for w in COLOUR_WORDS.findall(text or "")}
    words |= {re.sub(r"\s+", " ", w.lower()) for w in APPEARANCE_WORDS.findall(text or "")}
    return sorted(words)


def svg_own_text(svg):
    """(source, words) for the svg's accessible and visible text: aria-label,
    <title>, <desc> and the words drawn in <text>."""
    out = []
    for m in re.finditer(r"""aria-label=(?:"([^"]*)"|\{\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)\s*\})""", svg):
        out.append(("aria-label", next(g for g in m.groups() if g is not None)))
    for tag in ("title", "desc"):
        for m in re.finditer(r"<" + tag + r"\b[^>]*>([\s\S]*?)</" + tag + ">", svg):
            out.append((f"<{tag}>", strip_jsx(m.group(1))))
    drawn = " ".join(strip_jsx(m.group(1)) for m in re.finditer(r"<text\b[^>]*>([\s\S]*?)</text>", svg))
    if drawn:
        out.append(("<text>", drawn))
    return out


def unmarked_shapes(svg):
    """currentColor shapes with no data-fig of their own and not inside a marked <g>."""
    count, stack = 0, []
    for m in re.finditer(r"<(/?)(g|rect|path|circle|ellipse|line|polyline|polygon)\b([^>]*?)(/?)>", svg):
        close, name, attrs, selfclose = m.groups()
        if name == "g":
            if close:
                if stack:
                    stack.pop()
            elif not selfclose:
                stack.append("data-fig=" in attrs)
            continue
        if close:
            continue
        if "data-fig=" in attrs or any(stack):
            continue
        if re.search(r'\b(?:fill|stroke)="currentColor"', attrs):
            count += 1
    return count


def nearby_colours(text, start, end):
    """Colour words in the paragraph just before and just after a figure (text[start:end]).
    A colour pass must keep any colour sentence there true, so these are warnings."""
    before = text[:start].rstrip()
    para_before = re.split(r"\n\s*\n", before)[-1] if before else ""
    after = text[end:].lstrip()
    para_after = re.split(r"\n\s*\n", after, maxsplit=1)[0] if after else ""
    # Skip a neighbour that is itself a component or a figure: only prose counts.
    keep = lambda p: p if not re.match(r"\s*<", p) else ""
    return colour_words(keep(para_before) + "\n" + keep(para_after))


def scan_file(path):
    raw = open(path, encoding="utf8").read()
    text = blank_code_fences(raw)
    figures = []
    for m in re.finditer(r"<(" + "|".join(KIT) + r")\b", text):
        name = m.group(1)
        end = jsx_element_end(text, m.start())
        tag = text[m.start():end]
        fig = {"type": name, "lines": [line_of(text, m.start()), line_of(text, end - 1)], "title": prop_string(tag, "title")}
        # Kit captions: the caption prop and any <Caption> child.
        caption = prop_string(tag, "caption", jsx=True) or ""
        if not tag.rstrip().endswith("/>"):
            close = text.find(f"</{name}>", end)
            if close >= 0:
                inner = text[end:close]
                caption += " " + " ".join(re.findall(r"<Caption[^>]*>([\s\S]*?)</Caption>", inner))
                end = close + len(f"</{name}>")
        fig["captionColours"] = [w for w in colour_words(caption) if w not in KIT_QUIET_WORDS]
        fig["nearbyColours"] = nearby_colours(text, m.start(), end)
        if name == "ArchitectureDiagram":
            nodes = array_items(prop_expression(tag, "nodes"))
            fig["nodes"] = len(nodes)
            fig["genericNoRole"] = sum(1 for n in nodes if untyped(n))
            fig["withRole"] = sum(1 for n in nodes if key_value(n, "role") is not None)
            fig["edges"] = len(array_items(prop_expression(tag, "edges")))
            fig["candidate"] = fig["genericNoRole"] > 0
            fig["sideChecks"] = side_checks(nodes)
        elif name == "SequenceDiagram":
            parts = array_items(prop_expression(tag, "participants"))
            fig["participants"] = len(parts)
            fig["untyped"] = sum(1 for p in parts if untyped(p))
            fig["withRole"] = sum(1 for p in parts if key_value(p, "role") is not None)
            fig["candidate"] = fig["untyped"] > 0
            fig["sideChecks"] = side_checks(parts)
        else:
            fig["candidate"] = False
        figures.append(fig)
    for m in re.finditer(r"<svg\b[\s\S]*?</svg>", text):
        svg = m.group(0)
        cls, shapes, coloured = classify_svg(svg)
        after = text[m.end(): m.end() + 4000]
        close = after.find("</figure>")
        region = after[: close if close >= 0 else 0]
        cap = re.search(r"<figcaption[^>]*>([\s\S]*?)</figcaption>", region)
        caption_colours = colour_words(cap.group(1)) if cap else []
        fig_start = text.rfind("<figure", 0, m.start())
        fig_start = fig_start if fig_start >= 0 and "</figure>" not in text[fig_start:m.start()] else m.start()
        fig_end = m.end() + close + len("</figure>") if close >= 0 else m.end()
        label = re.search(r'aria-label="([^"]{0,80})', svg)
        title = re.search(r"<title[^>]*>([^<]{0,80})", svg)
        fig = {
            "type": "svg",
            "lines": [line_of(text, m.start()), line_of(text, m.end() - 1)],
            "title": (title.group(1) if title else label.group(1) if label else None),
            "colour": cls,
            "shapes": shapes,
            "colouredShapes": coloured,
            "dataFig": "data-fig=" in svg,
            "filledMarks": filled_marks(svg),
            "markers": svg.count("<marker"),
            "figcaption": bool(cap),
            "captionColours": caption_colours,
            "nearbyColours": nearby_colours(text, fig_start, fig_end),
            "ownTextColours": [[src, w] for src, words in svg_own_text(svg) for w in [colour_words(words)] if w],
            "unmarkedShapes": unmarked_shapes(svg) if "data-fig=" in svg else None,
        }
        fig["candidate"] = cls in ("monochrome", "little") and not fig["dataFig"]
        figures.append(fig)
    figures.sort(key=lambda f: f["lines"][0])
    return {"file": os.path.relpath(path, ROOT), "figures": figures, "work": any(f["candidate"] for f in figures)}


def colour_note(fig):
    """Warnings: a caption or the prose beside the figure names a colour, so a role
    colour must not make that sentence false or ambiguous."""
    notes = []
    if fig.get("captionColours"):
        notes.append(f"caption names colour: {', '.join(fig['captionColours'])}")
    if fig.get("nearbyColours"):
        notes.append(f"nearby prose names colour: {', '.join(fig['nearbyColours'])}")
    return f"\n      WARNING: {'; '.join(notes)} (keep those sentences true)" if notes else ""


def side_note(fig):
    """One line per part of a side-overridable kind, with the side it draws now."""
    return "".join(
        f'\n      check the side: {kind} "{label}" draws as {side} (role: "design" only if the lesson places it in a design block)'
        if side != "design" else f'\n      check the side: {kind} "{label}" draws as design (its role)'
        for label, kind, side in fig.get("sideChecks", [])
    )


def describe(fig):
    lines = f"{fig['lines'][0]}-{fig['lines'][1]}"
    title = f' "{fig["title"]}"' if fig.get("title") else ""
    t = fig["type"]
    if t == "ArchitectureDiagram":
        todo = f"{fig['genericNoRole']} generic node(s) could take a role" if fig["candidate"] else "nothing: every node has a kind or role"
        return f"  {lines} architecture{title}: {fig['nodes']} nodes, {fig['genericNoRole']} generic with no role, {fig['edges']} edges -> {todo}" + side_note(fig) + colour_note(fig)
    if t == "SequenceDiagram":
        todo = f"{fig['untyped']} participant(s) could take a role" if fig["candidate"] else "nothing: every participant has a kind or role"
        return f"  {lines} sequence{title}: {fig['participants']} participants, {fig['untyped']} with neither kind nor role -> {todo}" + side_note(fig) + colour_note(fig)
    if t == "TimingDiagram":
        return f"  {lines} timing{title} -> nothing (the kit colours values)" + colour_note(fig)
    cap = ""
    if fig["figcaption"]:
        cap = f", caption names colour: {', '.join(fig['captionColours'])}" if fig["captionColours"] else ", caption names no colour"
    else:
        cap = ", no figcaption"
    df = ", has data-fig" if fig["dataFig"] else ""
    todo = "mark parts with data-fig where the meaning is certain" if fig["candidate"] else "nothing"
    if fig.get("unmarkedShapes"):
        todo = f"partly marked: {fig['unmarkedShapes']} currentColor shape(s) still unmarked (leave those that are neutral by design)"
    if fig["colour"] == "little" and fig["candidate"]:
        todo = "check: a little colour; mark the remaining parts only if the meaning is certain"
    if fig["colour"] == "monochrome" and fig.get("filledMarks"):
        todo += (
            f"; {fig['filledMarks']} solid candidate(s) (filled, not empty, no text on them): a mark whose own text label beside it names its side may take"
            ' data-fig="<role> solid"; a mark without its own label keeps its ladder (fill opacity, dash) and stays neutral'
        )
    elif fig["colour"] == "monochrome":
        todo += "; no solid candidates"
    near = f"\n      WARNING: nearby prose names colour: {', '.join(fig['nearbyColours'])} (keep those sentences true)" if fig.get("nearbyColours") else ""
    if fig["captionColours"]:
        near += f"\n      WARNING: caption names colour: {', '.join(fig['captionColours'])} (keep that sentence true)"
    for src, words in fig.get("ownTextColours", []):
        near += f"\n      WARNING: the svg's {src} names colour: {', '.join(words)} (keep it true)"
    return f"  {lines} svg{title}: {fig['colour']} ({fig['colouredShapes']}/{fig['shapes']} coloured shapes, {fig['markers']} marker(s){df}{cap}) -> {todo}" + near


SELFTEST_MDX = """Intro.

<figure>
<svg viewBox="0 0 100 40" role="img" aria-label="WRAP8 of words from 0x34">
  <rect x="0" y="0" width="20" height="10" fill="currentColor" fillOpacity="0.15" />
  <rect x="30" y="0" width="20" height="10" fill="none" stroke="currentColor" strokeDasharray="3 2" />
</svg>
<figcaption>The shaded boxes are the burst's block (dashed boxes are outside it).</figcaption>
</figure>

<ArchitectureDiagram
  title="Bus"
  caption={<>The DUT's red path is the one that fails.</>}
  nodes={[{ id: "a", label: "A", col: 0, row: 0 }]}
/>

<figure>
<svg viewBox="0 0 100 40" role="img" aria-label={'The cyan bar is the expected value'}>
  <desc>Darker cells are hit more often.</desc>
  <rect x="0" y="0" width="20" height="10" fill="currentColor" data-fig="expected solid" />
  <rect x="30" y="0" width="20" height="10" fill="currentColor" />
  <g data-fig="design"><rect x="60" y="0" width="20" height="10" fill="none" stroke="currentColor" /></g>
  <text x="0" y="30" fill="currentColor">greyed rows are skipped</text>
</svg>
<figcaption>Two bars.</figcaption>
</figure>

<figure>
<svg viewBox="0 0 100 40" role="img" aria-label="Memory cells">
  <rect x="0" y="0" width="10" height="10" fill="currentColor" fillOpacity="0.0" />
  <rect x="20" y="0" width="10" height="10" fill="currentColor" fillOpacity="0.3" />
  <text x="25" y="7" fill="currentColor">5.6</text>
  <rect x="40" y="0" width="30" height="10" fill="currentColor" fillOpacity="0.6" />
  <text x="72" y="7" fill="currentColor">Testbench</text>
</svg>
<figcaption>Solid cells hold the numbers from the file. Hatched cells were never reached.</figcaption>
</figure>

<TimingDiagram
  title="Clock"
  caption="The red trace is the reset, drawn with a solid line."
  signals={[]}
/>

<ArchitectureDiagram
  title="Edges"
  caption="Solid edges carry data; dashed edges are control."
  nodes={[{ id: "b", label: "B", col: 0, row: 0 }]}
/>

<ArchitectureDiagram
  title="Bridge"
  caption="Two buffers."
  nodes={[
    { id: "w", label: "write buffer", kind: "fifo", col: 0, row: 0 },
    { id: "r", label: "read buffer", kind: "fifo", role: "design", col: 1, row: 0 },
    { id: "c", label: "ctx_reg", kind: "reg", col: 2, row: 0 },
    { id: "d", label: "drv", kind: "driver", col: 3, row: 0 }
  ]}
/>
"""


def selftest():
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".mdx", delete=False, encoding="utf8") as fh:
        fh.write(SELFTEST_MDX)
    try:
        figs = scan_file(fh.name)["figures"]
    finally:
        os.unlink(fh.name)
    wrap, kit, part, cells, timing, edges, bridge = figs
    own = dict((src, words) for src, words in part["ownTextColours"])
    cases = [
        ("an svg caption that says 'shaded' warns (the B-AHB-1 WRAP figure)", "shaded" in wrap["captionColours"]),
        ("a kit caption written as JSX, with an apostrophe, is read and warns on 'red'", kit["captionColours"] == ["red"]),
        ("a JSX caption does not end the kit tag early (one node counted)", kit["nodes"] == 1),
        ("an svg aria-label written as a JSX string that names a colour warns", own.get("aria-label") == ["cyan"]),
        ("an svg <desc> that says 'darker' warns", own.get("<desc>") == ["darker"]),
        ("svg <text> that says 'greyed' warns", own.get("<text>") == ["greyed"]),
        ("a partly marked svg reports its unmarked currentColor shapes", part["unmarkedShapes"] == 1 and not part["candidate"]),
        ("an unmarked svg is a candidate", wrap["candidate"] and wrap["unmarkedShapes"] is None),
        ("an empty cell and a cell with text on it are not solid candidates; a bar with its label beside it is", cells["filledMarks"] == 1),
        ("an svg caption that says 'Solid cells' warns (the F2D memory grid)", "solid" in cells["captionColours"]),
        ("a timing caption that names a colour prints a WARNING line, as the total counts it", "WARNING" in describe(timing) and timing["captionColours"] == ["red"]),
        ("a kit caption's 'solid' (an edge style the kit keeps) does not warn", edges["captionColours"] == [] and "WARNING" not in describe(edges)),
        ("each part of a side-overridable kind is listed with the side it draws now, and no other kind is",
         bridge["sideChecks"] == [("write buffer", "fifo", "testbench"), ("read buffer", "fifo", "design"), ("ctx_reg", "reg", "register model (testbench side)")]
         and describe(bridge).count("check the side") == 3),
        ("a monochrome svg with no solid candidates says so", "no solid candidates" in describe({**cells, "filledMarks": 0})),
    ]
    failed = 0
    for name, ok in cases:
        failed += 0 if ok else 1
        print(f"{'pass' if ok else 'FAIL'}: {name}")
    print(f"{len(cases) - failed} of {len(cases)} selftest cases behave as expected")
    return 1 if failed else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("files", nargs="*", help="lesson .mdx files (default: every lesson, or the --tiers)")
    ap.add_argument("--tiers", help="comma-separated tier folders, e.g. T3_Advanced,T4_Expert")
    ap.add_argument("--json", dest="json_out", help="write the full result as JSON to this path")
    ap.add_argument("--work-only", action="store_true", help="print only lessons with something to do")
    ap.add_argument("--selftest", action="store_true", help="check the warnings and counts on a small built-in lesson")
    args = ap.parse_args(argv)
    if args.selftest:
        return selftest()

    files = [os.path.abspath(f) for f in args.files]
    if not files:
        tiers = args.tiers.split(",") if args.tiers else sorted(d for d in os.listdir(CURRICULUM) if os.path.isdir(os.path.join(CURRICULUM, d)))
        for tier in tiers:
            base = os.path.join(CURRICULUM, tier.strip())
            if not os.path.isdir(base):
                print(f"no such tier folder: {base}", file=sys.stderr)
                return 2
            for d, _, fs in sorted(os.walk(base)):
                files.extend(os.path.join(d, f) for f in sorted(fs) if f.endswith(".mdx"))
    results = [scan_file(f) for f in files]

    totals = {"lessons": len(results), "lessonsWithWork": 0, "figures": {}, "candidates": {}, "svgColour": {}}
    for r in results:
        if r["work"]:
            totals["lessonsWithWork"] += 1
        for f in r["figures"]:
            totals["figures"][f["type"]] = totals["figures"].get(f["type"], 0) + 1
            if f["candidate"]:
                totals["candidates"][f["type"]] = totals["candidates"].get(f["type"], 0) + 1
            if f["type"] == "svg":
                totals["svgColour"][f["colour"]] = totals["svgColour"].get(f["colour"], 0) + 1
    totals["svgCaptionNamesColour"] = sum(1 for r in results for f in r["figures"] if f["type"] == "svg" and f["captionColours"])
    totals["svgOwnTextNamesColour"] = sum(1 for r in results for f in r["figures"] if f.get("ownTextColours"))
    totals["kitCaptionNamesColour"] = sum(1 for r in results for f in r["figures"] if f["type"] != "svg" and f.get("captionColours"))
    totals["nearbyProseNamesColour"] = sum(1 for r in results for f in r["figures"] if f.get("nearbyColours"))
    totals["genericNodes"] = sum(f.get("genericNoRole", 0) for r in results for f in r["figures"])
    totals["untypedParticipants"] = sum(f.get("untyped", 0) for r in results for f in r["figures"])
    totals["sideChecks"] = sum(len(f.get("sideChecks", [])) for r in results for f in r["figures"])

    for r in results:
        if args.work_only and not r["work"]:
            continue
        print(r["file"])
        if not r["figures"]:
            print("  no figures -> nothing to do")
            continue
        for f in r["figures"]:
            print(describe(f))
        if not r["work"]:
            print("  -> nothing to do")
    print()
    print(f"Lessons: {totals['lessons']}; with something to do: {totals['lessonsWithWork']}")
    print("Figures: " + ", ".join(f"{k} {v}" for k, v in sorted(totals["figures"].items())))
    print("Candidates: " + (", ".join(f"{k} {v}" for k, v in sorted(totals["candidates"].items())) or "none"))
    print("Hand-drawn svg: " + (", ".join(f"{k} {v}" for k, v in sorted(totals["svgColour"].items())) or "none") + f"; captions that name a colour: {totals['svgCaptionNamesColour']}; own text that names a colour: {totals['svgOwnTextNamesColour']}")
    print(f"Kit captions that name a colour: {totals['kitCaptionNamesColour']}; figures whose neighbouring prose names a colour: {totals['nearbyProseNamesColour']}")
    print(f"Generic nodes with no role: {totals['genericNodes']}; participants with neither kind nor role: {totals['untypedParticipants']}")
    print(f"Parts of a side-overridable kind ({', '.join(guard.SIDE_OVERRIDABLE_KINDS)}) to check the side of: {totals['sideChecks']}")

    if args.json_out:
        with open(args.json_out, "w", encoding="utf8") as fh:
            json.dump({"totals": totals, "lessons": results}, fh, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
