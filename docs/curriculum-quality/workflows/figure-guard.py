#!/usr/bin/env python3
"""Check that a lesson colour pass changed nothing but figure roles.

Usage:
  figure-guard.py --base <git ref> [--strict] [--all-findings] <lesson.mdx> [...]
  figure-guard.py --selftest

A file passes only if, after removing
- every allowed `role` property from the node objects of an
  <ArchitectureDiagram nodes={...}> and the participant objects of a
  <SequenceDiagram participants={...}> (role: "design", "role": 'testbench'…;
  one role key per object),
- every data-fig="…" attribute (one per tag, written as a top-level attribute
  of an opening tag inside an <svg>…</svg>) that fig_rule proves safe: one
  role token, plus at most one modifier and only with a role. A plain role
  goes on text, tspan, line, polyline and path, on a rect, circle, ellipse or
  polygon whose effective fill is none, and on a marker's shape when every
  line that uses the marker carries the same role; never on a <g>, <svg>,
  <marker>, <use>, <defs>, <title> or <desc>, nor on a part filled in
  currentColor at an effective opacity below 1 or unknown. "tint" and
  "solid" are a strict subset (rules B and C in DESIGN.md section 13) that
  the guard proves from each element's effective presentation (fill,
  fill-opacity, opacity, stroke-dasharray, transform and color, walked up
  its ancestors, in both attribute spellings, style objects and style
  strings); anything it cannot evaluate (a colour class, a `color` other than
  currentColor, a fill or stroke written in a colour other than currentColor
  or none, a background, an unknown class) is Unknown and takes no role and
  no modifier (fail closed); solid also needs an effective opacity of at
  least 0.2, every text sized inside the svg, and nothing drawn before it
  inside its box; tint needs a visible currentColor outline and must be
  drawn before every part inside its box; a caption, wrapper prop or aria
  reference the guard cannot read blocks both,
it is byte-identical to the same file at the base ref (the same removal is
applied to the base, so roles already there may stay). Tags are found by a
scanner that skips quoted strings, {…} expressions and inline code, so a "<"
inside a string never starts a tag. It fails, printing the first differing
hunk, on any other change, and also when a role or data-fig value is not
allowed, when a role disagrees with a tagged kind (any allowed role passes on
a side-overridable kind: fifo, reg), when a data-fig sits outside an <svg>, or
when a role appears anywhere else. A finding the base already had is not
counted, unless --all-findings is given. A role or data-fig that the base had
and the file drops or changes is printed as a note; with --strict it fails.
Standard library only. The rules are in
docs/planning/site-design-refresh-2026-11-10/DESIGN.md section 13,
"Assigning roles in lessons".
"""
import argparse
import difflib
import os
import re
import subprocess
import sys

# Only design and testbench may be given without a tag: their corner shape is the
# non-colour cue. Interface and register stay with their tagged kinds (IF, REG).
KIT_ROLES = ("design", "testbench")
FIG_ROLES = (
    "bit-low", "bit-high", "active", "x", "mismatch", "error", "z", "testbench", "design",
    "bus", "data", "interface", "expected", "register", "match", "ok",
)
# Two modifiers fill a shape: "tint" (a soft fill for a hollow box that holds
# text) and "solid" (a full-strength fill for a mark with no text on it). They
# are a strict subset the guard can prove safe (fig_rule below); anything
# outside it keeps plain stroke and text roles.
MODIFIERS = ("tint", "solid")
FIG_TOKENS = FIG_ROLES + MODIFIERS
# The role a tagged kind already has (figure-colours.ts figureRoleOf); any other
# tagged kind is testbench. A role must agree with it.
KIND_ROLE = {"generic": None, "dut": "design", "interface": "interface", "reg": "register"}
# Kinds that lessons use on both sides (an RTL FIFO inside a design block, a
# hardware register): a role may set their side, so any allowed role passes on
# them. Mirrors SIDE_OVERRIDABLE_KINDS in figure-colours.ts (a unit test keeps
# them equal). On every other tagged kind a disagreeing role is an error.
SIDE_OVERRIDABLE_KINDS = ("fifo", "reg")

ROLE_PROP = re.compile(r"""["']?role["']?\s*:\s*(?:"([^"]*)"|'([^']*)')""")
KIND_PROP = re.compile(r"""["']?kind["']?\s*:\s*(?:"([^"]*)"|'([^']*)')""")


def _blank(m):
    return re.sub(r"[^\n]", " ", m.group(0))


def mask_code(text):
    """The text with fenced code blocks, and inline code spans that hold a `<`,
    replaced by spaces (newlines kept), so offsets match the original. Figures
    are found in this copy only, so a tag in a code sample is never a figure."""
    out, fence = [], None
    for line in text.splitlines(True):
        m = re.match(r"\s*(`{3,}|~{3,})", line)
        if fence is None and m:
            fence = m.group(1)
            out.append(re.sub(r"[^\n]", " ", line))
        elif fence is not None:
            if line.strip().startswith(fence) and line.strip().strip(fence[0]) == "":
                fence = None
            out.append(re.sub(r"[^\n]", " ", line))
        else:
            out.append(re.sub(r"`[^`\n]*<[^`\n]*`", _blank, line))
    return "".join(out)


def _skip_string(text, i):
    """Index just past the string literal whose opening quote is at text[i]."""
    quote, i = text[i], i + 1
    while i < len(text):
        if text[i] == "\\":
            i += 2
            continue
        if text[i] == quote:
            return i + 1
        i += 1
    return len(text)


def _scan_braced(text, i):
    """Index just past the bracket that closes the one at text[i-1], honouring strings."""
    depth = 1
    while i < len(text):
        c = text[i]
        if c in "\"'`":
            i = _skip_string(text, i)
            continue
        if c in "{[(":
            depth += 1
        elif c in "}])":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return len(text)


def _tag_end(text, i):
    """Index of the `>` that ends the opening tag whose name ends at text[i]
    (len(text) if it never ends). Attribute values in quotes and {…}
    expressions (with any JSX inside them) are skipped whole."""
    n = len(text)
    while i < n:
        c = text[i]
        if c in "\"'":
            j = i - 1
            while j > 0 and text[j].isspace():
                j -= 1
            if text[j] == "=":
                i = _skip_string(text, i)
                continue
        if c == "{":
            i = _skip_expr(text, i + 1)
            continue
        if c == ">":
            return i
        i += 1
    return n


# A `<` in a JS expression starts JSX when it follows one of these (or `return`).
JSX_AFTER = "(,=:?&|[{};>"


def _skip_expr(text, i):
    """Index just past the `}` that closes the `{` at text[i-1]: a JS expression,
    so its strings, template literals, comments and JSX elements are skipped
    whole (in JSX text, as in caption={<>the DUT's flops</>}, a quote is a
    letter, not the start of a string)."""
    depth, n = 1, len(text)
    while i < n:
        c = text[i]
        if c in "\"'`":
            i = _skip_string(text, i)
            continue
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        if text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j < 0 else j
            continue
        if c == "<" and re.match(r"<[A-Za-z>]", text[i:i + 2]):
            before = text[:i].rstrip()
            if not before or before[-1] in JSX_AFTER or re.search(r"\breturn$", before):
                i = _skip_jsx(text, i)
                continue
        if c in "{[(":
            depth += 1
        elif c in "}])":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return n


def _skip_jsx(text, i):
    """Index just past the JSX element (or <>…</> fragment) that starts at text[i]."""
    n = len(text)
    m = re.match(r"<([A-Za-z][\w.:-]*)?", text[i:])
    end = _tag_end(text, i + m.end())
    if end >= n:
        return n
    if text[end - 1] == "/":
        return end + 1
    i = end + 1
    while i < n:
        c = text[i]
        if c == "{":
            i = _skip_expr(text, i + 1)
            continue
        if c == "<":
            if text.startswith("</", i):
                j = text.find(">", i)
                return n if j < 0 else j + 1
            if re.match(r"<[A-Za-z>]", text[i:i + 2]):
                i = _skip_jsx(text, i)
                continue
        i += 1
    return n


TAG_START = re.compile(r"<(/?)([A-Za-z][\w.:-]*)")


def scan_tags(text):
    """Walk the (code-masked) MDX in order and return (opens, closes):
    opens are (start, end, name) for every opening or self-closing tag, with
    end the index of its `>` (len(text) when it never closes); closes are
    (start, name). A `<` counts as a tag only in text position: never inside a
    {…} expression, a quoted attribute value or an inline code span, so the
    `<max` of {'count<max'} is not a tag."""
    opens, closes = [], []
    n = len(text)
    i = 0
    fm = re.match(r"---\n[\s\S]*?\n---\n", text)
    if fm:
        i = fm.end()
    while i < n:
        c = text[i]
        if c == "{":
            i = _skip_expr(text, i + 1)
            continue
        if c == "`":
            j, nl = text.find("`", i + 1), text.find("\n", i + 1)
            i = j + 1 if j >= 0 and (nl < 0 or j < nl) else i + 1
            continue
        if c == "<":
            m = TAG_START.match(text, i)
            if m:
                if m.group(1):
                    closes.append((i, m.group(2)))
                    i = m.end()
                    continue
                end = _tag_end(text, m.end())
                opens.append((i, end, m.group(2)))
                i = end + 1
                continue
        i += 1
    return opens, closes


ATTR_NAME = re.compile(r"[A-Za-z_:][\w:.-]*")


def parse_attrs(text, a, b):
    """Top-level attributes of an opening tag, text[a:b] being what follows its
    name: (name, quote, value, start, end) each, quote being '"', "'", "{" or
    None. Text inside a value or an expression is never read as an attribute."""
    out, i = [], a
    while i < b:
        c = text[i]
        if c.isspace() or c == "/":
            i += 1
            continue
        if c == "{":  # a spread {...props}: recorded as "...", so a reader can refuse it
            e = _skip_expr(text, i + 1)
            out.append(("...", "{", text[i + 1:e - 1], i, e))
            i = e
            continue
        m = ATTR_NAME.match(text, i)
        if not m:
            i += 1
            continue
        k = m.end()
        while k < b and text[k].isspace():
            k += 1
        if k < b and text[k] == "=":
            k += 1
            while k < b and text[k].isspace():
                k += 1
            if k < b and text[k] in "\"'":
                e, q = _skip_string(text, k), text[k]
                val = text[k + 1:e - 1]
            elif k < b and text[k] == "{":
                e, q = _skip_expr(text, k + 1), "{"
                val = text[k + 1:e - 1]
            else:
                e, q, val = k, None, None
        else:
            e, q, val = m.end(), None, None
        out.append((m.group(0), q, val, i, e))
        i = max(e, i + 1)
    return out


def role_regions(text, opens):
    """(start, end) spans of the nodes={…} / participants={…} expressions of kit figures."""
    spans = []
    for ta, tb, name in opens:
        if name not in ("ArchitectureDiagram", "SequenceDiagram"):
            continue
        prop = "nodes" if name == "ArchitectureDiagram" else "participants"
        for attr, q, _, s, e in parse_attrs(text, ta + 1 + len(name), tb):
            if attr == prop and q == "{":
                start = text.index("{", s) + 1
                spans.append((start, e))
    return spans


def top_level_roles(text, a, b):
    """Each `role` written as a top-level key of an object in the array at text[a:b]:
    (key start, cut start, cut end, value). Roles inside strings or nested objects are not keys;
    an object with two role keys reports each of them as a duplicate (an error)."""
    found = []
    i = a
    while i < b and text[i] != "[":
        if text[i] in "\"'`":
            return found
        i += 1
    i += 1
    while i < b:
        c = text[i]
        if c in "\"'`":
            i = _skip_string(text, i)
            continue
        if c == "]":
            break
        if c == "{":
            end = _scan_braced(text, i + 1)
            j, prev = i + 1, i  # prev: index of the last `{` or `,` at the object's top level
            while j < end - 1:
                d = text[j]
                if d in "\"'`":
                    m = ROLE_PROP.match(text, j)
                    if m and text[prev + 1:j].strip() == "":
                        found.append((j, m, text[i:end], i))
                    j = _skip_string(text, j)
                    continue
                if d in "{[(":
                    j = _scan_braced(text, j + 1)
                    continue
                if d == ",":
                    prev = j
                elif d.isalpha() and text[prev + 1:j].strip() == "":
                    m = ROLE_PROP.match(text, j)
                    if m:
                        found.append((j, m, text[i:end], i))
                j += 1
            i = end
            continue
        i += 1
    out = []
    seen = {}
    for j, m, obj, at in found:
        seen[at] = seen.get(at, 0) + 1
        value = m.group(1) if m.group(1) is not None else m.group(2)
        m_kind = top_level_key(obj, KIND_PROP)
        kind = None if m_kind is None else (m_kind.group(1) if m_kind.group(1) is not None else m_kind.group(2))
        if kind and kind not in SIDE_OVERRIDABLE_KINDS and KIND_ROLE.get(kind, "testbench") not in (None, value):
            value = f"{value}\0{kind}"
        before = text[:j].rstrip()
        if before.endswith(","):
            # `, role: "x"`: cut from the comma before it.
            out.append((j, len(before) - 1, m.end(), value))
        else:
            # `{ role: "x", id…`: cut the key and the comma and space after it.
            after = re.match(r"\s*,\s*", text[m.end():])
            out.append((j, j, m.end() + (after.end() if after else 0), value))
    # In JS the last of two keys wins, so a second role key hides which colour draws.
    for j, m, obj, at in found:
        if seen[at] > 1:
            out = [o for o in out if o[0] != j] + [(j, None, None, "\0\0duplicate")]
    return out


def top_level_key(obj, prop):
    """The match of `prop` written as a top-level key of the object text obj ("{…}"),
    else None. Keys inside strings or nested objects are not read, so a label
    that says "kind: 'fifo'" is not the object's kind."""
    end = _scan_braced(obj, 1)
    j, prev = 1, 0  # prev: index of the last `{` or `,` at the object's top level
    while j < end - 1:
        d = obj[j]
        if d in "\"'`":
            m = prop.match(obj, j)
            if m and obj[prev + 1:j].strip() == "":
                return m
            j = _skip_string(obj, j)
            continue
        if d in "{[(":
            j = _scan_braced(obj, j + 1)
            continue
        if d == ",":
            prev = j
        elif d.isalpha() and obj[prev + 1:j].strip() == "":
            m = prop.match(obj, j)
            if m:
                return m
        j += 1
    return None


def inside(pos, spans):
    return any(a <= pos < b for a, b in spans)


def _num(qv):
    """A plain number written as an attribute value ("10", {10}), else None."""
    if not qv or qv[1] is None:
        return None
    try:
        return float(qv[1].strip())
    except ValueError:
        return None


def shape_box(tag, names):
    """(x0, y0, x1, y1) of a rect, circle or ellipse whose geometry is written
    as plain numbers, else None. Transforms are not followed."""
    get = lambda k, d=None: _num(names[k]) if k in names else d
    if tag == "rect":
        x, y, w, h = get("x", 0.0), get("y", 0.0), get("width"), get("height")
        return None if None in (x, y, w, h) else (x, y, x + w, y + h)
    if tag in ("circle", "ellipse"):
        cx, cy = get("cx", 0.0), get("cy", 0.0)
        rx = get("r") if tag == "circle" else get("rx")
        ry = get("r") if tag == "circle" else get("ry")
        return None if None in (cx, cy, rx, ry) else (cx - rx, cy - ry, cx + rx, cy + ry)
    return None


def text_anchors(text, opens, a, b):
    """(x, y) of every <text> or <tspan> between a and b whose x and y are plain numbers."""
    out = []
    for ta, tb, tag in opens:
        if a <= ta < b and tag in ("text", "tspan") and tb < len(text):
            names = {n: (q, v) for n, q, v, _, _ in parse_attrs(text, ta + 1 + len(tag), tb)}
            x, y = _num(names.get("x")), _num(names.get("y"))
            if x is not None and y is not None:
                out.append((x, y))
    return out


def zero_opacity(names):
    """The name of a fill-opacity or opacity attribute written as 0, else None."""
    for k in ("fillOpacity", "fill-opacity", "opacity"):
        v = _num(names.get(k))
        if v is not None and v == 0:
            return k
    return None


def blocks(masked, opens, closes, name):
    """(start, end) of every <name>…</name> element."""
    out = []
    for ta, tb, tag in opens:
        if tag == name:
            if masked[tb - 1:tb] == "/":
                out.append((ta, tb))
                continue
            end = next((c for c, cname in closes if cname == name and c > tb), len(masked))
            out.append((ta, end))
    return out


# ---------------------------------------------------------------------------
# The figure model. For every element inside an <svg> the guard computes its
# effective presentation (fill, fill-opacity, opacity, stroke-dasharray,
# transform) by walking its ancestors inside that svg, reading attributes in
# both spellings (fill-opacity and fillOpacity), style objects and style
# strings. Anything given in a form it cannot evaluate (a class that is not a
# known-safe utility, a {…} expression that is not a literal, a CSS variable, a
# value it cannot parse, a pattern or gradient reference, a spread) makes the
# value Unknown, and an Unknown value never proves a rule: it fails closed.


class Unknown:
    """A value the guard cannot evaluate; `why` says what it was."""

    def __init__(self, why):
        self.why = why

    def __repr__(self):
        return f"Unknown({self.why})"


def unknown(v):
    return isinstance(v, Unknown)


