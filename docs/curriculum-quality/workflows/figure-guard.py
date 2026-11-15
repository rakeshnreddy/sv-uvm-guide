#!/usr/bin/env python3
"""Check that a lesson colour pass changed nothing but figure roles.

Usage:
  figure-guard.py --base <git ref> <lesson.mdx> [...]
  figure-guard.py --selftest

A file passes only if, after removing
- every allowed `role` property from the node objects of an
  <ArchitectureDiagram nodes={...}> and the participant objects of a
  <SequenceDiagram participants={...}> (role: "design", "role": 'testbench'…),
- every data-fig="…" attribute whose tokens are all allowed, inside an
  <svg>…</svg>,
it is byte-identical to the same file at the base ref (the same removal is
applied to the base, so roles already there may stay). It fails, printing the
first differing hunk, on any other change, and also when a role or data-fig
value is not allowed, when a data-fig sits outside an <svg>, or when a role
appears anywhere else. Standard library only. The rules are in
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
FIG_TOKENS = FIG_ROLES + ("tint",)
# The role a tagged kind already has (figure-colours.ts figureRoleOf); any other
# tagged kind is testbench. A role must agree with it.
KIND_ROLE = {"generic": None, "dut": "design", "interface": "interface", "reg": "register"}

ROLE_PROP = re.compile(r"""["']?role["']?\s*:\s*(?:"([^"]*)"|'([^']*)')""")
FIG_ATTR = re.compile(r"""\s+data-fig=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})""")


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
    """Index of the `>` that ends the tag whose name starts at text[i], honouring strings and braces."""
    depth = 0
    while i < len(text):
        c = text[i]
        if c in "\"'`" and (depth > 0 or c != "'" or text[i - 1] in "= "):
            i = _skip_string(text, i)
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif c == ">" and depth == 0:
            return i
        i += 1
    return len(text)


def role_regions(text):
    """(start, end) spans of the nodes={…} / participants={…} expressions of kit figures."""
    spans = []
    for m in re.finditer(r"<(ArchitectureDiagram|SequenceDiagram)\b", text):
        tag_end = _tag_end(text, m.end())
        prop = "nodes" if m.group(1) == "ArchitectureDiagram" else "participants"
        for p in re.finditer(r"\b" + prop + r"=\{", text[m.end():tag_end]):
            start = m.end() + p.end()
            spans.append((start, _scan_braced(text, start)))
    return spans


def top_level_roles(text, a, b):
    """Each `role` written as a top-level key of an object in the array at text[a:b]:
    (key start, cut start, cut end, value). Roles inside strings or nested objects are not keys."""
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
                        found.append((j, m, text[i:end]))
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
                        found.append((j, m, text[i:end]))
                j += 1
            i = end
            continue
        i += 1
    out = []
    for j, m, obj in found:
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
    return out


def svg_regions(text):
    return [(m.start(), m.end()) for m in re.finditer(r"<svg\b[\s\S]*?</svg>", text)]


def tag_spans(text):
    """(start, end) of every opening or self-closing tag `<name …>`."""
    spans = []
    for m in re.finditer(r"<([A-Za-z][\w.:-]*)", text):
        spans.append((m.start(), _tag_end(text, m.end())))
    return spans


def inside(pos, spans):
    return any(a <= pos < b for a, b in spans)


def normalise(text, label):
    """Remove allowed roles and data-fig attributes; return (text, errors, marks).

    `marks` maps each removal's offset in the returned text to what was removed
    there (("role", value) or ("data-fig", value)), so two files whose
    normalised texts agree can be compared for meaning changes."""
    errors = []
    lineno = lambda pos: text.count("\n", 0, pos) + 1
    masked = mask_code(text)
    roles = role_regions(masked)
    svgs = svg_regions(masked)
    cuts = []

    keys = []
    for a, b in roles:
        keys.extend(top_level_roles(masked, a, b))
    for m in re.finditer(r"""(?<![\w-])["']?role["']?\s*:\s*["']""", masked):
        if not inside(m.start(), roles):
            errors.append(f"{label}:{lineno(m.start())}: a role property outside the nodes or participants of a kit figure")
    for start, cut_a, cut_b, value in keys:
        if "\0" in value:
            role, kind = value.split("\0")
            errors.append(f'{label}:{lineno(start)}: role "{role}" disagrees with kind "{kind}"; drop the role or make them agree')
        elif value not in KIT_ROLES:
            errors.append(f'{label}:{lineno(start)}: role "{value}" is not allowed (use one of {", ".join(KIT_ROLES)})')
        else:
            cuts.append((cut_a, cut_b, ("role", value)))

    # data-fig counts only as an attribute inside an opening tag; written in a
    # tag's text content it is visible words and stays in the comparison.
    for ta, tb in tag_spans(masked):
        for m in FIG_ATTR.finditer(masked, ta, tb):
            if m.group(3) is not None or m.group(2) is not None:
                errors.append(f'{label}:{lineno(m.start())}: write data-fig as data-fig="…" with double quotes')
                continue
            if not inside(ta, svgs):
                errors.append(f"{label}:{lineno(m.start())}: data-fig outside an <svg>")
                continue
            tokens = m.group(1).split()
            bad = [t for t in tokens if t not in FIG_TOKENS]
            if bad or not tokens:
                errors.append(f'{label}:{lineno(m.start())}: data-fig="{m.group(1)}" has a value that is not allowed: {", ".join(bad) or "(empty)"}')
                continue
            cuts.append((m.start(), m.end(), ("data-fig", m.group(1))))

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


def check(base_text, cur_text, label="file"):
    """Return (ok, message)."""
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
<svg viewBox="0 0 100 40" role="img" aria-label="Two bars">
  <rect x="0" y="0" width="60" height="10" fill="currentColor" fillOpacity="0.6" />
  <text x="0" y="30" fill="currentColor">Testbench</text>
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
    ]
    # Bases for the two code-sample cases differ from `base`; compare those with their own base.
    own_base = {
        "...and the same sample with a role in it fails": base + '\n```mdx\n<ArchitectureDiagram nodes={[{ id: "a", label: "A", col: 0, row: 0 }]} />\n```\n',
        "a data-fig in a fenced svg code sample fails": base + '\n```html\n<svg viewBox="0 0 1 1"><rect x="0" /></svg>\n```\n',
        "a data-fig on prose after an inline `<svg>` mention fails": 'Use `<svg>` here.\n\n<p>Hi</p>\n\n' + base,
        "a role added to a kit figure in a fenced code sample fails": base + '\n```mdx\n<ArchitectureDiagram nodes={[{ id: "a", label: "A", col: 0, row: 0 }]} />\n```\n',
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
    cases = cases + note_cases
    print(f"{len(cases) - failed} of {len(cases)} selftest cases behave as expected")
    return 1 if failed else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--base", help="git ref to compare against, e.g. HEAD or origin/main")
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
        ok, msg = check(base_text, open(f, encoding="utf8").read(), f)
        print(msg)
        if not ok:
            bad += 1
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
