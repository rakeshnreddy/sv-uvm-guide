#!/usr/bin/env python3
"""Check that a lesson colour pass changed nothing but figure roles.

Usage:
  figure-guard.py --base <git ref> [--strict] <lesson.mdx> [...]
  figure-guard.py --selftest

A file passes only if, after removing
- every allowed `role` property from the node objects of an
  <ArchitectureDiagram nodes={...}> and the participant objects of a
  <SequenceDiagram participants={...}> (role: "design", "role": 'testbench'…;
  one role key per object),
- every data-fig="…" attribute whose tokens are all allowed (at most one role,
  plus "tint" or "solid"), written as a top-level attribute of an opening tag
  of a shape, text, <g>, <marker> or <use> inside an <svg>…</svg>, one
  data-fig per tag ("tint" only on a rect, circle, ellipse, polygon or <g>,
  not inside a <marker> and not on a dashed shape; "solid" only with a role,
  without "tint", and only on a rect, circle, ellipse, path or polygon with
  fill="currentColor", no dash, a fill opacity and opacity above 0, and no
  <text> or <tspan> whose x,y anchor lies inside its box),
it is byte-identical to the same file at the base ref (the same removal is
applied to the base, so roles already there may stay). Tags are found by a
scanner that skips quoted strings, {…} expressions and inline code, so a "<"
inside a string never starts a tag. It fails, printing the first differing
hunk, on any other change, and also when a role or data-fig value is not
allowed, when a data-fig sits outside an <svg>, or when a role appears anywhere
else. A role or data-fig that the base had and the file drops or changes is
printed as a note; with --strict it fails. Standard library only. The rules are in
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
FIG_TOKENS = FIG_ROLES + ("tint", "solid")
# "solid" fills a mark with its role's stroke colour, so it needs a role, and it
# belongs on a shape filled in currentColor with no text on it (not on text, a
# <g> or a <marker>, not on an outline with fill="none", not on a dashed shape).
SOLID_TAGS = ("rect", "circle", "ellipse", "path", "polygon")
# "tint" is the soft fill of a closed box that holds text. On an open path or a
# polyline it would fill the area under the line; on a marker's path it would
# turn an open (control) arrowhead into a filled (data) one; on a dashed or
# hollow outline it would hide the emptiness that is the cue. On a <g> it only
# colours (the CSS fills no <g>).
TINT_TAGS = ("rect", "circle", "ellipse", "polygon", "g")
# data-fig draws only on these; on the <svg> root, <title>, <desc> or <defs> it
# would look like colour markup and draw nothing.
FIG_TAGS = ("path", "rect", "circle", "ellipse", "polygon", "polyline", "line", "text", "tspan", "g", "marker", "use")
# The role a tagged kind already has (figure-colours.ts figureRoleOf); any other
# tagged kind is testbench. A role must agree with it.
KIND_ROLE = {"generic": None, "dut": "design", "interface": "interface", "reg": "register"}

ROLE_PROP = re.compile(r"""["']?role["']?\s*:\s*(?:"([^"]*)"|'([^']*)')""")


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
        if c == "{":  # a spread {...props}
            i = _skip_expr(text, i + 1)
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
        kind = re.search(r"""["']?kind["']?\s*:\s*["']([\w-]+)["']""", obj)
        if kind and KIND_ROLE.get(kind.group(1), "testbench") not in (None, value):
            value = f"{value}\0{kind.group(1)}"
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
    markers = blocks(masked, opens, closes, "marker")
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
            if tag not in FIG_TAGS:
                errors.append(f'{label}:{ln}: data-fig on <{tag}>: it draws nothing there; put it on a shape, a text, a <g>, a <marker> or a <use> ({", ".join(FIG_TAGS)})')
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
            dashed = "strokeDasharray" in names or "stroke-dasharray" in names
            if "tint" in tokens:
                if tag in ("text", "tspan"):
                    errors.append(f'{label}:{ln}: data-fig="{value}" on <{tag}>: "tint" is the soft fill of a box, not of text')
                    continue
                if tag not in TINT_TAGS:
                    errors.append(f'{label}:{ln}: data-fig="{value}" on <{tag}>: "tint" goes only on a closed box ({", ".join(TINT_TAGS)}); on an open path, a polyline or a line it would fill the area under the line')
                    continue
                if inside(ta, markers):
                    errors.append(f'{label}:{ln}: data-fig="{value}" inside a <marker>: "tint" would fill an arrowhead, and a filled head means data where an open head means control')
                    continue
                if dashed:
                    errors.append(f'{label}:{ln}: data-fig="{value}" on a dashed <{tag}>: a dashed outline\'s emptiness is a cue that "tint" would hide')
                    continue
            if "solid" in tokens:
                if not any(t in FIG_ROLES for t in tokens):
                    errors.append(f'{label}:{ln}: data-fig="{value}": "solid" needs a role (data-fig="<role> solid")')
                    continue
                if "tint" in tokens:
                    errors.append(f'{label}:{ln}: data-fig="{value}": use "tint" (a box that holds text) or "solid" (a filled mark with no text on it), not both')
                    continue
                if tag not in SOLID_TAGS:
                    errors.append(f'{label}:{ln}: data-fig="{value}" on <{tag}>: "solid" goes on a filled shape ({", ".join(SOLID_TAGS)}), not on text, a <g> or a <marker>')
                    continue
                fill = names.get("fill", (None, None))
                if fill[0] not in ('"', "'") or fill[1] != "currentColor":
                    errors.append(f'{label}:{ln}: data-fig="{value}" on a <{tag}> whose fill is {fill[1]!r}: "solid" goes only on a shape filled in currentColor (fill="currentColor"); it would fill an outline or an open line')
                    continue
                if dashed:
                    errors.append(f'{label}:{ln}: data-fig="{value}" on a dashed <{tag}>: the dash is a non-colour cue that "solid" would hide')
                    continue
                zero = zero_opacity(names)
                if zero:
                    errors.append(f'{label}:{ln}: data-fig="{value}" on a <{tag}> whose {zero} is 0: it is drawn empty, and "solid" would fill it (an empty cell would read as a filled one)')
                    continue
                box = shape_box(tag, names)
                svg = next(((a, b) for a, b in svgs if a <= ta < b), None)
                if box and svg:
                    x0, y0, x1, y1 = box
                    hit = [(x, y) for x, y in text_anchors(masked, opens, *svg) if x0 <= x <= x1 and y0 <= y <= y1]
                    if hit:
                        errors.append(f'{label}:{ln}: data-fig="{value}" on a <{tag}> with text on it (a text anchored at {hit[0][0]:g},{hit[0][1]:g}): never put text on a solid fill; leave the shape as it is, or use "tint" for a box that holds text')
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


def check(base_text, cur_text, label="file", strict=False):
    """Return (ok, message). With strict, a meaning note (a role or data-fig the
    base had, dropped or changed) fails the file."""
    cur_norm, errors, cur_marks = normalise(cur_text, label)
    base_norm, base_errors, base_marks = normalise(base_text, label)
    # A finding the base file already had (say, `role: "x"` in an old code sample) is not this pass's doing.
    strip = lambda e: re.sub(r"^[^:]*:\d+: ", "", e)
    old = [strip(e) for e in base_errors]
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


def selftest():
    base = KIT_BASE + SVG_BASE
    cases = [
        ("allowed kit roles in two quotings pass", base.replace('kind: "generic", col: 0', 'kind: "generic", role: "design", col: 0').replace('label: "Slave", col', "label: \"Slave\", role: 'design', col").replace('{ id: "a", label: "A" }', '{ id: "a", label: "A", role: "testbench" }').replace('"label": "B" }', '"label": "B", "role": "design" }'), True),
        ("a role written first in its object passes", base.replace('{ id: "m",', '{ role: "design", id: "m",'), True),
        ("solid with a role on a filled mark passes", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="testbench solid" />').replace('fill="currentColor">Testbench', 'fill="currentColor" data-fig="testbench">Testbench'), True),
        ("solid without a role fails", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="solid" />'), False),
        ("solid together with tint fails", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="testbench tint solid" />'), False),
        ("solid on text fails", base.replace('fill="currentColor">Testbench', 'fill="currentColor" data-fig="testbench solid">Testbench'), False),
        ("visible svg text that gains the words data-fig=\"testbench solid\" fails", base.replace('>Testbench</text>', '>Testbench data-fig="testbench solid"</text>'), False),
        ("visible svg text that gains the word solid fails", base.replace('>Testbench</text>', '>Testbench solid</text>').replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="testbench solid" />'), False),
        ("allowed data-fig tokens pass", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="testbench" />').replace('fill="currentColor">Testbench', 'fill="currentColor" data-fig="testbench">Testbench'), True),
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
        ("solid on a bar whose label sits beside it passes", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="match solid" />'), True),
        ("tint on an open path with fill=\"none\" fails (A13)", base.replace('fill="none" stroke="currentColor" />', 'fill="none" stroke="currentColor" data-fig="design tint" />'), False),
        ("tint on a dashed fill=\"none\" outline fails (A13b)", base.replace('strokeDasharray="3 2" />', 'strokeDasharray="3 2" data-fig="tint" />'), False),
        ("tint on a marker's arrowhead path fails", base.replace('strokeWidth="1" />', 'strokeWidth="1" data-fig="design tint" />'), False),
        ("tint on a <marker> fails", base.replace('<marker id="head">', '<marker id="head" data-fig="design tint">'), False),
        ("tint on a polyline fails", base.replace('strokeWidth="2" />', 'strokeWidth="2" data-fig="data tint" />'), False),
        ("tint on a closed solid-outline box passes", base.replace('strokeWidth="1.5" />', 'strokeWidth="1.5" data-fig="design tint" />'), True),
        ("tint on a <g> passes", base.replace('<g transform="translate(0 0)">', '<g transform="translate(0 0)" data-fig="design tint">'), True),
        ("tint on a closed polygon inside a <marker> fails", base.replace('<path d="M1,1 L9,5 L1,9" fill="none" stroke="currentColor" strokeWidth="1" />', '<polygon points="1,1 9,5 1,9" fill="none" stroke="currentColor" data-fig="design tint" />'), False),
        ("two data-fig attributes on one tag fail (A10)", base.replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="design" data-fig="testbench" />'), False),
    ]
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
    roled = base.replace('kind: "generic", col: 0', 'kind: "generic", role: "design", col: 0').replace('fillOpacity="0.6" />', 'fillOpacity="0.6" data-fig="testbench" />')
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
    print(f"{len(cases) - failed} of {len(cases)} selftest cases behave as expected")
    return 1 if failed else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--base", help="git ref to compare against, e.g. HEAD or origin/main")
    ap.add_argument("--strict", action="store_true", help="fail, not just note, when a role or data-fig the base had is dropped or changed")
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
        ok, msg = check(base_text, open(f, encoding="utf8").read(), f, args.strict)
        print(msg)
        if not ok:
            bad += 1
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