# data-fig may stand on these tags only (rule D); everything else (<g>, <svg>,
# <marker>, <use>, <defs>, <title>, <desc>, …) is rejected.
FIG_ROLE_TAGS = ("text", "tspan", "line", "polyline", "path", "rect", "circle", "ellipse", "polygon")
CLOSED_TAGS = ("rect", "circle", "ellipse", "polygon")  # a plain role only with effective fill none
TINT_TAGS = ("rect",)
SOLID_TAGS = ("rect", "circle", "ellipse")
# Shapes whose fill is drawn: in a figure where any of these is filled (marker
# arrowheads apart), filled against hollow may be an encoding, so no tint.
FILLABLE_TAGS = ("rect", "circle", "ellipse", "polygon", "path", "polyline")
# Tags the model understands. Any other tag inside an svg (a <use>, an <image>,
# a <pattern>, a <foreignObject>, a nested <svg>, a <style>, a component) draws
# something the guard cannot see, so the figure takes no modifier.
KNOWN_SVG_TAGS = {
    "g", "defs", "marker", "title", "desc", "path", "rect", "circle", "ellipse", "line",
    "polyline", "polygon", "text", "tspan", "linearGradient", "radialGradient", "stop", "clipPath",
}
# Presentation properties the model reads (kebab-case). The BLOCKING ones,
# anywhere on the element or an ancestor, make its presentation Unknown.
PRES_PROPS = {
    "fill", "fill-opacity", "opacity", "stroke-dasharray", "transform", "font-size", "text-anchor",
    "dominant-baseline", "alignment-baseline", "letter-spacing", "word-spacing", "font", "direction",
    "writing-mode", "baseline-shift", "display", "visibility", "mask", "clip-path", "filter",
    "mix-blend-mode", "rotate", "translate", "scale", "x", "y", "width", "height", "cx", "cy", "r",
    "rx", "ry", "d", "color", "font-weight", "text-transform", "font-variant", "font-stretch",
    "background", "background-color", "background-image",
    "stroke", "stroke-opacity", "stroke-width", "marker-start", "marker-mid", "marker-end",
    "x1", "y1", "x2", "y2", "points",
}
# Any of these on the element or an ancestor in the svg makes its presentation
# Unknown. A background (on the root svg, say) changes the surface the role
# colours are measured against.
BLOCKING = ("display", "visibility", "mask", "clip-path", "filter", "mix-blend-mode", "writing-mode", "rotate", "translate", "scale",
            "background", "background-color", "background-image")
