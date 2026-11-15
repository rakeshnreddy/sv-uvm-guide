#!/usr/bin/env python3
"""List every figure in lesson MDX files and what a colour pass could do.

Usage:
  figure-scan.py [--tiers T3_Advanced,T4_Expert] [--json OUT] [lesson.mdx ...]

With no files and no --tiers it scans all of content/curriculum. For each
lesson it prints every figure with its line range:

- ArchitectureDiagram: title, nodes, nodes of kind "generic" (or no kind)
  with no role, edges.
- SequenceDiagram: title, participants, participants with neither kind nor role.
- TimingDiagram: counted only (the kit already colours values).
- hand-drawn <svg>: monochrome (only currentColor and neutrals), a little
  colour, or colourful; whether any data-fig is present; whether its
  figcaption names a colour (a colour pass must keep that sentence true).
- For every figure: a WARNING when its caption (kit caption prop or
  <Caption>, or the svg's figcaption) or the paragraph just before or after
  it names a colour.

A lesson where no figure is a candidate is reported as "nothing to do".
Standard library only. The rules for assigning roles are in
docs/planning/site-design-refresh-2026-11-10/DESIGN.md section 13.
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
CURRICULUM = os.path.join(ROOT, "content", "curriculum")

KIT = ("ArchitectureDiagram", "SequenceDiagram", "TimingDiagram")
HUES = ("rose", "amber", "cyan", "violet", "emerald", "sky", "indigo", "teal", "red", "green", "blue", "yellow", "orange", "purple", "pink", "lime", "fuchsia")
NEUTRAL_CLASS = ("current", "none", "transparent", "foreground", "muted", "background", "card", "border", "subtle", "slate", "gray", "zinc", "neutral", "stone", "black", "white")
COLOUR_WORDS = re.compile(
    r"\b(red|green|blue|cyan|amber|yellow|orange|violet|purple|indigo|teal|emerald|rose|pink|grey|gray|slate|sky|magenta|colou?red|colou?r)\b",
    re.I,
)


def blank_code_fences(text):
    """Replace fenced code blocks with spaces (keeping newlines) so their contents are not scanned."""
    return re.sub(r"```[\s\S]*?```", lambda m: re.sub(r"[^\n]", " ", m.group(0)), text)


def line_of(text, index):
    return text.count("\n", 0, index) + 1


def jsx_element_end(text, start):
    """End index (exclusive) of the JSX opening tag that starts at `start`, honouring strings and braces."""
    i = start
    depth = 0
    quote = None
    n = len(text)
    while i < n:
        c = text[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif depth == 0 and c == ">":
            return i + 1
        i += 1
    return n


def prop_expression(tag, name):
    """The text of a {…} prop (without the outer braces), or None."""
    m = re.search(r"\b" + re.escape(name) + r"=\{", tag)
    if not m:
        return None
    i = m.end()
    depth = 1
    quote = None
    start = i
    while i < len(tag):
        c = tag[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
        elif c in "{[(":
            depth += 1
        elif c in "}])":
            depth -= 1
            if depth == 0:
                return tag[start:i]
        i += 1
    return None


def prop_string(tag, name):
    m = re.search(r"\b" + re.escape(name) + r'=(?:"([^"]*)"|\{\s*"([^"]*)"\s*\}|\{\s*\'([^\']*)\'\s*\})', tag)
    if not m:
        return None
    return next(g for g in m.groups() if g is not None)


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


def colour_words(text):
    return sorted({w.lower() for w in COLOUR_WORDS.findall(text or "")})


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
        caption = prop_string(tag, "caption") or ""
        if not tag.rstrip().endswith("/>"):
            close = text.find(f"</{name}>", end)
            if close >= 0:
                inner = text[end:close]
                caption += " " + " ".join(re.findall(r"<Caption[^>]*>([\s\S]*?)</Caption>", inner))
                end = close + len(f"</{name}>")
        fig["captionColours"] = colour_words(caption)
        fig["nearbyColours"] = nearby_colours(text, m.start(), end)
        if name == "ArchitectureDiagram":
            nodes = array_items(prop_expression(tag, "nodes"))
            fig["nodes"] = len(nodes)
            fig["genericNoRole"] = sum(1 for n in nodes if untyped(n))
            fig["withRole"] = sum(1 for n in nodes if key_value(n, "role") is not None)
            fig["edges"] = len(array_items(prop_expression(tag, "edges")))
            fig["candidate"] = fig["genericNoRole"] > 0
        elif name == "SequenceDiagram":
            parts = array_items(prop_expression(tag, "participants"))
            fig["participants"] = len(parts)
            fig["untyped"] = sum(1 for p in parts if untyped(p))
            fig["withRole"] = sum(1 for p in parts if key_value(p, "role") is not None)
            fig["candidate"] = fig["untyped"] > 0
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
            "markers": svg.count("<marker"),
            "figcaption": bool(cap),
            "captionColours": caption_colours,
            "nearbyColours": nearby_colours(text, fig_start, fig_end),
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


def describe(fig):
    lines = f"{fig['lines'][0]}-{fig['lines'][1]}"
    title = f' "{fig["title"]}"' if fig.get("title") else ""
    t = fig["type"]
    if t == "ArchitectureDiagram":
        todo = f"{fig['genericNoRole']} generic node(s) could take a role" if fig["candidate"] else "nothing: every node has a kind or role"
        return f"  {lines} architecture{title}: {fig['nodes']} nodes, {fig['genericNoRole']} generic with no role, {fig['edges']} edges -> {todo}" + colour_note(fig)
    if t == "SequenceDiagram":
        todo = f"{fig['untyped']} participant(s) could take a role" if fig["candidate"] else "nothing: every participant has a kind or role"
        return f"  {lines} sequence{title}: {fig['participants']} participants, {fig['untyped']} with neither kind nor role -> {todo}" + colour_note(fig)
    if t == "TimingDiagram":
        return f"  {lines} timing{title} -> nothing (the kit colours values)"
    cap = ""
    if fig["figcaption"]:
        cap = f", caption names colour: {', '.join(fig['captionColours'])}" if fig["captionColours"] else ", caption names no colour"
    else:
        cap = ", no figcaption"
    df = ", has data-fig" if fig["dataFig"] else ""
    todo = "mark parts with data-fig where the meaning is certain" if fig["candidate"] else "nothing"
    if fig["colour"] == "little" and fig["candidate"]:
        todo = "check: a little colour; mark the remaining parts only if the meaning is certain"
    near = f"\n      WARNING: nearby prose names colour: {', '.join(fig['nearbyColours'])} (keep those sentences true)" if fig.get("nearbyColours") else ""
    return f"  {lines} svg{title}: {fig['colour']} ({fig['colouredShapes']}/{fig['shapes']} coloured shapes, {fig['markers']} marker(s){df}{cap}) -> {todo}" + near


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("files", nargs="*", help="lesson .mdx files (default: every lesson, or the --tiers)")
    ap.add_argument("--tiers", help="comma-separated tier folders, e.g. T3_Advanced,T4_Expert")
    ap.add_argument("--json", dest="json_out", help="write the full result as JSON to this path")
    ap.add_argument("--work-only", action="store_true", help="print only lessons with something to do")
    args = ap.parse_args(argv)

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
    totals["kitCaptionNamesColour"] = sum(1 for r in results for f in r["figures"] if f["type"] != "svg" and f.get("captionColours"))
    totals["nearbyProseNamesColour"] = sum(1 for r in results for f in r["figures"] if f.get("nearbyColours"))
    totals["genericNodes"] = sum(f.get("genericNoRole", 0) for r in results for f in r["figures"])
    totals["untypedParticipants"] = sum(f.get("untyped", 0) for r in results for f in r["figures"])

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
    print("Hand-drawn svg: " + (", ".join(f"{k} {v}" for k, v in sorted(totals["svgColour"].items())) or "none") + f"; captions that name a colour: {totals['svgCaptionNamesColour']}")
    print(f"Kit captions that name a colour: {totals['kitCaptionNamesColour']}; figures whose neighbouring prose names a colour: {totals['nearbyProseNamesColour']}")
    print(f"Generic nodes with no role: {totals['genericNodes']}; participants with neither kind nor role: {totals['untypedParticipants']}")

    if args.json_out:
        with open(args.json_out, "w", encoding="utf8") as fh:
            json.dump({"totals": totals, "lessons": results}, fh, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