TEXT_UNSURE = ("letter-spacing", "word-spacing", "font", "direction", "baseline-shift", "font-variant", "font-stretch")
GEOMETRY = ("x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "d", "x1", "y1", "x2", "y2", "points")
# `color` is what currentColor resolves to. The guard never evaluates a colour,
# so any value other than these (a `color` attribute, a style, transparent,
# a palette colour) makes the presentation Unknown: the role CSS would redraw an
# invisible or deliberately coloured part at full role strength.
COLOR_PASS = ("currentcolor", "inherit", "unset")
# Tailwind utilities that set none of colour, fill, opacity, dash, transform,
# geometry or visibility, and whose font size the guard knows. Any other class
# token (text-<colour>, text-transparent, stroke-*, fill-*, opacity-*, rotate-*,
# hidden, animate-*, an arbitrary [..] value, a site class such as fig-solid) is
# Unknown.
TEXT_SIZES = {
    "xs": 12, "sm": 14, "base": 16, "lg": 18, "xl": 20, "2xl": 24, "3xl": 30, "4xl": 36, "5xl": 48,
    "6xl": 60, "7xl": 72, "8xl": 96, "9xl": 128,
    # The site's named sizes (tailwind.config.ts fontSize); display at the top of its clamp.
    "display": 60, "h1": 32, "h2": 24, "h3": 19, "h4": 16, "lead": 18, "body": 17, "ui": 14, "label": 12, "code": 13.5,
}
SIZE_CLASS = r"text-(" + "|".join(re.escape(k) for k in sorted(TEXT_SIZES, key=len, reverse=True)) + r")"
BOLD_CLASS = ("font-semibold", "font-bold", "font-extrabold", "font-black")
SAFE_CLASS = re.compile(
    r"(?:" + SIZE_CLASS + r"|text-(?:left|center|right|start|end)"
    r"|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|mono|sans|serif)"
    r"|select-(?:none|text|all|auto)|uppercase|lowercase|capitalize|normal-case|italic|not-italic|tabular-nums)"
)
DEFAULT_FONT = 20.0  # an unspecified font size is read generously
# Estimated advance per character, in em (generous; see advance()): 0.7 for
# lowercase, digits and punctuation, 0.9 for m and w, 0.8 for capitals, 1.0 for
# W, M, @, %, & and anything outside ASCII (symbols, emoji). Bold or uppercase
# text is read as all capitals.
GLYPH = 0.7
# Solid only on a mark drawn at an effective opacity of at least this (the
# faintest real bar, the pilot's DUT bar, is 0.25): a fainter cell reads as
# empty, and solid draws it at full strength. A fill-opacity or opacity written
# on the mark itself must be a plain decimal, so the CSS can refuse what is
# below the floor (globals.css, the solid rules' :not() list).
SOLID_MIN_ALPHA = 0.2
PLAIN_ALPHA = re.compile(r"(?:[01](?:\.\d*)?|\.\d+)")
NUMBER = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")

# Appearance words (rule B and C), matched by stem. A caption, a figcaption,
# an aria-label, <title>, <desc>, the figure's own words (its <text> and any
# text in its <figure>) or the paragraph before or after that uses one of
# these may be describing how a part looks, which a fill could make false.
APPEARANCE = re.compile(
    r"\b(?:un)?(?:shad(?:e|es|ed|ing)|fill(?:s|ed|ing)?|hollow\w*|outlin\w*|dash(?:es|ed|ing)?|dott\w*|dots?"
    r"|solid\w*|dark\w*|light(?:er|est|en\w*|ness|ly|s)?|thick\w*|thin(?:ner|nest|ness|ly)?|faint\w*|bold\w*"
    r"|bright\w*|pale(?:r|st|ness)?|hatch\w*|strip(?:e|es|ed|ing)|translucen\w*|opaque\w*|opacit\w*"
    r"|gr[ae]y\w*|dim(?:s|med|mer|mest|ming|ly|ness)?|highlight\w*|tint\w*|fad(?:e|es|ed|ing)|empty|blank"
    r"|transparen\w*|invisib\w*|see-through"
    r"|heav\w*|open|closed|mut(?:e|ed)|shadow\w*|ghost\w*|rings?"
    r"|colou?r\w*|red|green|blue|cyan|amber|yellow|orange|violet|purple|indigo|teal|emerald|rose|pink|black|white)\b",
    re.I,
)
# Shape glyphs: a caption keyed on them ("● drives, ○ reads", "□ = idle") names
# filled against hollow, which a fill could make false.
APPEARANCE_GLYPHS = re.compile("[\u25cf\u25cb\u25c6\u25c7\u25a0\u25a1\u25b2\u25b3\u25bc\u25bd\u25fc\u25fb\u2b24\u25ef\u25aa\u25ab\u2605\u2606\u25d0\u25d1]")


def kebab(name):
    return re.sub(r"[A-Z]", lambda m: "-" + m.group(0).lower(), name)


def literal(q, val):
    """A quoted attribute value, or a {…} that holds only a number or a string
    literal, as a string; anything else is Unknown."""
    if q in ('"', "'"):
        return val
    if q == "{":
        s = val.strip()
        if NUMBER.fullmatch(s):
            return s
        m = re.fullmatch(r"""(?:"([^"\\]*)"|'([^'\\]*)'|`([^`$\\]*)`)""", s)
        if m:
            return next(g for g in m.groups() if g is not None)
        return Unknown(f"the expression {{{s[:40]}}}")
    return Unknown("an attribute with no value")


def _split_top(s, sep):
    """Split s at `sep` outside strings and brackets."""
    out, depth, cur, i = [], 0, [], 0
    while i < len(s):
        c = s[i]
        if c in "\"'`":
            j = _skip_string(s, i)
            cur.append(s[i:j])
            i = j
            continue
        if c in "{[(":
            depth += 1
        elif c in "}])":
            depth -= 1
        if c == sep and depth == 0:
            out.append("".join(cur))
            cur = []
        else:
            cur.append(c)
        i += 1
    out.append("".join(cur))
    return out


def parse_style(q, val):
    """{prop: value | Unknown} for a style attribute, or Unknown when the guard
    cannot read the style as a whole (an expression that is not an object of
    literals, a spread, a computed key)."""
    out = {}
    if q in ('"', "'"):
        for decl in val.split(";"):
            if not decl.strip():
                continue
            if ":" not in decl:
                return Unknown(f'the style "{val[:40]}"')
            k, v = decl.split(":", 1)
            out[k.strip().lower()] = v.replace("!important", "").strip()
        return out
    if q != "{":
        return Unknown("a style with no value")
    s = val.strip()
    if not (s.startswith("{") and s.endswith("}")):
        return Unknown(f"the style expression {{{s[:40]}}}")
    for item in _split_top(s[1:-1], ","):
        item = item.strip()
        if not item:
            continue
        m = re.fullmatch(r"""(?:([A-Za-z_$][\w$]*)|"([^"]*)"|'([^']*)')\s*:\s*([\s\S]+)""", item)
        if not m:
            return Unknown(f"the style entry {item[:40]}")
        key = kebab(next(g for g in m.groups()[:3] if g is not None))
        v = literal("{", m.group(4))
        out[key] = v
    return out


# On the <svg> root only: layout utilities that size or place the svg box and
# set nothing its parts inherit. A background (bg-*) is not here: it changes the
# surface the role colours are measured against, so it is Unknown.
ROOT_SAFE_CLASS = re.compile(
    r"(?:(?:max-|min-)?[wh]-[\w./\[\]%-]+|-?m[xytblr]?-[\w./-]+|p[xytblr]?-[\w./-]+|block|inline|inline-block|flex|mx-auto"
    r"|overflow-(?:visible|hidden|auto)|aspect-[\w/\[\]-]+|shrink-0|rounded(?:-[\w-]+)?|border(?:-[\w/-]+)?)"
)


def class_info(q, val, root=False):
    """(unknown reason or None, font size from a text-size class or None, the
    class tokens)."""
    v = literal(q, val) if q else Unknown("a className with no value")
    if unknown(v):
        return f"className given as {v.why}", None, ()
    size = None
    for tok in v.split():
        base = re.sub(r"^(?:[\w-]+:)+", "", tok).lstrip("!")
        if not SAFE_CLASS.fullmatch(base) and not (root and ROOT_SAFE_CLASS.fullmatch(base)):
            return f'the class "{tok}", which may set a colour, fill, opacity, a dash, a transform or a size the guard does not know', None, ()
        m = re.fullmatch(SIZE_CLASS, base)
        if m:
            if base != tok:
                return f'the class "{tok}" (a size that depends on a variant)', None, ()
            size = max(size or 0, TEXT_SIZES[m.group(1)])
        elif base != tok and (base in BOLD_CLASS or base in ("uppercase", "capitalize")):
            return f'the class "{tok}" (a weight or case that depends on a variant)', None, ()
    return None, size, tuple(v.split())


class El:
    def __init__(self, tag, ta, tb, parent, attrs):
        self.tag, self.ta, self.tb, self.parent = tag, ta, tb, parent
        self.children, self.text, self.text_unknown = [], [], None
        self.attrs = attrs
        self.names = {n: (q, v) for n, q, v, _, _ in attrs}
        self.decl, self.style, self.why = {}, {}, None
        self.class_size = None
        self.classes = ()
        self.datafig = None
        for n, q, v, _, _ in attrs:
            if n == "...":
                self.why = "a spread {...} attribute"
            elif n in ("className", "class"):
                why, self.class_size, self.classes = class_info(q, v, root=parent is None)
                self.why = self.why or why
            elif n == "style":
                st = parse_style(q, v)
                if unknown(st):
                    self.why = self.why or st.why
                else:
                    self.style = st
            elif n == "data-fig":
                self.datafig = v if q == '"' else None
            else:
                k = kebab(n)
                if k in PRES_PROPS:
                    val = literal(q, v)
                    if k in self.decl and not unknown(val) and not unknown(self.decl[k]) and self.decl[k] != val:
                        val = Unknown(f"{k} given twice with different values")
                    self.decl[k] = val
                elif k in ("dx", "dy", "text-length", "length-adjust"):
                    self.decl[k] = Unknown(f"{n} on a text")

    def own(self, prop):
        """This element's own value of prop: style beats a class, a class beats
        an attribute. None when it sets none; Unknown when it cannot be read."""
        if self.why:
            return Unknown(self.why)
        if prop in self.style:
            v = self.style[prop]
            return v if unknown(v) else str(v)
        if prop == "font-size" and self.class_size:
            return str(self.class_size)
        return self.decl.get(prop)

    def chain(self):
        e, out = self, []
        while e is not None:
            out.append(e)
            e = e.parent
        return out

    def tokens(self):
        return (self.datafig or "").split()

    def line(self, text):
        return text.count("\n", 0, self.ta) + 1


def inherited(el, prop):
    """The effective value of an inherited property: the nearest own value up the
    chain (None if none sets it; Unknown if one cannot be read)."""
    for e in el.chain():
        v = e.own(prop)
        if unknown(v):
            return v
        if v is not None and v.strip().lower() != "inherit":
            return v.strip()
    return None


def fraction(v):
    """A number or percentage as a float, else None."""
    s = v.strip()
    if NUMBER.fullmatch(s):
        return float(s)
    m = re.fullmatch(r"(" + NUMBER.pattern + r")\s*%", s)
    return float(m.group(1)) / 100 if m else None


class Presentation:
    """fill ("none", "currentColor", "initial" for the SVG default black),
    stroke ("none", "currentColor", or None when no stroke is set: the SVG
    default draws none), alpha (fill-opacity × every opacity up the chain),
    opacity (the opacity chain alone), stroke_alpha (stroke-opacity × the
    opacity chain), stroke_width (px; 1 when unset), dash ("none" or
    "dashed"), transformed, context (None, "marker", or the first non-<g>
    ancestor), and unknown (the first reason, or None). A fill or stroke
    written as any colour other than currentColor or none (on the part or
    inherited) is Unknown: the role CSS recolours what draws in currentColor,
    and a part drawn in its own colour is deliberate (a cyan box paired with a
    cyan bracket), so it takes no role at all."""

    def __init__(self, el):
        self.unknown = None
        chain = el.chain()
        self.context = None
        for e in chain[1:]:
            if e.tag in ("g", "text", "tspan") or e.parent is None:
                continue
            if e.tag == "marker":
                self.context = self.context or "marker"
            elif self.context is None:
                self.context = e.tag
        for e in chain:
            for p in BLOCKING:
                v = e.own(p)
                if v is not None:
                    self.unknown = self.unknown or (v.why if unknown(v) else f'{p} "{v}" on <{e.tag}>')
            # What currentColor resolves to: anything but currentColor, inherit
            # or unset is a colour the guard does not evaluate (transparent, a
            # palette colour, an alpha), so the part is Unknown.
            v = e.own("color")
            if v is not None and (unknown(v) or v.strip().lower() not in COLOR_PASS):
                self.unknown = self.unknown or (v.why if unknown(v) else f'color "{v}" on <{e.tag}>, which the guard does not evaluate')
        fill = inherited(el, "fill")
        if unknown(fill):
            self.unknown = self.unknown or fill.why
            self.fill = fill
        elif fill is None:
            self.fill = "initial"
        else:
            low = fill.lower()
            if low == "currentcolor":
                self.fill = "currentColor"
            elif low == "none":
                self.fill = "none"
            elif "url(" in low or "var(" in low or low.startswith("context-"):
                self.fill = Unknown(f'fill "{fill}" (a pattern, gradient, CSS variable or context paint)')
                self.unknown = self.unknown or self.fill.why
            else:
                self.fill = Unknown(f'fill "{fill}", a colour the guard does not evaluate (a role would repaint or sit on a deliberately coloured part)')
                self.unknown = self.unknown or self.fill.why
        stroke = inherited(el, "stroke")
        if unknown(stroke):
            self.stroke = stroke
            self.unknown = self.unknown or stroke.why
        elif stroke is None:
            self.stroke = None
        elif stroke.lower() == "currentcolor":
            self.stroke = "currentColor"
        elif stroke.lower() == "none":
            self.stroke = "none"
        else:
            self.stroke = Unknown(f'stroke "{stroke}", a colour the guard does not evaluate (a role would repaint a deliberately coloured stroke)')
            self.unknown = self.unknown or self.stroke.why
        opacity = 1.0
        for e in chain:
            v = e.own("opacity")
            if v is None:
                continue
            f = None if unknown(v) else fraction(v)
            if f is None:
                opacity = v if unknown(v) else Unknown(f'opacity "{v}"')
                break
            opacity *= max(0.0, min(1.0, f))
        self.opacity = opacity
        so = inherited(el, "stroke-opacity")
        if unknown(so) or unknown(opacity):
            self.stroke_alpha = so if unknown(so) else opacity
        elif so is None:
            self.stroke_alpha = opacity
        else:
            f = fraction(so)
            self.stroke_alpha = Unknown(f'stroke-opacity "{so}"') if f is None else max(0.0, min(1.0, f)) * opacity
        sw = inherited(el, "stroke-width")
        if unknown(sw):
            self.stroke_width = sw
        elif sw is None:
            self.stroke_width = 1.0
        else:
            m = re.fullmatch(r"(" + NUMBER.pattern + r")\s*(?:px)?", sw.strip())
            self.stroke_width = Unknown(f'stroke-width "{sw}"') if not m else max(0.0, float(m.group(1)))
        alpha = 1.0
        fo = inherited(el, "fill-opacity")
        if unknown(fo):
            alpha = fo
        elif fo is not None:
            f = fraction(fo)
            alpha = Unknown(f'fill-opacity "{fo}"') if f is None else max(0.0, min(1.0, f))
        if not unknown(alpha):
            for e in chain:
                v = e.own("opacity")
                if v is None:
                    continue
                f = None if unknown(v) else fraction(v)
                if f is None:
                    alpha = v if unknown(v) else Unknown(f'opacity "{v}"')
                    break
                alpha *= max(0.0, min(1.0, f))
        self.alpha = alpha
        if unknown(alpha):
            self.unknown = self.unknown or alpha.why
        dash = inherited(el, "stroke-dasharray")
        if unknown(dash):
            self.dash = dash
            self.unknown = self.unknown or dash.why
        else:
            self.dash = "none" if dash is None or dash.lower() == "none" else "dashed"
        self.transformed = any(e.own("transform") is not None for e in chain)


def plain_number(el, k, default=None):
    v = el.own(k)
    if v is None:
        return default
    if unknown(v) or not NUMBER.fullmatch(v.strip()):
        return Unknown(f"{k} is not a plain number")
    return float(v)


def geometry(el):
    """(x0, y0, x1, y1) and size key of a rect, circle or ellipse with plain
    numeric geometry, else Unknown."""
    if el.tag == "rect":
        vals = [plain_number(el, "x", 0.0), plain_number(el, "y", 0.0), plain_number(el, "width"), plain_number(el, "height")]
        if any(v is None or unknown(v) for v in vals):
            return Unknown("its x, y, width or height is missing or not a plain number")
        x, y, w, h = vals
        return (x, y, x + w, y + h), ("rect", round(w, 6), round(h, 6))
    if el.tag in ("circle", "ellipse"):
        cx, cy = plain_number(el, "cx", 0.0), plain_number(el, "cy", 0.0)
        if el.tag == "circle":
            rx = ry = plain_number(el, "r")
        else:
            rx, ry = plain_number(el, "rx"), plain_number(el, "ry")
        if any(v is None or unknown(v) for v in (cx, cy, rx, ry)):
            return Unknown("its centre or radius is missing or not a plain number")
        return (cx - rx, cy - ry, cx + rx, cy + ry), (el.tag, round(rx, 6), round(ry, 6))
    return Unknown(f"<{el.tag}> geometry is not read")


def content_chars(el):
    """The literal text of a text or tspan and its tspans, else Unknown."""
    if el.text_unknown:
        return Unknown(el.text_unknown)
    s = re.sub(r"\s+", " ", "".join(el.text)).strip()
    for c in el.children:
        k = content_chars(c)
        if unknown(k):
            return k
        s += k
    return s


def content_len(el):
    """Characters of literal text in a text or tspan and its tspans, else Unknown."""
    s = content_chars(el)
    return s if unknown(s) else len(s)


def font_size(el, sized=False):
    """The computed font size of el in px, resolved up its ancestors in the svg:
    a number or px is taken as written, em and % multiply the parent's computed
    size, rem is read at DEFAULT_FONT, a known size class gives its size, and no
    size at all is DEFAULT_FONT. Anything else is Unknown. With sized, a size
    that is not set anywhere inside the svg (so it comes from a wrapper, a
    class or a style outside the figure, which the guard does not read) is
    Unknown too."""
    v = el.own("font-size")
    if el.parent is not None:
        parent = font_size(el.parent, sized)
    else:
        parent = Unknown("its font size is not set inside the svg, so it comes from outside the figure (a wrapper's class or style) and its box cannot be placed") if sized else DEFAULT_FONT
    if unknown(v):
        return v
    if v is None or v.strip().lower() == "inherit":
        return parent
    m = re.fullmatch(r"(" + NUMBER.pattern + r")\s*(px|em|rem|%)?", v.strip())
    if not m:
        return Unknown(f'font size "{v}"')
    n, unit = float(m.group(1)), m.group(2)
    if unit in ("em", "%"):
        if unknown(parent):
            return parent
        return n * parent / (100 if unit == "%" else 1)
    if unit == "rem":
        return n * DEFAULT_FONT
    return n


def caps_mode(el):
    """True when the text is bold (weight 600 and up, bold, bolder, or a bold
    class) or set in capitals (uppercase or capitalize), read up the chain; an
    unreadable weight or case counts as True (generous)."""
    for e in el.chain():
        if any(c.split(":")[-1].lstrip("!") in BOLD_CLASS + ("uppercase", "capitalize") for c in e.classes):
            return True
        w = e.own("font-weight")
        if w is not None:
            if unknown(w):
                return True
            s = w.strip().lower()
            if s in ("bold", "bolder") or (NUMBER.fullmatch(s) and float(s) >= 600) or not (NUMBER.fullmatch(s) or s in ("normal", "lighter", "inherit")):
                return True
        t = e.own("text-transform")
        if t is not None and (unknown(t) or t.strip().lower() not in ("none", "lowercase", "inherit")):
            return True
    return False


def advance(c, caps):
    """A generous advance for one character, in em (see GLYPH)."""
    if caps:
        c = c.upper()
    if ord(c) > 127 or c in "WM@%&":
        return 1.0
    if c in "mw":
        return 0.9
    if "A" <= c <= "Z":
        return 0.8
    return GLYPH


def text_box(el, sized=True):
    """A generous estimated box (x0, y0, x1, y1) of a <text> or a <tspan> that
    sets its own x and y; None for a tspan that flows inside its text (the
    text's box counts its characters); Unknown when it cannot be placed. With
    sized (the default), a text whose font size is not set inside the svg
    cannot be placed (font_size)."""
    pres = Presentation(el)
    if pres.unknown:
        return Unknown(pres.unknown)
    if pres.transformed:
        return Unknown("it is inside a transform")
    if pres.context is not None:
        return Unknown(f"it is inside <{pres.context}>")
    for e in el.chain():
        for p in TEXT_UNSURE + ("dx", "dy", "text-length", "length-adjust"):
            v = e.own(p)
            if v is not None:
                return Unknown(f"{p} is set")
    if el.tag == "tspan" and el.own("x") is None and el.own("y") is None:
        return None
    x, y = plain_number(el, "x", 0.0), plain_number(el, "y", 0.0)
    if el.tag == "tspan" and (el.own("x") is None or el.own("y") is None):
        return Unknown("a tspan sets only one of x and y")
    if unknown(x) or unknown(y):
        return Unknown("its x or y is not a plain number")
    size = font_size(el, sized)
    if unknown(size):
        return size
    caps = caps_mode(el)
    if unknown(caps):
        return caps
    chars = content_chars(el)
    if unknown(chars):
        return chars
    w = sum(advance(c, caps) for c in chars) * size
    pad = 0.15 * size
    anchor = inherited(el, "text-anchor")
    anchor = "both" if unknown(anchor) else (anchor or "start").lower()
    if anchor == "start":
        x0, x1 = x - pad, x + w + pad
    elif anchor == "middle":
        x0, x1 = x - w / 2 - pad, x + w / 2 + pad
    elif anchor == "end":
        x0, x1 = x - w - pad, x + pad
    else:
        x0, x1 = x - w - pad, x + w + pad
    if inherited(el, "dominant-baseline") is not None or inherited(el, "alignment-baseline") is not None:
        y0, y1 = y - 1.1 * size, y + 1.1 * size
    else:
        y0, y1 = y - 1.0 * size, y + 0.35 * size
    return (x0, y0, x1, y1)


# Elements that draw nothing where they stand (a marker's shapes are drawn at
# the ends of the lines that use it, and those lines' boxes count them).
NOT_DRAWN = ("g", "defs", "marker", "title", "desc", "stop", "linearGradient", "radialGradient", "clipPath")
PATH_ARGS = {"m": 2, "l": 2, "h": 1, "v": 1, "c": 6, "s": 4, "q": 4, "t": 2, "z": 0}


def path_points(d):
    """Every point a path names (end points and control points, absolute), or
    Unknown. The box of these points holds the drawn path (a Bezier curve
    lies inside the hull of its control points). Arcs are not read."""
    toks = re.findall(r"[A-Za-z]|" + NUMBER.pattern, d)
    if re.sub(r"[A-Za-z]|" + NUMBER.pattern + r"|[\s,]", "", d):
        return Unknown("a path d the guard cannot read")
    pts, cx, cy, sx, sy, cmd, i = [], 0.0, 0.0, 0.0, 0.0, None, 0
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            if t.lower() not in PATH_ARGS:
                return Unknown(f'a path command "{t}" the guard does not read (an arc, say)')
            cmd, i = t, i + 1
            if cmd.lower() == "z":
                cx, cy = sx, sy
                pts.append((cx, cy))
            continue
        if cmd is None or cmd.lower() == "z":
            return Unknown("a path d the guard cannot read")
        n = PATH_ARGS[cmd.lower()]
        args = toks[i:i + n]
        if len(args) < n or any(a.isalpha() for a in args):
            return Unknown("a path d the guard cannot read")
        v = [float(a) for a in args]
        i += n
        rel = cmd.islower()
        k = cmd.lower()
        if k == "h":
            cx = cx + v[0] if rel else v[0]
            pts.append((cx, cy))
        elif k == "v":
            cy = cy + v[0] if rel else v[0]
            pts.append((cx, cy))
        else:
            for j in range(0, n, 2):
                px, py = (cx + v[j], cy + v[j + 1]) if rel else (v[j], v[j + 1])
                pts.append((px, py))
            cx, cy = pts[-1]
            if k == "m":
                sx, sy = cx, cy
                cmd = "l" if rel else "L"
    return pts or Unknown("a path with no points")


def marker_extent(fig, el, sw):
    """How far the markers on el can reach from the line, in user units, or
    Unknown. A marker's viewport is markerWidth by markerHeight (3 by 3 when
    unset), in stroke widths unless markerUnits is userSpaceOnUse; its content
    is clipped to that viewport unless overflow is visible."""
    reach = 0.0
    for prop in ("marker-start", "marker-mid", "marker-end"):
        v = inherited(el, prop)
        if v is None or (not unknown(v) and v.strip().lower() == "none"):
            continue
        if unknown(v):
            return v
        m = re.fullmatch(r"""url\(\s*(['"]?)#([\w:.-]+)\1\s*\)""", v.strip())
        mk = None
        if m:
            found = [e for e in fig.els if e.tag == "marker" and e.names.get("id") and not unknown(literal(*e.names["id"])) and literal(*e.names["id"]) == m.group(2)]
            mk = found[0] if len(found) == 1 else None
        if mk is None:
            return Unknown(f'its {prop} "{v}" does not name one marker in the figure')
        dims = []
        for k, dflt in (("markerWidth", 3.0), ("markerHeight", 3.0)):
            q, val = mk.names.get(k, (None, None))
            if q is None:
                dims.append(dflt)
                continue
            n = _num((q, val)) if q == "{" else (float(val) if NUMBER.fullmatch((val or "").strip()) else None)
            if n is None:
                return Unknown(f"the marker's {k} is not a plain number")
            dims.append(n)
        q, units = mk.names.get("markerUnits", (None, None))
        units = literal(q, units) if q else "strokeWidth"
        ov = mk.names.get("overflow")
        if unknown(units) or units not in ("strokeWidth", "userSpaceOnUse") or (ov and literal(*ov) != "hidden") or mk.style:
            return Unknown("a marker whose size, units or overflow the guard cannot read")
        scale = 1.0 if units == "userSpaceOnUse" else sw
        reach = max(reach, (dims[0] + dims[1]) * scale)
    return reach


def draw_box(fig, el):
    """A generous box (x0, y0, x1, y1) of what el draws where it stands: its
    geometry padded by twice its stroke width (joins and caps) and by the reach
    of its markers; a text's estimated box. None for an element that draws
    nothing in place (a <g>, anything in <defs> or a <marker>, a <title>, a
    tspan that flows in its text); Unknown when it cannot be placed."""
    tag = el.tag
    if tag in NOT_DRAWN:
        return None
    pres = Presentation(el)
    if pres.context is not None:
        return None
    if tag in ("text", "tspan"):
        return text_box(el)
    if pres.unknown:
        return Unknown(pres.unknown)
    if pres.transformed:
        return Unknown("it is transformed or inside a transformed group")
    if tag in ("rect", "circle", "ellipse"):
        g = geometry(el)
        if unknown(g):
            return g
        pts = [g[0][:2], g[0][2:]]
    elif tag == "line":
        vals = [plain_number(el, k, 0.0) for k in ("x1", "y1", "x2", "y2")]
        if any(unknown(v) for v in vals):
            return Unknown("its x1, y1, x2 or y2 is not a plain number")
        pts = [(vals[0], vals[1]), (vals[2], vals[3])]
    elif tag in ("polyline", "polygon"):
        v = el.own("points")
        if v is None or unknown(v):
            return Unknown("its points are missing or not a plain string")
        nums = re.findall(NUMBER.pattern, v)
        if re.sub(NUMBER.pattern + r"|[\s,]", "", v) or not nums or len(nums) % 2:
            return Unknown("its points cannot be read")
        f = [float(n) for n in nums]
        pts = list(zip(f[0::2], f[1::2]))
    elif tag == "path":
        v = el.own("d")
        if v is None or unknown(v):
            return Unknown("its d is missing or not a plain string")
        pts = path_points(v)
        if unknown(pts):
            return pts
    else:
        return Unknown(f"a <{tag}> the guard does not place")
    sw = pres.stroke_width
    if unknown(sw):
        return sw
    pad = 0.0 if pres.stroke in (None, "none") else 2 * sw
    reach = marker_extent(fig, el, sw)
    if unknown(reach):
        return reach
    pad += reach
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return (min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad)


def boxes_meet(a, b):
    return a[0] <= b[2] and b[0] <= a[2] and a[1] <= b[3] and b[1] <= a[3]


def drawn_before(fig, el, box):
    """None if nothing drawn before el in the figure (its own ancestors apart)
    has a box that meets `box`, else the reason: (line, tag, why)."""
    chain = {id(e) for e in el.chain()}
    for other in fig.els[1:fig.els.index(el)]:
        if id(other) in chain:
            continue
        b = draw_box(fig, other)
        if b is None:
            continue
        line = other.line(fig.fm.masked)
        if unknown(b):
            return f"the <{other.tag}> at line {line}, drawn before it, cannot be placed ({b.why}), so it may lie under the fill"
        if boxes_meet(b, box):
            return f"the <{other.tag}> at line {line} is drawn before it and lies inside its box (estimated {b[0]:.0f},{b[1]:.0f} to {b[2]:.0f},{b[3]:.0f}), so the fill would cover it"
    return None


def visible_text(masked, a, b, tagspans, skip=()):
    """The words of masked[a:b] with every tag (and its attributes) and every
    span in skip blanked out."""
    chars = list(masked[a:b])
    for s, e in list(tagspans) + list(skip):
        for i in range(max(s, a), min(e, b)):
            chars[i - a] = " "
    return re.sub(r"\s+", " ", "".join(chars)).strip()


def _wordless(part):
    """True for a chunk with no prose in it: only JSX comments, import or
    export lines, empty expressions and whitespace."""
    s = re.sub(r"\{\s*/\*[\s\S]*?\*/\s*\}", " ", part)
    s = re.sub(r"(?m)^\s*(?:import|export)\b.*$", " ", s)
    s = re.sub(r"\{\s*(?:\"\s*\"|'\s*'|`\s*`)?\s*\}", " ", s)
    s = re.sub(r"<!--[\s\S]*?-->", " ", s)
    return not s.strip()


def _paragraph(chunk, last):
    """The paragraph nearest the figure in chunk (the last one before it, or the
    first one after it), skipping chunks with no prose (_wordless)."""
    parts = [p for p in re.split(r"\n[ \t]*\n", chunk) if p.strip() and not _wordless(p)]
    return (parts[-1] if last else parts[0]) if parts else ""


class FileModel:
    """Elements, tag spans and figure models of one (code-masked) lesson."""

    def __init__(self, masked, opens, closes):
        self.masked, self.opens, self.closes = masked, opens, closes
        self.tagspans = [(ta, tb + 1) for ta, tb, _ in opens]
        for c, _ in closes:
            g = masked.find(">", c)
            self.tagspans.append((c, len(masked) if g < 0 else g + 1))
        # Whole-file element spans (start, end, name), for the figure's context.
        events = sorted([(ta, 0, tb, name) for ta, tb, name in opens] + [(c, 1, None, name) for c, name in closes])
        stack, self.spans = [], []
        for pos, kind, tb, name in events:
            if kind == 0:
                if masked[tb - 1:tb] == "/":
                    self.spans.append((pos, tb + 1, name))
                else:
                    stack.append((pos, name))
            elif any(n == name for _, n in stack):
                while stack:
                    s, n = stack.pop()
                    if n == name:
                        g = masked.find(">", pos)
                        self.spans.append((s, len(masked) if g < 0 else g + 1, n))
                        break
        self.figs = {}

    def figure(self, svg_a, svg_b):
        key = (svg_a, svg_b)
        if key not in self.figs:
            self.figs[key] = Figure(self, svg_a, svg_b)
        return self.figs[key]


class Figure:
    """The elements of one <svg> (svg_a is its `<`, svg_b the `<` of its </svg>)."""

    def __init__(self, fm, svg_a, svg_b):
        masked = fm.masked
        self.fm, self.a, self.b = fm, svg_a, svg_b
        self.opaque = None  # why the figure as a whole takes no modifier
        self.els, self.by_start = [], {}
        events = sorted([(ta, 0, tb, tag) for ta, tb, tag in fm.opens if svg_a <= ta < svg_b] + [(c, 1, None, n) for c, n in fm.closes if svg_a < c <= svg_b])
        stack, pos, root = [], None, None

        def take_text(i, j):
            # Literal text between tags goes to the element on top of the stack.
            k = i
            while k < j:
                c = masked[k]
                if c == "{":
                    e = _skip_expr(masked, k + 1)
                    v = literal("{", masked[k + 1:e - 1])
                    if re.fullmatch(r"\s*/\*[\s\S]*?\*/\s*", masked[k + 1:e - 1]):
                        v = ""
                    if unknown(v):
                        self.opaque = self.opaque or f"a {{…}} expression inside the svg ({v.why})"
                        if stack:
                            stack[-1].text_unknown = "an expression in its text"
                    elif stack:
                        stack[-1].text.append(v)
                    k = e
                    continue
                if stack:
                    stack[-1].text.append(c)
                k += 1

        for p, kind, tb, tag in events:
            if pos is not None and p > pos:
                take_text(pos, p)
            if kind == 0:
                attrs = parse_attrs(masked, p + 1 + len(tag), tb)
                el = El(tag, p, tb, stack[-1] if stack else None, attrs)
                if root is None:
                    root = el
                elif tag == "svg" or tag not in KNOWN_SVG_TAGS:
                    self.opaque = self.opaque or f"a <{tag}> inside the svg, which the guard cannot see into"
                if el.why == "a spread {...} attribute":
                    self.opaque = self.opaque or f"a spread attribute on <{tag}>"
                if el.parent:
                    el.parent.children.append(el)
                self.els.append(el)
                self.by_start[p] = el
                if masked[tb - 1:tb] != "/":
                    stack.append(el)
                pos = tb + 1
            else:
                if any(e.tag == tag for e in stack):
                    while stack and stack.pop().tag != tag:
                        pass
                g = masked.find(">", p)
                pos = len(masked) if g < 0 else g + 1
        self.root = root
        self._context = None

    def texts(self):
        return [e for e in self.els if e.tag in ("text", "tspan")]

    def context_words(self):
        """Appearance words in everything that describes the figure: the text
        of its <figure> (or innermost wrapper) outside the svg, every
        attribute of every element there and of every element that encloses
        the svg, the svg's aria-label, its <title>, <desc> and <text>, the
        elements its aria-labelledby and aria-describedby name (wherever they
        stand in the lesson), and the paragraph before and after. Unknown when
        any of it cannot be read: a {…} expression that is not a literal (a
        caption={cap} whose words live in a constant), an aria reference to an
        id that is not exactly one element of the lesson. A JSX literal
        (caption={<>…</>}) is read as its text."""
        if self._context is not None:
            return self._context
        fm, masked = self.fm, self.fm.masked
        close = masked.find(">", self.b)
        svg_end = len(masked) if close < 0 else close + 1
        around = [s for s in fm.spans if s[0] < self.a and s[1] >= svg_end]
        figures = [s for s in around if s[2] == "figure"]
        if figures:
            block = max(figures, key=lambda s: s[0])
        elif around:
            block = min(around, key=lambda s: s[0])
        else:
            block = (self.a, svg_end, "svg")
        starts = {ta: (tb, name) for ta, tb, name in fm.opens}
        words, refs = [], []

        def fail(why):
            self._context = Unknown(why)
            return self._context

        # The block (figure or wrapper) outside the svg: its text, its
        # expressions and the attributes of its elements.
        got = region_words(fm, block[0], block[1], [(self.a, svg_end)], refs)
        if unknown(got):
            return fail(got.why)
        words += got
        # Every attribute of every element that encloses the svg (a <figure
        # aria-label>, a wrapper's caption, title, rule or mistake prop):
        # wrappers render these around the figure.
        for s0, _, name in around:
            tb = starts.get(s0, (None,))[0]
            if tb is None:
                continue
            got = attr_words(masked, s0, tb, name, refs)
            if unknown(got):
                return fail(got.why)
            words += got
        # The svg's own attributes (aria-label, aria-labelledby, …) and the
        # words and aria references of its parts.
        for e in self.els:
            got = attr_words(masked, e.ta, e.tb, e.tag, refs, aria_only=True)
            if unknown(got):
                return fail(got.why)
            words += got
        words += ["".join(e.text) for e in self.els if e.tag in ("text", "tspan", "title", "desc")]
        # aria-labelledby and aria-describedby: the named elements' text.
        for ids in refs:
            for i in ids.split():
                hits = [(ta, tb, name) for ta, tb, name in fm.opens
                        if any(n == "id" and q in ('"', "'") and v == i for n, q, v, _, _ in parse_attrs(masked, ta + 1 + len(name), tb))]
                if len(hits) != 1:
                    return fail(f'an aria reference names the id "{i}", which is not exactly one element of the lesson')
                ta, tb, name = hits[0]
                span = next((sp for sp in fm.spans if sp[0] == ta), (ta, tb + 1, name))
                got = region_words(fm, span[0], span[1], [], [], attrs=False)
                if unknown(got):
                    return fail(got.why)
                words += got
        before = masked[:block[0]]
        after = masked[block[1]:]
        para_b = _paragraph(before, True)
        para_a = _paragraph(after, False)
        if para_b:
            start = before.rfind(para_b)
            got = region_words(fm, start, start + len(para_b), [], [], attrs=False)
            if unknown(got):
                return fail(f"the paragraph before the figure: {got.why}")
            words += got
        if para_a:
            start = block[1] + after.find(para_a)
            got = region_words(fm, start, start + len(para_a), [], [], attrs=False)
            if unknown(got):
                return fail(f"the paragraph after the figure: {got.why}")
            words += got
        found = sorted({m.group(0).lower() for w in words for m in APPEARANCE.finditer(w)} | {m.group(0) for w in words for m in APPEARANCE_GLYPHS.finditer(w)})
        self._context = found
        return found


def expr_words(src):
    """The words of a {…} expression's inside src: a string, number or template
    literal (no ${}), a comment, a JSX literal whose own {…} are readable, or
    an object of such literals; else Unknown."""
    s = src.strip()
    if not s or re.fullmatch(r"/\*[\s\S]*?\*/", s):
        return ""
    v = literal("{", s)
    if not unknown(v):
        return v
    if s.startswith("<") and _skip_jsx(s, 0) >= len(s.rstrip()):
        return jsx_words(s)
    if s.startswith("{") and s.endswith("}"):
        st = parse_style("{", s)
        if not unknown(st) and not any(unknown(x) for x in st.values()):
            return " ".join(f"{k} {x}" for k, x in st.items())
    return Unknown(f"the expression {{{s[:50]}}}, whose words the guard cannot read")


def jsx_words(s):
    """The raw text of a JSX literal (tags and all, so every word counts), or
    Unknown when an expression inside it is not readable."""
    out, i, in_tag = [], 0, False
    while i < len(s):
        c = s[i]
        if in_tag and c in "\"'":
            j = _skip_string(s, i)
            out.append(s[i:j])
            i = j
            continue
        if c == "<":
            in_tag = True
        elif c == ">":
            in_tag = False
        if c == "{":
            e = _skip_expr(s, i + 1)
            w = expr_words(s[i + 1:e - 1])
            if unknown(w):
                return w
            out.append(" " + w + " ")
            i = e
            continue
        out.append(c)
        i += 1
    return "".join(out)


# Attributes that no component renders as words: never read as words, and an
# expression in them is not refused. Everything else on a wrapper or on an
# element beside the svg (a caption, a title, a rule, an aria-label) may be
# rendered around the figure, so it must be readable.
NON_WORD_ATTRS = ("className", "class", "style", "id", "key")
ARIA_WORD_ATTRS = ("aria-label", "aria-labelledby", "aria-describedby")


def attr_words(masked, ta, tb, name, refs, aria_only=False):
    """The attribute values of the opening tag at masked[ta:tb] as words, with
    the ids named by aria-labelledby and aria-describedby added to refs;
    Unknown when a value is an expression the guard cannot read. With
    aria_only (the svg and its parts, whose other attributes are
    presentation the figure model reads), only the aria attributes count."""
    out = []
    for n, q, v, _, _ in parse_attrs(masked, ta + 1 + len(name), tb):
        if n == "...":
            if aria_only:
                continue
            return Unknown(f"a spread attribute on <{name}>, whose props the guard cannot read")
        if n in NON_WORD_ATTRS or (aria_only and n not in ARIA_WORD_ATTRS) or v is None:
            continue
        w = expr_words(v) if q == "{" else v
        if unknown(w):
            return Unknown(f"the {n} of <{name}> is {w.why}")
        if n in ("aria-labelledby", "aria-describedby"):
            if q == "{" and unknown(literal(q, v)):
                return Unknown(f"the {n} of <{name}> is not a plain string")
            refs.append(w)
        out.append(w)
    return out


def region_words(fm, a, b, skip, refs, attrs=True):
    """The words of masked[a:b] (tags blanked, spans in skip left out), with
    attrs the attribute words of every tag that opens there (attr_words), and
    the words of every {…} in text position; Unknown when an expression
    cannot be read. Inline code spans are read as text."""
    masked = fm.masked
    words = [visible_text(masked, a, b, fm.tagspans, skip)]
    for ta, tb, name in fm.opens:
        if attrs and a <= ta < b and not any(s0 <= ta < s1 for s0, s1 in skip):
            got = attr_words(masked, ta, tb, name, refs)
            if unknown(got):
                return got
            words += got
    i = a
    tags = sorted(list(fm.tagspans) + list(skip))
    k = 0
    while i < b:
        while k < len(tags) and tags[k][1] <= i:
            k += 1
        if k < len(tags) and tags[k][0] <= i < tags[k][1]:
            i = tags[k][1]
            continue
        c = masked[i]
        if c == "`":
            j, nl = masked.find("`", i + 1), masked.find("\n", i + 1)
            i = j + 1 if j >= 0 and (nl < 0 or j < nl) else i + 1
            continue
        if c == "{":
            e = _skip_expr(masked, i + 1)
            w = expr_words(masked[i + 1:e - 1])
            if unknown(w):
                return w
            words.append(w)
            i = e
            continue
        i += 1
    return words


def marker_refs_agree(fig, marker, role):
    """None if every element that uses `marker` carries `role` (and at least
    one does), else the reason it cannot be proved."""
    q, v = marker.names.get("id", (None, None))
    mid = literal(q, v) if q else Unknown("no id")
    if unknown(mid) or not mid:
        return "the marker's id is not a plain string"
    masked = fig.fm.masked
    if len(re.findall(r"""\bid\s*=\s*(?:"|'|\{\s*["'])""" + re.escape(mid) + r"""["']""", masked)) != 1:
        return f'the id "{mid}" is not unique in the lesson'
    # Every "#id" in the lesson is a reference (url(#id), url('#id'),
    # url("#id"), an href, prose): each must be a markerStart, markerMid or
    # markerEnd string that is exactly url(#id), quoted or not, on a line that
    # carries the role; anything else blocks.
    refs = list(re.finditer(r"#" + re.escape(mid) + r"(?![\w-])", masked))
    if not refs:
        return f'no line uses the marker "{mid}"'
    exact = re.compile(r"""\s*url\(\s*(['"]?)#""" + re.escape(mid) + r"""\1\s*\)\s*""")
    for m in refs:
        tag = next(((ta, tb, name) for ta, tb, name in fig.fm.opens if ta < m.start() < tb), None)
        if not tag:
            return f'"#{mid}" appears outside a tag (line {masked.count(chr(10), 0, m.start()) + 1}), so every use of the marker cannot be checked'
        ta, tb, name = tag
        attrs = parse_attrs(masked, ta + 1 + len(name), tb)
        hit = [(n, q2, val) for n, q2, val, s, e in attrs if s <= m.start() < e]
        if not hit or kebab(hit[0][0]) not in ("marker-start", "marker-mid", "marker-end") or hit[0][1] not in ('"', "'") or not exact.fullmatch(hit[0][2] or ""):
            return f'the marker "{mid}" is referenced other than as a markerStart, markerMid or markerEnd string url(#{mid}) (line {masked.count(chr(10), 0, ta) + 1})'
        fig_attr = next((val for n, q2, val, s, e in attrs if n == "data-fig" and q2 == '"'), "")
        if role not in fig_attr.split():
            return f'a line that uses the marker "{mid}" (line {masked.count(chr(10), 0, ta) + 1}) does not carry data-fig "{role}"'
    return None


def fig_rule(fig, el, role, mod, assume_label=False):
    """None if data-fig with `role` and modifier `mod` ("tint", "solid" or None)
    is provably safe on `el`, else the reason. With assume_label, rule B's
    "a text in the figure carries the same role" is not checked (the scan asks
    what a part could take before any label is marked)."""
    tag = el.tag
    if tag not in FIG_ROLE_TAGS:
        return f"data-fig on <{tag}>: a role goes only on a {', '.join(FIG_ROLE_TAGS)} (never on a <g>, <svg>, <marker>, <use>, <defs>, <title> or <desc>, where it would colour parts the guard cannot check)"
    pres = Presentation(el)
    if pres.unknown:
        return f"the guard cannot evaluate this <{tag}>'s presentation ({pres.unknown}), so it takes no role"
    if pres.context == "marker":
        if mod:
            return f'"{mod}" inside a <marker>: an arrowhead takes a plain role at most'
        if tag in ("text", "tspan"):
            return "a text inside a <marker>"
        if pres.fill == "currentColor" and pres.alpha < 1:
            return f"a <{tag}> filled in currentColor at opacity {pres.alpha:g}: the role colour would wash out"
        marker = next(e for e in el.chain()[1:] if e.tag == "marker")
        why = marker_refs_agree(fig, marker, role)
        return None if why is None else f"a role on a marker's shape needs every line that uses the marker to carry the same role: {why}"
    if pres.context is not None:
        return f"a <{tag}> inside <{pres.context}> is not drawn where it stands"
    if mod is None:
        if tag in CLOSED_TAGS and pres.fill != "none":
            return f'a plain role on a <{tag}> whose effective fill is {pres.fill!r}: it goes on a {", ".join(CLOSED_TAGS)} only when its fill is none (a role would recolour a filled shape)'
        if pres.fill == "currentColor" and pres.alpha < 1:
            return f"a <{tag}> filled in currentColor at effective opacity {pres.alpha:g}: the role colour would wash out"
        return None
    # Modifiers.
    if mod == "tint" and tag not in TINT_TAGS:
        return f'"tint" on a <{tag}>: tint goes on a rect only'
    if mod == "solid" and tag not in SOLID_TAGS:
        return f'"solid" on a <{tag}>: solid goes on a rect, circle or ellipse only'
    if fig.opaque:
        return f'"{mod}": the figure holds {fig.opaque}'
    if pres.transformed:
        return f'"{mod}" on a <{tag}> that is transformed or inside a transformed group: its box cannot be checked'
    if pres.dash != "none":
        return f'"{mod}" on a dashed <{tag}> (the dash may be inherited from a group): the dash or the emptiness is a cue a fill would hide'
    geo = geometry(el)
    if unknown(geo):
        return f'"{mod}" on a <{tag}>: {geo.why}'
    words = fig.context_words()
    if unknown(words):
        return f'"{mod}": {words.why}'
    if mod == "tint":
        q, v = el.names.get("fill", (None, None))
        if pres.fill != "none" or q not in ('"', "'") or v != "none":
            return f'"tint" on a rect whose fill is {pres.fill!r}: tint goes only on a rect with fill="none" written on it'
        for other in fig.els:
            if other.tag not in FILLABLE_TAGS or other is el:
                continue
            op = Presentation(other)
            if op.context == "marker":
                continue
            if unknown(op.fill) or op.unknown:
                return f'"tint": the <{other.tag}> at line {other.line(fig.fm.masked)} has a fill the guard cannot evaluate ({op.unknown})'
            if op.fill != "none":
                return f'"tint" in a figure with a filled <{other.tag}> (line {other.line(fig.fm.masked)}, fill {op.fill!r}): filled against hollow may be an encoding here'
        # The box must draw a visible currentColor outline: a tint on a rect
        # that draws nothing adds a grouping the author never drew.
        if pres.stroke != "currentColor":
            return f'"tint" on a rect whose effective stroke is {pres.stroke!r}: tint goes only on a box drawn with a visible currentColor outline (a tint on a rect that draws nothing adds a box that was not in the figure)'
        if unknown(pres.stroke_alpha) or pres.stroke_alpha <= 0:
            return f'"tint" on a rect whose outline is drawn at stroke opacity {pres.stroke_alpha!r}: the box is not visible, and a tint would add it'
        if unknown(pres.stroke_width) or pres.stroke_width <= 0:
            return f'"tint" on a rect whose stroke width is {pres.stroke_width!r}: the box is not visible, and a tint would add it'
        own = draw_box(fig, el)
        if unknown(own):
            return f'"tint": its box cannot be placed ({own.why})'
        why = drawn_before(fig, el, own)
        if why:
            return f'"tint" on a box drawn after a part inside it: {why} (draw the box first, then its label and lines)'
    else:
        q, v = el.names.get("fill", (None, None))
        if pres.fill != "currentColor" or q not in ('"', "'") or v != "currentColor":
            return f'"solid" on a <{tag}> whose fill is {pres.fill!r}: solid goes only on a shape with fill="currentColor" written on it'
        if pres.alpha <= 0:
            return f'"solid" on a <{tag}> whose effective opacity is 0: it is drawn empty, and solid would fill it'
        if pres.alpha < SOLID_MIN_ALPHA:
            return f'"solid" on a <{tag}> whose effective opacity is {pres.alpha:g}, below {SOLID_MIN_ALPHA:g}: it reads as empty or nearly so, and solid would draw it at full strength'
        for k in ("fill-opacity", "opacity"):
            v = el.own(k)
            if v is not None and not PLAIN_ALPHA.fullmatch(v):
                return f'"solid" on a <{tag}> whose own {k} is written "{v}": write it as a plain decimal such as 0.6 (the CSS reads the attribute and cannot compare a percentage)'
        box, size = geo
        same = 0
        for other in fig.els:
            if other.tag != tag:
                continue
            og = geometry(other)
            if unknown(og):
                return f'"solid": another <{tag}> (line {other.line(fig.fm.masked)}) has geometry the guard cannot read, so a grid cannot be ruled out'
            same += og[1] == size
        if same >= 3:
            return f'"solid" on one of {same} <{tag}>s of the same size: a grid or ladder, whose shading would be erased'
        own = draw_box(fig, el)
        if unknown(own):
            return f'"solid": its box cannot be placed ({own.why})'
        if not assume_label and not any(role in t.tokens() for t in fig.texts()):
            return f'"solid" needs a label: a <text> or <tspan> in the figure with data-fig carrying "{role}"'
        for t in fig.texts():
            tbox = text_box(t)
            if tbox is None:
                continue
            if unknown(tbox):
                return f'"solid": a text at line {t.line(fig.fm.masked)} cannot be placed ({tbox.why}), so text on the fill cannot be ruled out'
            if boxes_meet(tbox, own):
                return f'"solid" on a <{tag}> that a text overlaps (line {t.line(fig.fm.masked)}, estimated box {tbox[0]:.0f},{tbox[1]:.0f} to {tbox[2]:.0f},{tbox[3]:.0f}): never put text on a solid fill'
        why = drawn_before(fig, el, own)
        if why:
            return f'"solid" makes the mark opaque, and {why}'
    if words:
        return f'"{mod}": the caption, the figure\'s own words or the paragraph beside it use the appearance word(s) {", ".join(words)}, which a fill could make false'
    return None


def normalise(text, label):
    """Remove allowed roles and data-fig attributes; return (text, errors, marks).

    `marks` maps each removal's offset in the returned text to what was removed
    there (("role", value) or ("data-fig", value)), so two files whose
    normalised texts agree can be compared for meaning changes."""
    errors = []
    lineno = lambda pos: text.count("\n", 0, pos) + 1
    masked = mask_code(text)
    opens, closes = scan_tags(masked)
    roles = role_regions(masked, opens)
    svgs = blocks(masked, opens, closes, "svg")
    fm = FileModel(masked, opens, closes)
    cuts = []

    keys = []
    for a, b in roles:
        keys.extend(top_level_roles(masked, a, b))
    for m in re.finditer(r"""(?<![\w-])["']?role["']?\s*:\s*["']""", masked):
        if not inside(m.start(), roles):
            errors.append(f"{label}:{lineno(m.start())}: a role property outside the nodes or participants of a kit figure")
    for start, cut_a, cut_b, value in keys:
        if value == "\0\0duplicate":
            errors.append(f"{label}:{lineno(start)}: an object with more than one role key (the last one wins in JS); keep one")
        elif "\0" in value:
            role, kind = value.split("\0")
            errors.append(f'{label}:{lineno(start)}: role "{role}" disagrees with kind "{kind}"; drop the role or make them agree')
        elif value not in KIT_ROLES:
            errors.append(f'{label}:{lineno(start)}: role "{value}" is not allowed (use one of {", ".join(KIT_ROLES)})')
        else:
            cuts.append((cut_a, cut_b, ("role", value)))

    # data-fig counts only as a top-level attribute of an opening tag; written in
    # a tag's text content, or inside another attribute's value or a {…}
    # expression, it is words and stays in the comparison.
    for ta, tb, tag in opens:
        if tb >= len(masked):
            errors.append(f"{label}:{lineno(ta)}: <{tag}> never closes; check its quotes and braces")
            continue
        body = masked[ta:tb]
        if inside(ta, svgs) and re.search(r"</?svg\b", body[1:]):
            errors.append(f"{label}:{lineno(ta)}: <{tag}> runs past its </svg>; check its quotes and braces")
            continue
        attrs = parse_attrs(masked, ta + 1 + len(tag), tb)
        names = {n: (q, v) for n, q, v, _, _ in attrs}
        if sum(1 for n, *_ in attrs if n == "data-fig") > 1:
            errors.append(f"{label}:{lineno(ta)}: <{tag}> has more than one data-fig attribute (the last one wins in JSX); keep one")
            continue
        for name, q, value, s, e in attrs:
            if name != "data-fig":
                continue
            ln = lineno(s)
            if q != '"' or not masked.startswith('data-fig="', s):
                errors.append(f'{label}:{ln}: write data-fig as data-fig="…" with double quotes')
                continue
            if not inside(ta, svgs):
                errors.append(f"{label}:{ln}: data-fig outside an <svg>")
                continue
            if tag not in FIG_ROLE_TAGS:
                errors.append(f'{label}:{ln}: data-fig on <{tag}>: a role goes only on a {", ".join(FIG_ROLE_TAGS)}; never on a <g>, <svg>, <marker>, <use>, <defs>, <title> or <desc>, where it would colour parts the guard cannot check or draw nothing')
                continue
            tokens = value.split()
            bad = [t for t in tokens if t not in FIG_TOKENS]
            if bad or not tokens:
                errors.append(f'{label}:{ln}: data-fig="{value}" has a value that is not allowed: {", ".join(bad) or "(empty)"}')
                continue
            if len(set(tokens)) != len(tokens):
                errors.append(f'{label}:{ln}: data-fig="{value}" repeats a token')
                continue
            if sum(t in FIG_ROLES for t in tokens) > 1:
                errors.append(f'{label}:{ln}: data-fig="{value}" has more than one role; a part takes one meaning (the CSS would draw whichever rule comes last)')
                continue
            roles = [t for t in tokens if t in FIG_ROLES]
            mods = [t for t in tokens if t in MODIFIERS]
            if mods and not roles:
                errors.append(f'{label}:{ln}: data-fig="{value}": a modifier ("tint" or "solid") goes only together with a role (data-fig="<role> {mods[0]}")')
                continue
            if len(mods) > 1:
                errors.append(f'{label}:{ln}: data-fig="{value}": use "tint" (a hollow box) or "solid" (a filled mark), never both')
                continue
            svg = next((a, b) for a, b in svgs if a <= ta < b)
            fig = fm.figure(*svg)
            el = fig.by_start.get(ta)
            why = "the guard did not find this tag in its figure" if el is None else fig_rule(fig, el, roles[0], mods[0] if mods else None)
            if why:
                errors.append(f'{label}:{ln}: data-fig="{value}" on <{tag}>: {why}')
                continue
            ws = s
            while ws > ta and masked[ws - 1].isspace():
                ws -= 1
            cuts.append((ws, e, ("data-fig", value)))

    out, marks, removed = [], {}, 0
    pos = 0
    for s, e, what in sorted(set(cuts)):
        if s < pos:
            continue
        out.append(text[pos:s])
        marks.setdefault(s - removed, []).append(what)
        removed += e - s
        pos = e
    out.append(text[pos:])
    return "".join(out), errors, marks


def meaning_notes(base_marks, cur_marks, cur_norm, label):
    """Roles or data-fig values that the base had and the current file drops or changes."""
    notes = []
    lineno = lambda pos: cur_norm.count("\n", 0, pos) + 1
    for pos, was in sorted(base_marks.items()):
        now = cur_marks.get(pos, [])
        for what in was:
            if what in now:
                continue
            same_kind = [w for w in now if w[0] == what[0]]
            if same_kind:
                notes.append(f'{label}:{lineno(pos)}: note: {what[0]} "{what[1]}" changed to "{same_kind[0][1]}"')
            else:
                notes.append(f'{label}:{lineno(pos)}: note: {what[0]} "{what[1]}" removed')
    return notes


def check(base_text, cur_text, label="file", strict=False, all_findings=False):
    """Return (ok, message). With strict, a meaning note (a role or data-fig the
    base had, dropped or changed) fails the file. With all_findings, a finding
    the base already had fails too (to prove a lesson as it stands obeys the rules)."""
    cur_norm, errors, cur_marks = normalise(cur_text, label)
    base_norm, base_errors, base_marks = normalise(base_text, label)
    # A finding the base file already had (say, `role: "x"` in an old code sample) is not this pass's doing.
    strip = lambda e: re.sub(r"^[^:]*:\d+: ", "", e)
    old = [] if all_findings else [strip(e) for e in base_errors]
    fresh = []
    for e in errors:
        if strip(e) in old:
            old.remove(strip(e))
        else:
            fresh.append(e)
    errors = fresh
    if errors:
        return False, "\n".join(errors)
    if cur_norm == base_norm:
        notes = meaning_notes(base_marks, cur_marks, cur_norm, label)
        if notes and strict:
            return False, f"{label}: --strict: roles or data-fig the base had were dropped or changed\n" + "\n".join(notes) + "\n(run without --strict if the change is deliberate, and say why in review)"
        msg = f"{label}: ok (only allowed roles and data-fig differ from the base)"
        if notes:
            msg += "\n" + "\n".join(notes) + "\n(the words and geometry are unchanged, but a reviewer should check these meaning changes)"
        return True, msg
    diff = list(difflib.unified_diff(base_norm.splitlines(True), cur_norm.splitlines(True), f"{label} (base, roles removed)", f"{label} (now, roles removed)", n=2))
    hunk = []
    seen = 0
    for line in diff:
        if line.startswith("@@"):
            seen += 1
            if seen > 1:
                break
        hunk.append(line)
    return False, f"{label}: changes other than roles and data-fig. First differing hunk:\n" + "".join(hunk)


def git_show(ref, path):
    path = os.path.abspath(path)
    top = subprocess.run(["git", "-C", os.path.dirname(path), "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True).stdout.strip()
    rel = os.path.relpath(os.path.realpath(path), os.path.realpath(top))
    res = subprocess.run(["git", "-C", top, "show", f"{ref}:{rel}"], capture_output=True)
    if res.returncode != 0:
        raise FileNotFoundError(f"{rel} does not exist at {ref}: {res.stderr.decode().strip()}")
    return res.stdout.decode("utf8")


SVG_BASE = """<figure>
<svg viewBox="0 0 100 40" role="img" aria-label={'count<max then stop'}>
  <rect x="0" y="0" width="60" height="10" fill="currentColor" fillOpacity="0.6" />
  <text x="0" y="30" fill="currentColor">Testbench</text>
  <rect x="70" y="0" width="20" height="10" fill="none" stroke="currentColor" strokeDasharray="3 2" />
  <path d="M0 0 L10 10 L20 0" fill="none" stroke="currentColor" />
  <rect x="70" y="20" width="20" height="10" fill="currentColor" strokeDasharray="2 2" />
  <text x="40" y="30" fill="currentColor">{'a<b holds'}</text>
  <defs><marker id="head"><path d="M1,1 L9,5 L1,9" fill="none" stroke="currentColor" strokeWidth="1" /></marker></defs>
  <rect x="0" y="12" width="8" height="6" fill="currentColor" fillOpacity="0.0" />
  <rect x="20" y="12" width="10" height="6" fill="currentColor" fillOpacity="0.3" />
  <text x="22" y="17" fill="currentColor">●</text>
  <polyline points="0,40 10,35 20,38" fill="none" stroke="currentColor" strokeWidth="2" />
  <g transform="translate(0 0)"><rect x="40" y="12" width="10" height="6" fill="none" stroke="currentColor" strokeWidth="1.5" /></g>
</svg>
<figcaption>The testbench bar is longer.</figcaption>
</figure>
"""
KIT_BASE = """Some text about the role of a design.

<ArchitectureDiagram
  title="Bus"
  caption="Two blocks."
  nodes={[
    { id: "m", label: "Master", kind: "generic", col: 0, row: 0 },
    { id: "s", label: "Slave", col: 1, row: 0 }
  ]}
  edges={[{ from: "m", to: "s", style: "data", label: "HADDR" }]}
/>

<SequenceDiagram
  title="Call"
  caption="One call."
  participants={[
    { id: "a", label: "A" },
    { "id": "b", "label": "B" }
  ]}
  messages={[{ from: "a", to: "b", label: "go" }]}
/>
"""


def _doc(body, caption="Two parts.", before="Some prose.", after="More prose.", aria='"A small figure"', root=""):
    return (
        f"{before}\n\n<figure>\n<svg viewBox=\"0 0 300 120\" role=\"img\" aria-label={aria}{root}>\n{body}\n</svg>\n"
        f"<figcaption>{caption}</figcaption>\n</figure>\n\n{after}\n"
    )


# A bar chart: one bar with its label beside it, a dot, a value.
BARS = """  <text x="0" y="12" fontSize="10" fill="currentColor">Testbench</text>
  <rect x="80" y="2" width="120" height="12" fill="currentColor" fillOpacity="0.6" />
  <text x="205" y="12" fontSize="10" fill="currentColor">60%</text>
  <text x="0" y="40" fontSize="10" fill="currentColor">Design</text>
  <circle cx="90" cy="36" r="5" fill="currentColor" />"""
LABEL_TB = ('fill="currentColor">Testbench', 'fill="currentColor" data-fig="testbench">Testbench')
LABEL_D = ('fill="currentColor">Design', 'fill="currentColor" data-fig="design">Design')
BAR_SOLID = ('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="testbench solid" />')
DOT_SOLID = ('r="5" fill="currentColor" />', 'r="5" fill="currentColor" data-fig="design solid" />')
# Two hollow boxes joined by an arrow: no filled shape.
BOXES = """  <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3"><path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" /></marker></defs>
  <rect x="10" y="10" width="80" height="30" fill="none" stroke="currentColor" />
  <text x="50" y="30" fontSize="10" textAnchor="middle" fill="currentColor">Driver</text>
  <rect x="200" y="10" width="80" height="30" fill="none" stroke="currentColor" />
  <text x="240" y="30" fontSize="10" textAnchor="middle" fill="currentColor">DUT</text>
  <line x1="90" y1="25" x2="200" y2="25" stroke="currentColor" markerEnd="url(#arr)" />
  <polyline points="10,90 60,70 110,90" fill="none" stroke="currentColor" />"""
BOX_TINT = ('<rect x="200" y="10" width="80" height="30" fill="none" stroke="currentColor" />', '<rect x="200" y="10" width="80" height="30" fill="none" stroke="currentColor" data-fig="design tint" />')
LABEL_DUT = ('fill="currentColor">DUT', 'fill="currentColor" data-fig="design">DUT')


def _mark(text, *pairs):
    for old, new in pairs:
        assert old in text, old
        text = text.replace(old, new, 1)
    return text


def subset_cases():
    """(name, base, current, expect ok, a phrase the error must contain)."""
    cases = []

    def add(name, body, pairs, ok, why="", **kw):
        base = _doc(body, **kw)
        cases.append((name, base, _mark(base, *pairs), ok, why))

    # Passing cases.
    add("solid on a labelled bar and a labelled dot passes", BARS, [BAR_SOLID, LABEL_TB, DOT_SOLID, LABEL_D], True)
    add("solid on a bar under a group whose opacity is written as a percentage (0.6 x 80%) passes", BARS.replace('  <rect x="80"', '  <g opacity="80%"><rect x="80"').replace('fillOpacity="0.6" />', 'fillOpacity="0.6" /></g>'), [BAR_SOLID, LABEL_TB], True)
    add("solid on a bar at the floor's side (fillOpacity 0.25, the pilot's faintest bar) passes", BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.25"'), [('fillOpacity="0.25" />', 'fillOpacity="0.25" data-fig="testbench solid" />'), LABEL_TB], True)
    add("solid with color=\"currentColor\" written on the bar passes", BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.6" color="currentColor"'), [('color="currentColor" />', 'color="currentColor" data-fig="testbench solid" />'), LABEL_TB], True)
    add("solid whose label is bold but short passes", BARS.replace('fontSize="10" fill="currentColor">Testbench', 'fontSize="10" fontWeight="700" fill="currentColor">Testbench'), [BAR_SOLID, ('fontWeight="700" fill="currentColor">Testbench', 'fontWeight="700" fill="currentColor" data-fig="testbench">Testbench')], True)
    add("a plain role on a marker's shape whose lines all carry the role, one written url('#arr'), passes",
        BOXES + "\n  <line x1=\"90\" y1=\"35\" x2=\"200\" y2=\"35\" stroke=\"currentColor\" markerEnd=\"url('#arr')\" />",
        [('<path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" />', '<path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" data-fig="data" />'),
         ('y2="25" stroke="currentColor" markerEnd="url(#arr)" />', 'y2="25" stroke="currentColor" markerEnd="url(#arr)" data-fig="data" />'),
         ("y2=\"35\" stroke=\"currentColor\" markerEnd=\"url('#arr')\" />", "y2=\"35\" stroke=\"currentColor\" markerEnd=\"url('#arr')\" data-fig=\"data\" />")], True)
    # Percentages on the mark itself fail: the CSS reads the attribute and cannot compare one with the floor.
    add("solid on a bar whose own opacity is written as a percentage fails", BARS.replace('fillOpacity="0.6"', 'fillOpacity="60%"'), [('fillOpacity="60%" />', 'fillOpacity="60%" data-fig="testbench solid" />'), LABEL_TB], False, "plain decimal")
    add("solid with the label on a tspan passes", BARS.replace('fill="currentColor">Testbench</text>', 'fill="currentColor"><tspan>Testbench</tspan></text>'), [BAR_SOLID, ("<tspan>Testbench", '<tspan data-fig="testbench">Testbench')], True)
    add("solid under a root svg with layout classes passes", BARS, [BAR_SOLID, LABEL_TB], True, root=' className="w-full max-w-lg mx-auto"')
    add("tint on a hollow box in a figure with no filled shape passes", BOXES, [BOX_TINT, LABEL_DUT], True)
    add("plain roles on text, line, polyline, a hollow rect and a marker path whose line agrees pass", BOXES,
        [('fill="none" stroke="currentColor" />\n  <text x="50"', 'fill="none" stroke="currentColor" data-fig="testbench" />\n  <text x="50"'),
         ('fill="currentColor">Driver', 'fill="currentColor" data-fig="testbench">Driver'),
         ('markerEnd="url(#arr)" />', 'markerEnd="url(#arr)" data-fig="data" />'),
         ('<path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" />', '<path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" data-fig="data" />'),
         ('<polyline points="10,90 60,70 110,90" fill="none" stroke="currentColor" />', '<polyline points="10,90 60,70 110,90" fill="none" stroke="currentColor" data-fig="data" />')], True)
    add("a plain role on a rect whose fill none is inherited from a group passes", '  <g fill="none" stroke="currentColor"><rect x="10" y="10" width="80" height="30" /></g>',
        [('height="30" />', 'height="30" data-fig="design" />')], True)
    add("a plain role on a dashed hollow outline passes (it colours the dash, fills nothing)", '  <g fill="none" stroke="currentColor" strokeDasharray="3 3"><rect x="10" y="10" width="80" height="30" /></g>',
        [('height="30" />', 'height="30" data-fig="design" />')], True)
    add("a plain role on a path filled in currentColor at full opacity (an arrow) passes", '  <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" />', [('fill="currentColor" />', 'fill="currentColor" data-fig="data" />')], True)

    # B: inherited dash, inherited fill none, zero opacity in every spelling, transforms.
    add("solid on a rect that inherits a dash from its group fails", BARS.replace('  <rect x="80"', '  <g strokeDasharray="3 2"><rect x="80"').replace('fillOpacity="0.6" />', 'fillOpacity="0.6" /></g>'), [BAR_SOLID, LABEL_TB], False, "dashed")
    add("tint on a rect that inherits a dash and fill none from its group fails (B-AHB-1, B-AXI-4, B-AMBA-2)",
        '  <g fill="none" stroke="currentColor" strokeOpacity="0.5" strokeDasharray="3 3">\n    <rect x="18" y="38" width="36" height="30" rx="3" />\n  </g>\n  <text x="36" y="58" fontSize="12" textAnchor="middle" fill="currentColor" data-fig="design">3</text>',
        [('rx="3" />', 'rx="3" data-fig="design tint" />')], False, "dashed")
    add("solid on a rect with no fill of its own under a group with fill none fails", BARS.replace('  <rect x="80" y="2" width="120" height="12" fill="currentColor" fillOpacity="0.6" />', '  <g fill="none"><rect x="80" y="2" width="120" height="12" fillOpacity="0.6" /></g>'), [BAR_SOLID, LABEL_TB], False, "fill is 'none'")
    add("tint on a rect whose fill none is only inherited fails (the CSS fills only fill=\"none\" written on the rect)", '  <g fill="none" stroke="currentColor"><rect x="10" y="10" width="80" height="30" /></g>', [('height="30" />', 'height="30" data-fig="design tint" />')], False, 'fill="none" written on it')
    for name, attr in [
        ("fillOpacity=\"0\"", 'fillOpacity="0"'), ("fill-opacity=\"0\"", 'fill-opacity="0"'), ("opacity=\"0\"", 'opacity="0"'),
        ("fillOpacity=\"0%\"", 'fillOpacity="0%"'), ("opacity=\"0%\"", 'opacity="0%"'), ("fillOpacity={0}", "fillOpacity={0}"),
        ("style={{ fillOpacity: 0 }}", "style={{ fillOpacity: 0 }}"), ("style=\"fill-opacity: 0\"", 'style="fill-opacity: 0"'),
        ("style={{ opacity: \"0%\" }}", 'style={{ opacity: "0%" }}'), ("fillOpacity=\"0.000\"", 'fillOpacity="0.000"'),
    ]:
        add(f"solid on a bar drawn empty with {name} fails", BARS.replace('fillOpacity="0.6"', attr), [(attr + " />", attr + ' data-fig="testbench solid" />'), LABEL_TB], False, "opacity is 0")
    for name, g in [("opacity=\"0\"", '<g opacity="0">'), ("style={{ opacity: 0 }}", "<g style={{ opacity: 0 }}>"), ("opacity=\"0%\"", '<g opacity="0%">')]:
        add(f"solid on a bar inside a group with {name} fails", BARS.replace('  <rect x="80"', f'  {g}<rect x="80"').replace('fillOpacity="0.6" />', 'fillOpacity="0.6" /></g>'), [BAR_SOLID, LABEL_TB], False, "opacity is 0")
    # fill-opacity inherits: a bar with no fill opacity of its own takes its group's 0.
    for name, g in [("fillOpacity=\"0\"", '<g fillOpacity="0">'), ("fill-opacity=\"0%\"", '<g fill-opacity="0%">'), ("style=\"fill-opacity: 0\"", '<g style="fill-opacity: 0">')]:
        add(f"solid on a bar that inherits {name} from its group fails", BARS.replace('  <rect x="80"', f'  {g}<rect x="80"').replace(' fillOpacity="0.6" />', ' /></g>'),
            [('height="12" fill="currentColor" />', 'height="12" fill="currentColor" data-fig="testbench solid" />'), LABEL_TB], False, "opacity is 0")
    add("solid on a bar whose opacity the guard cannot parse fails", BARS.replace('fillOpacity="0.6"', 'fillOpacity="half"'), [('fillOpacity="half" />', 'fillOpacity="half" data-fig="testbench solid" />'), LABEL_TB], False, "cannot evaluate")
    add("solid on a bar inside a transformed group fails", BARS.replace('  <rect x="80"', '  <g transform="translate(5 0)"><rect x="80"').replace('fillOpacity="0.6" />', 'fillOpacity="0.6" /></g>'), [BAR_SOLID, LABEL_TB], False, "transformed")
    add("solid on a bar with its own transform fails", BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.6" transform="rotate(1)"'), [('transform="rotate(1)" />', 'transform="rotate(1)" data-fig="testbench solid" />'), LABEL_TB], False, "transformed")
    add("solid on a bar with a style transform fails", BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.6" style={{ transform: "scale(1)" }}'), [('"scale(1)" }} />', '"scale(1)" }} data-fig="testbench solid" />'), LABEL_TB], False, "transformed")
    grid = "\n".join(f'  <rect x="{80 + 40 * i}" y="2" width="30" height="12" fill="currentColor" fillOpacity="{o}" />' for i, o in enumerate(("0.14", "0.28", "0.3"))) + '\n  <text x="0" y="12" fontSize="10" fill="currentColor">Testbench</text>'
    add("solid on one cell of a grid of three same-size cells (an opacity ladder, F1B) fails", grid, [('fillOpacity="0.3" />', 'fillOpacity="0.3" data-fig="testbench solid" />'), LABEL_TB], False, "grid or ladder")
    add("solid on one of three same-size dots fails", BARS + '\n  <circle cx="120" cy="36" r="5" fill="currentColor" />\n  <circle cx="150" cy="36" r="5" fill="currentColor" />', [DOT_SOLID, LABEL_D], False, "grid or ladder")
    add("solid without a label carrying its role fails", BARS, [BAR_SOLID], False, "needs a label")
    add("solid whose only label carries another role fails", BARS, [BAR_SOLID, ('fill="currentColor">Testbench', 'fill="currentColor" data-fig="design">Testbench')], False, "needs a label")
    add("solid on a bar that a text overlaps by its box, not its anchor, fails", BARS + '\n  <text x="40" y="12" fontSize="10" fill="currentColor">a long note here</text>', [BAR_SOLID, LABEL_TB], False, "a text overlaps")
    add("solid on a bar that an end-anchored text reaches from the right fails", BARS + '\n  <text x="260" y="12" fontSize="10" textAnchor="end" fill="currentColor">ends inside</text>', [BAR_SOLID, LABEL_TB], False, "a text overlaps")
    add("solid on a bar that a text below reaches with its ascent fails", BARS + '\n  <text x="100" y="24" fontSize="12" fill="currentColor">under</text>', [BAR_SOLID, LABEL_TB], False, "a text overlaps")
    add("solid in a figure with a text inside a transformed group fails", BARS + '\n  <g transform="rotate(-90)"><text x="0" y="0" fontSize="10" fill="currentColor">y axis</text></g>', [BAR_SOLID, LABEL_TB], False, "cannot be placed")
    add("solid in a figure with a text whose content is an expression fails", BARS + '\n  <text x="0" y="100" fontSize="10" fill="currentColor">{label}</text>', [BAR_SOLID, LABEL_TB], False, "expression")
    add("solid on a path fails", '  <path d="M0 0 H10 V10 Z" fill="currentColor" />\n  <text x="50" y="10" fontSize="10" fill="currentColor">Testbench</text>', [('fill="currentColor" />', 'fill="currentColor" data-fig="testbench solid" />'), LABEL_TB], False, "rect, circle or ellipse only")
    add("solid on a polygon fails", '  <polygon points="0,0 10,0 10,10" fill="currentColor" />\n  <text x="50" y="10" fontSize="10" fill="currentColor">Testbench</text>', [('fill="currentColor" />', 'fill="currentColor" data-fig="testbench solid" />'), LABEL_TB], False, "rect, circle or ellipse only")
    add("solid on a bar filled by a class fails", BARS.replace('fill="currentColor" fillOpacity="0.6"', 'className="fill-current" fillOpacity="0.6"'), [BAR_SOLID, LABEL_TB], False, 'the class "fill-current"')
    add("solid on a bar inside a group with an opacity class fails", BARS.replace('  <rect x="80"', '  <g className="opacity-50"><rect x="80"').replace('fillOpacity="0.6" />', 'fillOpacity="0.6" /></g>'), [BAR_SOLID, LABEL_TB], False, 'the class "opacity-50"')
    add("solid on a bar with a site class (fig-solid) fails", BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.6" className="fig-solid"'), [('className="fig-solid" />', 'className="fig-solid" data-fig="testbench solid" />'), LABEL_TB], False, 'the class "fig-solid"')
    add("solid on a bar whose className is an expression fails", BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.6" className={cls}'), [('className={cls} />', 'className={cls} data-fig="testbench solid" />'), LABEL_TB], False, "className given as")
    add("solid on a bar whose fill is a CSS variable fails", BARS.replace('fill="currentColor" fillOpacity="0.6"', 'fill="var(--x)" fillOpacity="0.6"'), [BAR_SOLID, LABEL_TB], False, "CSS variable")
    add("solid on a bar whose fill is an expression fails", BARS.replace('fill="currentColor" fillOpacity="0.6"', 'fill={c} fillOpacity="0.6"'), [BAR_SOLID, LABEL_TB], False, "expression")
    add("solid on a bar with a spread attribute fails", BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.6" {...p}'), [('{...p} />', '{...p} data-fig="testbench solid" />'), LABEL_TB], False, "spread")
    add("solid in a figure that holds a <use> fails", BARS + '\n  <use href="#bar" x="0" y="80" />', [BAR_SOLID, LABEL_TB], False, "<use>")
    add("solid in a figure with shapes drawn by a {…map} fails", BARS + '\n  {[1, 2].map((i) => <rect key={i} x={i} y="90" width="5" height="5" fill="currentColor" />)}', [BAR_SOLID, LABEL_TB], False, "expression")
    # Appearance words, one per word (stems), in the figcaption.
    for word in ("shaded", "shading", "shades", "Filled", "hollow", "outlined", "outline", "dashed", "dotted", "solid", "darker", "lighter", "thicker",
                 "thinner", "fainter", "bolder", "brighter", "paler", "hatched", "striped", "translucent", "opaque", "greyed", "grayed", "dimmed", "darkest"):
        add(f"solid with the appearance word '{word}' in the caption fails", BARS, [BAR_SOLID, LABEL_TB], False, word.lower(), caption=f"The {word} part is the testbench.")
    # …and in each place the rule reads.
    add("solid with an appearance word in the aria-label fails", BARS, [BAR_SOLID, LABEL_TB], False, "shaded", aria='"The shaded bar is the testbench"')
    add("solid with an aria-label the guard cannot read fails", BARS, [BAR_SOLID, LABEL_TB], False, "aria-label", aria="{label}")
    add("solid with an appearance word in the <title> fails", "  <title>Darker bars took longer</title>\n" + BARS, [BAR_SOLID, LABEL_TB], False, "darker")
    add("solid with an appearance word in the <desc> fails", "  <desc>Hollow bars were skipped</desc>\n" + BARS, [BAR_SOLID, LABEL_TB], False, "hollow")
    add("solid with an appearance word in the figure's own <text> fails", BARS + '\n  <text x="0" y="100" fontSize="10" fill="currentColor">dashed = idle</text>', [BAR_SOLID, LABEL_TB], False, "dashed")
    add("solid with an appearance word in the paragraph before fails", BARS, [BAR_SOLID, LABEL_TB], False, "outlined", before="The outlined boxes are idle.")
    add("solid with an appearance word in the paragraph after fails", BARS, [BAR_SOLID, LABEL_TB], False, "filled", after="Filled cells were hit.")
    add("solid with a shape glyph in the caption fails", BARS, [BAR_SOLID, LABEL_TB], False, "\u25cf", caption="\u25cf marks the testbench, \u25cb the design.")
    add("tint with a shape glyph in the figure's own text fails", BOXES + '\n  <text x="10" y="110" fontSize="10" fill="currentColor">\u25a1 = idle block</text>', [BOX_TINT, LABEL_DUT], False, "\u25a1")
    add("tint with an appearance word in the caption fails", BOXES, [BOX_TINT, LABEL_DUT], False, "hollow", caption="The hollow box is the DUT.")
    # C: tint only on a hollow rect in a figure with no filled shape.
    add("tint in a figure that has a filled shape fails", BOXES + '\n  <circle cx="150" cy="100" r="4" fill="currentColor" />', [BOX_TINT, LABEL_DUT], False, "filled against hollow")
    add("tint in a figure whose open path has no fill (black by default) fails", BOXES + '\n  <path d="M10 100 L60 110" stroke="currentColor" />', [BOX_TINT, LABEL_DUT], False, "filled <path>")
    add("tint on a circle fails", BOXES + '\n  <circle cx="150" cy="100" r="4" fill="none" stroke="currentColor" />', [('r="4" fill="none" stroke="currentColor" />', 'r="4" fill="none" stroke="currentColor" data-fig="design tint" />')], False, "rect only")
    add("tint on a rect filled in currentColor fails", BOXES.replace('<rect x="200" y="10" width="80" height="30" fill="none"', '<rect x="200" y="10" width="80" height="30" fill="currentColor" fillOpacity="0.1"'),
        [('fillOpacity="0.1" stroke="currentColor" />', 'fillOpacity="0.1" stroke="currentColor" data-fig="design tint" />')], False, "fill is 'currentColor'")
    add("tint without a role fails", BOXES, [('<rect x="200" y="10" width="80" height="30" fill="none" stroke="currentColor" />', '<rect x="200" y="10" width="80" height="30" fill="none" stroke="currentColor" data-fig="tint" />')], False, "together with a role")
    add("solid without a role fails", BARS, [('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="solid" />')], False, "together with a role")
    add("tint and solid together fail", BARS, [('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="testbench tint solid" />')], False, "never both")
    # D: where a plain role may stand.
    for tag in ("g", "svg", "marker", "use", "defs", "title", "desc"):
        body = {
            "g": '  <g fill="none" stroke="currentColor"><rect x="10" y="10" width="80" height="30" /></g>',
            "svg": BOXES, "marker": BOXES, "defs": BOXES,
            "use": BOXES + '\n  <use href="#arr" />', "title": "  <title>Two blocks</title>\n" + BOXES, "desc": "  <desc>Two blocks</desc>\n" + BOXES,
        }[tag]
        pair = {
            "g": ('<g fill="none"', '<g data-fig="design" fill="none"'), "svg": ('role="img"', 'role="img" data-fig="design"'),
            "marker": ('<marker id="arr"', '<marker id="arr" data-fig="data"'), "defs": ("<defs>", '<defs data-fig="data">'),
            "use": ('<use href="#arr" />', '<use href="#arr" data-fig="data" />'), "title": ("<title>", '<title data-fig="design">'), "desc": ("<desc>", '<desc data-fig="design">'),
        }[tag]
        add(f"a role on <{tag}> fails", body, [pair], False, "a role goes only on")
    add("a role on a rect filled in currentColor at full opacity fails (it would recolour a filled shape)", BARS, [('r="5" fill="currentColor" />', 'r="5" fill="currentColor" data-fig="design" />')], False, "only when its fill is none")
    add("a role on a path filled in currentColor at 0.5 fails (washed out)", '  <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" fillOpacity="0.5" />', [('fillOpacity="0.5" />', 'fillOpacity="0.5" data-fig="data" />')], False, "wash out")
    add("a role on a path in a group at opacity 0.5 fails (washed out)", '  <g opacity="0.5"><path d="M0 0 L10 5 L0 10 Z" fill="currentColor" /></g>', [('fill="currentColor" />', 'fill="currentColor" data-fig="data" />')], False, "wash out")
    add("a role on a text at fillOpacity 0.6 fails (washed out)", BARS.replace('fill="currentColor">Testbench', 'fill="currentColor" fillOpacity="0.6">Testbench'), [('fillOpacity="0.6">Testbench', 'fillOpacity="0.6" data-fig="testbench">Testbench')], False, "wash out")
    add("a role on a path whose fill opacity is unknown fails", '  <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" fillOpacity={o} />', [("fillOpacity={o} />", 'fillOpacity={o} data-fig="data" />')], False, "cannot evaluate")
    add("a role on a marker's shape when no line that uses it carries the role fails", BOXES, [('<path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" />', '<path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" data-fig="data" />')], False, "does not carry")
    add("a role on a marker's shape when two lines with different roles use it fails",
        BOXES + '\n  <line x1="90" y1="35" x2="200" y2="35" stroke="currentColor" markerEnd="url(#arr)" />',
        [('<path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" />', '<path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" data-fig="data" />'),
         ('y2="25" stroke="currentColor" markerEnd="url(#arr)" />', 'y2="25" stroke="currentColor" markerEnd="url(#arr)" data-fig="data" />'),
         ('y2="35" stroke="currentColor" markerEnd="url(#arr)" />', 'y2="35" stroke="currentColor" markerEnd="url(#arr)" data-fig="design" />')], False, "does not carry")
    # E: one role, one attribute.
    add("two roles in one data-fig fail", BOXES, [('fill="currentColor">DUT', 'fill="currentColor" data-fig="design testbench">DUT')], False, "more than one role")
    add("two data-fig attributes fail", BOXES, [('fill="currentColor">DUT', 'fill="currentColor" data-fig="design" data-fig="design">DUT')], False, "more than one data-fig")

    # Closing check 3. The colour channel: what currentColor resolves to (O04 to O09, D01).
    add("solid on a bar with style={{ color: \"transparent\" }} fails (O04)", BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.6" style={{ color: "transparent" }}'), [('"transparent" }} />', '"transparent" }} data-fig="testbench solid" />'), LABEL_TB], False, 'color "transparent"')
    add("solid on a bar inside <g color=\"transparent\"> fails (O05)", BARS.replace('  <rect x="80"', '  <g color="transparent"><rect x="80"').replace('fillOpacity="0.6" />', 'fillOpacity="0.6" /></g>'), [BAR_SOLID, LABEL_TB], False, 'color "transparent"')
    add("solid on a bar with className=\"text-transparent\" fails (O06)", BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.6" className="text-transparent"'), [('className="text-transparent" />', 'className="text-transparent" data-fig="testbench solid" />'), LABEL_TB], False, 'the class "text-transparent"')
    add("solid on a bar with className=\"text-black/0\" fails (O07)", BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.6" className="text-black/0"'), [('className="text-black/0" />', 'className="text-black/0" data-fig="testbench solid" />'), LABEL_TB], False, 'the class "text-black/0"')
    add("solid on a bar with a palette colour class (text-rose-500/50) fails", BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.6" className="text-rose-500/50"'), [('className="text-rose-500/50" />', 'className="text-rose-500/50" data-fig="testbench solid" />'), LABEL_TB], False, 'the class "text-rose-500/50"')
    add("solid on a bar under a group with style=\"color: red\" fails", BARS.replace('  <rect x="80"', '  <g style="color: red"><rect x="80"').replace('fillOpacity="0.6" />', 'fillOpacity="0.6" /></g>'), [BAR_SOLID, LABEL_TB], False, 'color "red"')
    add("solid on a bar under a root svg with a colour class fails", BARS, [BAR_SOLID, LABEL_TB], False, 'the class "text-cyan-600"', root=' className="text-cyan-600"')
    add("tint on a hollow box with className=\"text-transparent\" fails (O09)", BOXES.replace('<rect x="200" y="10" width="80" height="30" fill="none" stroke="currentColor" />', '<rect x="200" y="10" width="80" height="30" fill="none" stroke="currentColor" className="text-transparent" />'),
        [('className="text-transparent" />', 'className="text-transparent" data-fig="design tint" />'), LABEL_DUT], False, 'the class "text-transparent"')
    add("a plain role on a filled path made invisible by text-transparent fails (D01)", '  <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" className="text-transparent" />', [('className="text-transparent" />', 'className="text-transparent" data-fig="data" />')], False, 'the class "text-transparent"')
    add("a plain role on a line with a stroke class fails", '  <line x1="0" y1="0" x2="50" y2="0" stroke="currentColor" className="stroke-cyan-600" />', [('className="stroke-cyan-600" />', 'className="stroke-cyan-600" data-fig="data" />')], False, 'the class "stroke-cyan-600"')
    # The text box: em against the parent size, named size classes, wide and bold glyphs (T05 to T08).
    add("solid with a text sized 1.5em under a 40px group whose box covers the bar fails (T05)", BARS + '\n  <g fontSize="40"><text x="0" y="60" fontSize="1.5em" fill="currentColor">Wide</text></g>', [BAR_SOLID, LABEL_TB], False, "a text overlaps")
    add("solid with a text set in text-display (60px) whose box covers the bar fails (T06)", BARS + '\n  <text x="0" y="40" fontSize="10" className="text-display" fill="currentColor">Throughput</text>', [BAR_SOLID, LABEL_TB], False, "a text overlaps")
    for name, cls in (("text-h1", "text-h1"), ("text-lead", "text-lead"), ("text-5xl", "text-5xl")):
        add(f"solid with a text set in {name} whose box reaches the bar fails", BARS + f'\n  <text x="0" y="28" fontSize="10" className="{cls}" fill="currentColor">Throughput rate</text>', [BAR_SOLID, LABEL_TB], False, "a text overlaps")
    add("...and the same text at its own 10px, with no size class, clears the bar and passes", BARS + '\n  <text x="0" y="28" fontSize="10" fill="currentColor">Throughput rate</text>', [BAR_SOLID, LABEL_TB], True)
    wide = '  <text x="0" y="12" fontSize="12" {a}fill="currentColor">{s}</text>\n  <rect x="94" y="2" width="40" height="12" fill="currentColor" />\n  <text x="0" y="40" fontSize="10" fill="currentColor">Testbench</text>'
    solid94 = ('height="12" fill="currentColor" />', 'height="12" fill="currentColor" data-fig="testbench solid" />')
    add("solid beside ten bold capital Ws whose real width reaches it fails (T07)", wide.format(a='fontWeight="700" ', s="WWWWWWWWWW"), [solid94, LABEL_TB], False, "a text overlaps")
    add("solid beside 'mwmw' set uppercase and bold by classes fails (T08)", wide.format(a='className="uppercase font-bold" ', s="mwmwmwmwmw"), [solid94, LABEL_TB], False, "a text overlaps")
    add("solid beside 'mwmw' set uppercase by a style fails", wide.format(a='style={{ textTransform: "uppercase" }} ', s="mwmwmwmwmw"), [solid94, LABEL_TB], False, "a text overlaps")
    add("solid beside a row of emoji fails", wide.format(a="", s="\U0001F7E2\U0001F7E2\U0001F7E2\U0001F7E2\U0001F7E2\U0001F7E2\U0001F7E2\U0001F7E2"), [solid94, LABEL_TB], False, "a text overlaps")
    add("solid beside lowercase text whose weight is an expression (read as bold, so as capitals) fails", wide.format(a="fontWeight={w} ", s="abcdefghij"), [solid94, LABEL_TB], False, "a text overlaps")
    add("...and the same lowercase text at normal weight clears the bar and passes", wide.format(a="", s="abcdefghij"), [solid94, LABEL_TB], True)
    # The opacity floor (O08).
    add("solid on a bar at fillOpacity 0.01 fails (O08)", BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.01"'), [('fillOpacity="0.01" />', 'fillOpacity="0.01" data-fig="testbench solid" />'), LABEL_TB], False, "below 0.2")
    add("solid on a bar at fillOpacity 0.19 fails", BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.19"'), [('fillOpacity="0.19" />', 'fillOpacity="0.19" data-fig="testbench solid" />'), LABEL_TB], False, "below 0.2")
    add("solid on a bar that inherits fillOpacity 0.05 from its group fails", BARS.replace('  <rect x="80"', '  <g fillOpacity="0.05"><rect x="80"').replace(' fillOpacity="0.6" />', ' /></g>'),
        [('height="12" fill="currentColor" />', 'height="12" fill="currentColor" data-fig="testbench solid" />'), LABEL_TB], False, "below 0.2")
    add("solid on a bar at 0.6 under a group at opacity 0.3 (0.18 in all) fails", BARS.replace('  <rect x="80"', '  <g opacity="0.3"><rect x="80"').replace('fillOpacity="0.6" />', 'fillOpacity="0.6" /></g>'), [BAR_SOLID, LABEL_TB], False, "below 0.2")
    add("solid on a bar whose opacity is written 6e-1 fails", BARS.replace('fillOpacity="0.6"', 'fillOpacity="6e-1"'), [('fillOpacity="6e-1" />', 'fillOpacity="6e-1" data-fig="testbench solid" />'), LABEL_TB], False, "plain decimal")
    # Marker references in every spelling (M02).
    for name, ref in (("url('#arr')", "url('#arr')"), ('url("#arr")', 'url(&quot;#arr&quot;)')):
        if "&quot;" in ref:
            line = "\n  <line x1=\"90\" y1=\"35\" x2=\"200\" y2=\"35\" stroke=\"currentColor\" markerEnd='url(\"#arr\")' />"
        else:
            line = f"\n  <line x1=\"90\" y1=\"35\" x2=\"200\" y2=\"35\" stroke=\"currentColor\" markerEnd=\"{ref}\" />"
        add(f"a role on a marker's shape when an unmarked line uses it as {name} fails (M02)", BOXES + line,
            [('<path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" />', '<path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" data-fig="data" />'),
             ('y2="25" stroke="currentColor" markerEnd="url(#arr)" />', 'y2="25" stroke="currentColor" markerEnd="url(#arr)" data-fig="data" />')], False, "does not carry")
    add("a role on a marker's shape that is also referenced by an href fails", BOXES + '\n  <a href="#arr"><text x="0" y="110" fontSize="10" fill="currentColor">see</text></a>',
        [('<path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" />', '<path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" data-fig="data" />'),
         ('y2="25" stroke="currentColor" markerEnd="url(#arr)" />', 'y2="25" stroke="currentColor" markerEnd="url(#arr)" data-fig="data" />')], False, "other than as a markerStart")
    # Words outside the figure's own text (W04 to W07).
    for name, wrap in (("a <figure aria-label>", ('<figure>', '<figure aria-label="Hollow bars were skipped">')),
                       ("a wrapper's caption prop (W07)", ('<figure>', '<FigureFrame caption="Dashed bars are outside">\n<figure>')),
                       ("a VisualRecap rule given as JSX", ('<figure>', '<VisualRecap title="Slots" rule={<>Empty slots are free</>}>\n<figure>'))):
        base = _doc(BARS)
        b = base.replace(*wrap)
        if "FigureFrame" in wrap[1]:
            b = b.replace("</figure>", "</figure>\n</FigureFrame>")
        if "VisualRecap" in wrap[1]:
            b = b.replace("</figure>", "</figure>\n</VisualRecap>")
        cases.append((f"solid with an appearance word in {name} fails", b, _mark(b, BAR_SOLID, LABEL_TB), False, "appearance word"))
    add("solid with an appearance word in the paragraph after a JSX comment fails (W06)", BARS, [BAR_SOLID, LABEL_TB], False, "dimmed", after="{/* note */}\n\nThe dimmed bar is idle.")
    add("solid with an appearance word in the paragraph before an import line fails", BARS, [BAR_SOLID, LABEL_TB], False, "darker", before="Darker bars took longer.\n\nimport X from './x'")
    for word in ("transparent", "transparency", "invisible", "see-through"):
        add(f"tint with the appearance word '{word}' in the caption fails (W05)", BOXES, [BOX_TINT, LABEL_DUT], False, word, caption=f"The {word} box is the DUT.")
    # The surface: a background on the root svg (R: ROOT_SAFE_CLASS).
    add("solid under a root svg with a bg-* class fails", BARS, [BAR_SOLID, LABEL_TB], False, 'the class "bg-slate-900"', root=' className="w-full bg-slate-900"')
    add("solid under a root svg with a background style fails", BARS, [BAR_SOLID, LABEL_TB], False, "background", root=' style={{ background: "black" }}')
    # Closing check 4 (N01 to N17): what lies under a fill, sizes from outside the svg, captions in constants, aria references, invisible boxes, deliberate colours.
    add("solid on a translucent bar over a line drawn before it fails (N01)", '  <line x1="140" y1="0" x2="140" y2="50" stroke="currentColor" />\n' + BARS.replace('fillOpacity="0.6"', 'fillOpacity="0.3"'),
        [('fillOpacity="0.3" />', 'fillOpacity="0.3" data-fig="testbench solid" />'), LABEL_TB], False, "drawn before it")
    add("solid on a band over dots drawn before it fails (N09)", '  <circle cx="100" cy="8" r="3" fill="currentColor" />\n  <circle cx="130" cy="8" r="3" fill="currentColor" />\n'
        '  <rect x="80" y="2" width="120" height="12" fill="currentColor" fillOpacity="0.25" />\n  <text x="0" y="12" fontSize="10" fill="currentColor">Testbench</text>',
        [('fillOpacity="0.25" />', 'fillOpacity="0.25" data-fig="testbench solid" />'), LABEL_TB], False, "drawn before it")
    add("solid on a bar over a path drawn before it (relative commands) fails", '  <path d="M100 30 l10 -25 h5" fill="none" stroke="currentColor" />\n' + BARS, [BAR_SOLID, LABEL_TB], False, "drawn before it")
    arrow = '  <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3"><path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" /></marker></defs>\n  <line x1="120" y1="-6" x2="150" y2="-6" stroke="currentColor" strokeWidth="2"{m} />\n'
    add("solid on a bar near a line whose arrowhead reaches it fails", arrow.format(m=' markerEnd="url(#arr)"') + BARS, [BAR_SOLID, LABEL_TB], False, "drawn before it")
    add("...and the same line with no arrowhead clears the bar and passes", arrow.format(m="") + BARS, [BAR_SOLID, LABEL_TB], True)
    add("solid on a bar after an arc path that cannot be placed fails", '  <path d="M0 100 A5 5 0 0 1 10 100" fill="none" stroke="currentColor" />\n' + BARS, [BAR_SOLID, LABEL_TB], False, "cannot be placed")
    add("solid with a part drawn before it but clear of its box passes", '  <line x1="0" y1="110" x2="300" y2="110" stroke="currentColor" />\n' + BARS, [BAR_SOLID, LABEL_TB], True)
    unsized = BARS + '\n  <text x="0" y="80">Throughput</text>'
    for name, wrap in (("a wrapper class (text-4xl) (N02)", '<div className="text-4xl">'), ("a wrapper style (N02b)", "<div style={{ fontSize: 36 }}>")):
        b = _doc(unsized).replace("<figure>", wrap + "\n<figure>").replace("</figure>", "</figure>\n</div>")
        cases.append((f"solid in a figure with a text sized only by {name} fails", b, _mark(b, BAR_SOLID, LABEL_TB), False, "not set inside the svg"))
    add("...and the same text sized inside the svg (on the root) passes", unsized, [BAR_SOLID, LABEL_TB], True, root=' fontSize="10"')
    b = 'export const capN03 = "Dashed bars are outside the DUT.";\n\n' + _doc(BARS).replace("<figure>", "<FigureFrame caption={capN03}>\n<figure>").replace("</figure>", "</figure>\n</FigureFrame>")
    cases.append(("solid with a wrapper caption given as a constant fails (N03)", b, _mark(b, BAR_SOLID, LABEL_TB), False, "cannot read"))
    b = 'export const capN04 = "The hollow bar is idle.";\n\n' + _doc(BARS, caption="{capN04}")
    cases.append(("solid with a figcaption given as {constant} fails (N04)", b, _mark(b, BAR_SOLID, LABEL_TB), False, "cannot read"))
    b = _doc(BARS).replace("<figure>", "<FigureFrame caption={<>The <em>dimmed</em> bar is idle</>}>\n<figure>").replace("</figure>", "</figure>\n</FigureFrame>")
    cases.append(("solid with a JSX caption literal is read, and its appearance word fails", b, _mark(b, BAR_SOLID, LABEL_TB), False, "dimmed"))
    b = _doc(BARS).replace("<figure>", "<FigureFrame caption={<>Time per owner</>}>\n<figure>").replace("</figure>", "</figure>\n</FigureFrame>")
    cases.append(("...and a JSX caption literal with no appearance word passes", b, _mark(b, BAR_SOLID, LABEL_TB), True, ""))
    add("solid whose aria-labelledby names a far paragraph with an appearance word fails (N05)", BARS, [BAR_SOLID, LABEL_TB], False, "hollow",
        aria='"x" aria-labelledby="farcap"', after='Unrelated prose.\n\n<p id="farcap">Hollow bars were skipped.</p>')
    add("solid whose aria-describedby names a missing id fails", BARS, [BAR_SOLID, LABEL_TB], False, "not exactly one element", aria='"x" aria-describedby="nowhere"')
    add("solid whose aria-labelledby is an expression fails", BARS, [BAR_SOLID, LABEL_TB], False, "aria-labelledby", aria='"x" aria-labelledby={ids}')
    add("tint on a rect that draws nothing (fill none, no stroke) fails (N06)", BOXES + '\n  <rect x="5" y="5" width="290" height="40" fill="none" />',
        [('height="40" fill="none" />', 'height="40" fill="none" data-fig="design tint" />'), LABEL_DUT], False, "visible currentColor outline")
    add("tint on a rect whose outline is at stroke opacity 0 fails", BOXES.replace('<rect x="200" y="10" width="80" height="30" fill="none" stroke="currentColor" />', '<rect x="200" y="10" width="80" height="30" fill="none" stroke="currentColor" strokeOpacity="0" />'),
        [('strokeOpacity="0" />', 'strokeOpacity="0" data-fig="design tint" />'), LABEL_DUT], False, "stroke opacity")
    add("tint on a rect whose stroke width is 0 fails", BOXES.replace('<rect x="200" y="10" width="80" height="30" fill="none" stroke="currentColor" />', '<rect x="200" y="10" width="80" height="30" fill="none" stroke="currentColor" strokeWidth="0" />'),
        [('strokeWidth="0" />', 'strokeWidth="0" data-fig="design tint" />'), LABEL_DUT], False, "stroke width")
    n07 = BOXES.replace('  <rect x="200" y="10" width="80" height="30" fill="none" stroke="currentColor" />\n  <text x="240" y="30" fontSize="10" textAnchor="middle" fill="currentColor">DUT</text>',
                        '  <text x="240" y="30" fontSize="10" textAnchor="middle" fill="currentColor">DUT</text>\n  <line x1="205" y1="35" x2="275" y2="35" stroke="currentColor" />\n  <rect x="200" y="10" width="80" height="30" fill="none" stroke="currentColor" />')
    add("tint on a box drawn after its label and an inner line fails (N07)", n07, [BOX_TINT, LABEL_DUT], False, "drawn after a part inside it")
    run = '  <rect x="10" y="10" width="80" height="30" fill="none" stroke="rgb(6,182,212)" strokeWidth="2" />\n  <text x="50" y="30" fontSize="10" textAnchor="middle" fill="currentColor">run</text>'
    add("tint on a box with a deliberately coloured stroke fails (N16, I-UVM-1C)", run, [('strokeWidth="2" />', 'strokeWidth="2" data-fig="design tint" />'), ('fill="currentColor">run', 'fill="currentColor" data-fig="design">run')], False, 'stroke "rgb(6,182,212)"')
    add("a plain role on a box with a deliberately coloured stroke fails (N17)", run, [('strokeWidth="2" />', 'strokeWidth="2" data-fig="design" />')], False, 'stroke "rgb(6,182,212)"')
    add("a plain role on a line whose group sets a stroke colour fails", '  <g stroke="#0ea5e9"><line x1="0" y1="0" x2="50" y2="0" /></g>', [('y2="0" />', 'y2="0" data-fig="data" />')], False, 'stroke "#0ea5e9"')
    add("a plain role on a text filled in its own colour fails", '  <text x="0" y="10" fontSize="10" fill="rgb(225,29,72)">err</text>', [('>err', ' data-fig="error">err')], False, 'fill "rgb(225,29,72)"')
    for word, kind in (("Open", "tint"), ("closed", "tint"), ("heavier", "solid"), ("heavy", "solid"), ("Muted", "solid"), ("mute", "solid"), ("shadowed", "solid"), ("ghost", "solid"), ("ring", "solid"), ("rings", "solid")):
        if kind == "tint":
            add(f"tint with the appearance word '{word}' in the caption fails (N11)", BOXES, [BOX_TINT, LABEL_DUT], False, word.lower(), caption=f"{word} boxes are free slots.")
        else:
            add(f"solid with the appearance word '{word}' in the caption fails (N11)", BARS, [BAR_SOLID, LABEL_TB], False, word.lower(), caption=f"The {word} bar is the hot path.")
    return cases


def selftest():
    base = KIT_BASE + SVG_BASE
    # A base with tagged kinds: two side-overridable (fifo, reg) and two that are not (driver, dut).
    side_base = base.replace(
        '{ id: "s", label: "Slave", col: 1, row: 0 }',
        '{ id: "s", label: "Slave", col: 1, row: 0 },\n'
        '    { id: "f", label: "write buffer", kind: "fifo", col: 2, row: 0 },\n'
        '    { id: "r", label: "ctx_reg", kind: "reg", col: 3, row: 0 },\n'
        '    { id: "d", label: "drv", kind: "driver", col: 4, row: 0 },\n'
        '    { id: "u", label: "dut", kind: "dut", col: 5, row: 0 }',
    ).replace('{ "id": "b", "label": "B" }', '{ "id": "b", "label": "B" },\n    { id: "q", label: "buffer", kind: "fifo" }')
    # The same base, with labels that quote another kind: kind is read as a top-level key, never from a label.
    label_base = side_base.replace('label: "drv", kind: "driver"', 'label: "kind: \'fifo\' note", kind: "driver"').replace('label: "write buffer", kind: "fifo"', 'label: "kind: \'driver\' buffer", kind: "fifo"')
    side_cases = [
        ("role design on a side-overridable fifo node passes", side_base.replace('label: "write buffer", kind: "fifo"', 'label: "write buffer", kind: "fifo", role: "design"'), True),
        ("role design on a side-overridable reg node passes", side_base.replace('label: "ctx_reg", kind: "reg"', 'label: "ctx_reg", kind: "reg", role: "design"'), True),
        ("role testbench (its default side) on a fifo node passes", side_base.replace('label: "write buffer", kind: "fifo"', 'label: "write buffer", kind: "fifo", role: "testbench"'), True),
        ("role design on a side-overridable fifo participant passes", side_base.replace('label: "buffer", kind: "fifo"', 'label: "buffer", kind: "fifo", role: "design"'), True),
        ("role design on a driver (not side-overridable) fails", side_base.replace('label: "drv", kind: "driver"', 'label: "drv", kind: "driver", role: "design"'), False),
        ("role testbench on a dut (not side-overridable) fails", side_base.replace('label: "dut", kind: "dut"', 'label: "dut", kind: "dut", role: "testbench"'), False),
        ("a disallowed role on a side-overridable fifo still fails", side_base.replace('label: "write buffer", kind: "fifo"', 'label: "write buffer", kind: "fifo", role: "register"'), False),
        ("a role on a driver whose label says kind: 'fifo' still fails (kind is read as a top-level key)", label_base.replace('kind: "driver"', 'kind: "driver", role: "design"'), False),
        ("...and role design on a fifo whose label says kind: 'driver' passes", label_base.replace('kind: "fifo", col: 2', 'kind: "fifo", role: "design", col: 2'), True),
        ("a changed kind on a side-overridable node fails", side_base.replace('label: "write buffer", kind: "fifo"', 'label: "write buffer", kind: "generic", role: "design"'), False),
    ]
    cases = [
        ("allowed kit roles in two quotings pass", base.replace('kind: "generic", col: 0', 'kind: "generic", role: "design", col: 0').replace('label: "Slave", col', "label: \"Slave\", role: 'design', col").replace('{ id: "a", label: "A" }', '{ id: "a", label: "A", role: "testbench" }').replace('"label": "B" }', '"label": "B", "role": "design" }'), True),
        ("a role written first in its object passes", base.replace('{ id: "m",', '{ role: "design", id: "m",'), True),
        ("solid on a bar whose label (no font size given, so read at 20) reaches into its box fails", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="testbench solid" />').replace('fill="currentColor">Testbench', 'fill="currentColor" data-fig="testbench">Testbench'), False),
        ("solid without a role fails", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="solid" />'), False),
        ("solid together with tint fails", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="testbench tint solid" />'), False),
        ("solid on text fails", base.replace('fill="currentColor">Testbench', 'fill="currentColor" data-fig="testbench solid">Testbench'), False),
        ("visible svg text that gains the words data-fig=\"testbench solid\" fails", base.replace('>Testbench</text>', '>Testbench data-fig="testbench solid"</text>'), False),
        ("visible svg text that gains the word solid fails", base.replace('>Testbench</text>', '>Testbench solid</text>').replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="testbench solid" />'), False),
        ("allowed data-fig tokens pass", base.replace('strokeWidth="2" />', 'strokeWidth="2" data-fig="testbench" />').replace('fill="currentColor">Testbench', 'fill="currentColor" data-fig="testbench">Testbench'), True),
        ("a changed word fails", base.replace("The testbench bar is longer.", "The testbench bar is shorter.").replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="testbench" />'), False),
        ("a changed label in figure data fails", base.replace('label: "Master", kind: "generic", col: 0', 'label: "Manager", kind: "generic", role: "design", col: 0'), False),
        ("a changed coordinate fails", base.replace('width="60"', 'width="61"').replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="testbench" />'), False),
        ("a changed grid cell fails", base.replace('kind: "generic", col: 0, row: 0', 'kind: "generic", role: "design", col: 0, row: 1'), False),
        ("a removed attribute fails", base.replace(' fillOpacity="0.6"', ' data-fig="testbench"'), False),
        ("a disallowed kit role fails", base.replace('kind: "generic", col: 0', 'kind: "generic", role: "dut", col: 0'), False),
        ("a disallowed data-fig token fails", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="red" />'), False),
        ("a role added outside a figure fails", base.replace("Some text about the role of a design.", 'Some text about the role of a design. { role: "design" }'), False),
        ("a role on an edge (not a node) fails", base.replace('style: "data", label: "HADDR"', 'style: "data", role: "design", label: "HADDR"'), False),
        ("a data-fig outside an svg fails", base.replace("<figcaption>", '<figcaption data-fig="design">'), False),
        ("an unchanged file passes", base, True),
        ("visible svg text that gains the words data-fig=\"design\" fails", base.replace('>Testbench</text>', '>Testbench data-fig="design"</text>'), False),
        ("a kit label that gains the words , role: 'design' fails", base.replace('label: "Master"', "label: \"Master, role: 'design'\""), False),
        ("a role that disagrees with a tagged kind fails", base.replace('label: "Master", kind: "generic"', 'label: "Master", kind: "driver", role: "design"'), False),
        ("a role inside a nested object of a node fails", base.replace('kind: "generic", col: 0', 'kind: "generic", meta: { role: "design" }, col: 0'), False),
        ("a role added to a kit figure in a fenced code sample fails", base + '\n```mdx\n<ArchitectureDiagram nodes={[{ id: "a", label: "A", col: 0, row: 0 }]} />\n```\n', True),
        ("...and the same sample with a role in it fails", (base + '\n```mdx\n<ArchitectureDiagram nodes={[{ id: "a", label: "A", col: 0, row: 0 }]} />\n```\n').replace('label: "A", col', 'label: "A", role: "design", col'), False),
        ("a data-fig in a fenced svg code sample fails", (base + '\n```html\n<svg viewBox="0 0 1 1"><rect x="0" /></svg>\n```\n').replace('<rect x="0" />', '<rect x="0" data-fig="design" />'), False),
        ("a data-fig on prose after an inline `<svg>` mention fails", ('Use `<svg>` here.\n\n<p>Hi</p>\n\n' + base).replace('<p>Hi</p>', '<p data-fig="design">Hi</p>'), False),
        ("solid on a fill=\"none\" dashed outline fails", base.replace('strokeDasharray="3 2" />', 'strokeDasharray="3 2" data-fig="testbench solid" />'), False),
        ("solid on an open path with fill=\"none\" fails", base.replace('fill="none" stroke="currentColor" />', 'fill="none" stroke="currentColor" data-fig="design solid" />'), False),
        ("solid on a shape with no fill attribute fails", base.replace('<text x="0" y="30" fill="currentColor">', '<circle cx="5" cy="5" r="2" data-fig="design solid" />\n  <text x="0" y="30" fill="currentColor">').replace('<figure>', '<figure>'), False),
        ("solid on a dashed shape filled in currentColor fails", base.replace('strokeDasharray="2 2" />', 'strokeDasharray="2 2" data-fig="design solid" />'), False),
        ("words data-fig=\"design\" added inside an attribute string that holds '<' fail (A13)", base.replace("{'count<max then stop'}", "{'count<max data-fig=\"design\" then stop'}"), False),
        ("words data-fig=\"design\" added inside a text string that holds '<' fail (A13b)", base.replace("{'a<b holds'}", "{'a<b data-fig=\"design\" holds'}"), False),
        ("two roles in one data-fig fail", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="testbench design" />'), False),
        ("two roles across a newline fail", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="design\n testbench" />'), False),
        ("x and z together fail", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="x z" />'), False),
        ("data-fig on the <svg> root fails", base.replace('viewBox="0 0 100 40" role="img"', 'viewBox="0 0 100 40" data-fig="design" role="img"'), False),
        ("data-fig on a <title> fails", base.replace('<rect x="0" y="0"', '<title data-fig="design">Bars</title>\n  <rect x="0" y="0"').replace("<figure>", "<figure>"), False),
        ("tint on text fails", base.replace('fill="currentColor">Testbench', 'fill="currentColor" data-fig="design tint">Testbench'), False),
        ("data-fig with spaces around = fails", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig = "testbench" />'), False),
        ("two role keys in one node fail", base.replace('kind: "generic", col: 0', 'kind: "generic", role: "design", role: "testbench", col: 0'), False),
        # Closing-check holes (A10 to A13b).
        ("solid on an empty cell (fillOpacity 0.0) fails (A11)", base.replace('fillOpacity="0.0" />', 'fillOpacity="0.0" data-fig="match solid" />'), False),
        ("solid on a cell drawn at opacity 0 fails", base.replace('fillOpacity="0.0" />', 'fillOpacity="0.0" opacity="0" data-fig="match solid" />').replace('fillOpacity="0.0" opacity="0"', 'opacity="0"'), False),
        ("solid on a cell with a text anchored inside it fails (A12)", base.replace('fillOpacity="0.3" />', 'fillOpacity="0.3" data-fig="match solid" />'), False),
        ("solid on a bar with no label marked with its role fails", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="match solid" />'), False),
        ("tint on an open path with fill=\"none\" fails (A13)", base.replace('fill="none" stroke="currentColor" />', 'fill="none" stroke="currentColor" data-fig="design tint" />'), False),
        ("tint on a dashed fill=\"none\" outline fails (A13b)", base.replace('strokeDasharray="3 2" />', 'strokeDasharray="3 2" data-fig="tint" />'), False),
        ("tint on a marker's arrowhead path fails", base.replace('strokeWidth="1" />', 'strokeWidth="1" data-fig="design tint" />'), False),
        ("tint on a <marker> fails", base.replace('<marker id="head">', '<marker id="head" data-fig="design tint">'), False),
        ("tint on a polyline fails", base.replace('strokeWidth="2" />', 'strokeWidth="2" data-fig="data tint" />'), False),
        ("tint on a closed box inside a transformed <g> fails", base.replace('strokeWidth="1.5" />', 'strokeWidth="1.5" data-fig="design tint" />'), False),
        ("tint on a <g> fails", base.replace('<g transform="translate(0 0)">', '<g transform="translate(0 0)" data-fig="design tint">'), False),
        ("tint on a closed polygon inside a <marker> fails", base.replace('<path d="M1,1 L9,5 L1,9" fill="none" stroke="currentColor" strokeWidth="1" />', '<polygon points="1,1 9,5 1,9" fill="none" stroke="currentColor" data-fig="design tint" />'), False),
        ("two data-fig attributes on one tag fail (A10)", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="design" data-fig="testbench" />'), False),
    ] + side_cases
    # Bases for the two code-sample cases differ from `base`; compare those with their own base.
    own_base = {
        "...and the same sample with a role in it fails": base + '\n```mdx\n<ArchitectureDiagram nodes={[{ id: "a", label: "A", col: 0, row: 0 }]} />\n```\n',
        "a data-fig in a fenced svg code sample fails": base + '\n```html\n<svg viewBox="0 0 1 1"><rect x="0" /></svg>\n```\n',
        "a data-fig on prose after an inline `<svg>` mention fails": 'Use `<svg>` here.\n\n<p>Hi</p>\n\n' + base,
        "a role added to a kit figure in a fenced code sample fails": base + '\n```mdx\n<ArchitectureDiagram nodes={[{ id: "a", label: "A", col: 0, row: 0 }]} />\n```\n',
        "solid on a shape with no fill attribute fails": base.replace('<text x="0" y="30" fill="currentColor">', '<circle cx="5" cy="5" r="2" />\n  <text x="0" y="30" fill="currentColor">'),
        "data-fig on a <title> fails": base.replace('<rect x="0" y="0"', '<title>Bars</title>\n  <rect x="0" y="0"'),
        "tint on a closed polygon inside a <marker> fails": base.replace('<path d="M1,1 L9,5 L1,9" fill="none" stroke="currentColor" strokeWidth="1" />', '<polygon points="1,1 9,5 1,9" fill="none" stroke="currentColor" />'),
    }
    own_base.update({name: side_base for name, _, _ in side_cases})
    own_base.update({name: label_base for name, _, _ in side_cases if "label says" in name})
    failed = 0
    for name, text, expect in cases:
        ok, msg = check(own_base.get(name, base), text, "selftest.mdx")
        status = "pass" if ok == expect else "FAIL"
        if ok != expect:
            failed += 1
        print(f"{status}: {name} (guard said {'ok' if ok else 'not ok'})")
        if ok != expect:
            print("  " + msg.replace("\n", "\n  "))
    # A role removed or changed against the base passes (the words are the same) but is noted.
    roled = base.replace('kind: "generic", col: 0', 'kind: "generic", role: "design", col: 0').replace('fill="currentColor">Testbench', 'fill="currentColor" data-fig="testbench">Testbench')
    note_cases = [
        ("a removed role is noted", roled, base, 'role "design" removed'),
        ("a swapped data-fig is noted", roled, roled.replace('data-fig="testbench"', 'data-fig="design"'), 'data-fig "testbench" changed to "design"'),
    ]
    for name, b, text, want in note_cases:
        ok, msg = check(b, text, "selftest.mdx")
        good = ok and want in msg
        failed += 0 if good else 1
        print(f"{'pass' if good else 'FAIL'}: {name} (guard said {'ok' if ok else 'not ok'})")
        if not good:
            print("  " + msg.replace("\n", "\n  "))
    # With --strict the same meaning changes fail.
    for name, b, text, _ in note_cases:
        ok, msg = check(b, text, "selftest.mdx", strict=True)
        failed += 1 if ok else 0
        print(f"{'pass' if not ok else 'FAIL'}: {name}, and fails with --strict (guard said {'ok' if ok else 'not ok'})")
        if ok:
            print("  " + msg.replace("\n", "\n  "))
    cases = cases + note_cases + note_cases
    # The modifier subset (DESIGN.md section 13): each failing case must fail for its own reason.
    subset = subset_cases()
    for name, b, text, expect, why in subset:
        ok, msg = check(b, text, "selftest.mdx")
        good = ok == expect and (ok or why.lower() in msg.lower())
        failed += 0 if good else 1
        print(f"{'pass' if good else 'FAIL'}: {name} (guard said {'ok' if ok else 'not ok'})")
        if not good:
            print("  " + msg.replace("\n", "\n  "))
    cases = cases + subset
    print(f"{len(cases) - failed} of {len(cases)} selftest cases behave as expected "
          f"({sum(1 for c in subset if not c[3])} failing and {sum(1 for c in subset if c[3])} passing cases of the modifier subset among them)")
    return 1 if failed else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--base", help="git ref to compare against, e.g. HEAD or origin/main")
    ap.add_argument("--strict", action="store_true", help="fail, not just note, when a role or data-fig the base had is dropped or changed")
    ap.add_argument("--all-findings", action="store_true", help="fail on every finding, also one the base already had (proves the lesson as it stands obeys the rules)")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("files", nargs="*")
    args = ap.parse_args(argv)
    if args.selftest:
        return selftest()
    if not args.base or not args.files:
        ap.error("give --base <ref> and at least one lesson file")
    bad = 0
    for f in args.files:
        try:
            base_text = git_show(args.base, f)
        except (FileNotFoundError, subprocess.CalledProcessError) as e:
            print(f"{f}: {e}")
            bad += 1
            continue
        ok, msg = check(base_text, open(f, encoding="utf8").read(), f, args.strict, args.all_findings)
        print(msg)
        if not ok:
            bad += 1
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
