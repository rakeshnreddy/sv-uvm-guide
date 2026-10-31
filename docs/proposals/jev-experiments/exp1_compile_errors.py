"""Experiment 1: can Jev tell a Verilator limitation from a bug in the code, from the error lines and nearby code?
Labels: units fixed in the compile-fix pass = code_bug; units confirmed as limitations by the probe pass = limitation."""
import json, os, re, subprocess, sys, urllib.request
S = os.environ["SCR"]; ROOT = "/Users/Rakesh/Projects/sv-uvm-guide"; BASE = "7fc2a1d8"  # commit before any fix
key = os.environ["TYPESAFE_API_KEY"]
def load(p):
    d = json.load(open(p)); return d["result"] if isinstance(d, dict) and "result" in d else d
labels = {}
for u in (x for g in load(f"{S}/compile-fix-result.json") for x in (g.get("fix") or {}).get("units", [])):
    labels[u["id"]] = "code_bug" if u["status"] == "pass" else ("harness" if u["kind"] == "harness" else "limitation")
for u in (x for g in load(f"{S}/probe-result.json") for x in (g.get("fix") or {}).get("units", [])):
    labels[u["id"]] = "limitation"
groups = load(f"{S}/compile-fix-args.json") + load(f"{S}/cf2-args.min.json")
def git_show(path):
    try: return subprocess.run(["git", "-C", ROOT, "show", f"{BASE}:{path}"], capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError: return ""
def window(text, line, n=14):
    lines = text.splitlines(); a, b = max(0, line - n), min(len(lines), line + n)
    return "\n".join(lines[a:b])
items = []
for g in groups:
    for u in g["units"]:
        if u["id"] not in labels: continue
        errs = [e for e in u["errors"] if not e.startswith("%Error: Exiting")][:4]
        snippet = ""
        m = re.search(r"\(lesson line (\d+)\)", " ".join(errs))
        if m:
            snippet = window(git_show(f"content/curriculum/{g['source']}.mdx"), int(m.group(1)))
        else:
            m2 = re.search(r"([\w./-]+\.(?:sv|svh)):(\d+):", " ".join(errs))
            if m2:
                d = g["files"][0] if g["files"][0].endswith("/") else os.path.dirname(g["files"][0]) + "/"
                snippet = window(git_show(d + m2.group(1)), int(m2.group(2)))
        errs = [re.sub(r"/var/folders/\S+/(?:u\d+/)?", "", e) for e in errs]
        items.append({"id": u["id"], "label": labels[u["id"]], "errors": errs, "code": snippet[:3500]})
print(f"{len(items)} labelled units:", {l: sum(1 for i in items if i['label'] == l) for l in set(i['label'] for i in items)})
QUESTIONS = {
  "tool_limitation": {"type": "noul",
    "instructions": "Is this compile error caused by the Verilator tool not supporting a legal SystemVerilog construct that `code_near_error` uses?",
    "criteria": {"true": "The construct is legal SystemVerilog, and the error reports it as unsupported, not implemented, an internal error, or a legal name or member the tool cannot resolve.",
                 "false": "The code itself breaks a language rule, for example a reserved word used as an identifier, a missing endmodule, mismatched time units between files, or a name that is never declared."}},
  "code_bug": {"type": "noul",
    "instructions": "Does `code_near_error` contain a mistake that would fail on any standard-compliant SystemVerilog compiler?",
    "criteria": {"true": "A syntax error, a reserved word used as an identifier, a missing end keyword, an undeclared name, or files with different time units.",
                 "false": "The code is legal SystemVerilog; only this tool rejects it."}},
  "kind": {"type": "choice", "instructions": "What is the cause of `error_lines`?",
    "criteria": {"verilator_limitation": "Legal SystemVerilog that Verilator does not support or crashes on.",
                 "mistake_in_the_code": "The code breaks a SystemVerilog language rule.",
                 "missing_file_or_setup": "A file, module or include the code depends on was not given to the compiler."}},
}
total_tokens = 0; rows = []
for it in items:
    body = {"model": "jev-latest", "state": {"error_lines": it["errors"], "code_near_error": it["code"]}, "questions": QUESTIONS}
    req = urllib.request.Request("https://api.typesafe.ai/v1/systemone", data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: ans = json.load(r)
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read()[:300]); sys.exit(1)
    a = ans["answers"]; total_tokens += ans.get("usage", {}).get("input_tokens", 0)
    rows.append({"id": it["id"], "label": it["label"], "lim": a["tool_limitation"]["noul"], "bug": a["code_bug"]["noul"],
                 "kind": a["kind"]["choice"], "kind_p": a["kind"]["probabilities"]})
json.dump(rows, open(f"{S}/jev/exp1_rows.json", "w"), indent=1)
def band(p): return "yes" if p >= 0.7 else ("no" if p <= 0.3 else "unsure")
for lab in ("limitation", "code_bug", "harness"):
    rs = [r for r in rows if r["label"] == lab]
    if not rs: continue
    print(f"\n{lab} (n={len(rs)}): mean tool_limitation={sum(r['lim'] for r in rs)/len(rs):.2f} mean code_bug={sum(r['bug'] for r in rs)/len(rs):.2f}")
    print("  tool_limitation bands:", {b: sum(1 for r in rs if band(r['lim']) == b) for b in ('yes', 'unsure', 'no')},
          "| kind choice:", {k: sum(1 for r in rs if r['kind'] == k) for k in set(r['kind'] for r in rs)})
want = {"limitation": "verilator_limitation", "code_bug": "mistake_in_the_code", "harness": "missing_file_or_setup"}
wrong = [r for r in rows if r["kind"] != want[r["label"]]]
print(f"\nChoice top-1 accuracy: {len(rows)-len(wrong)}/{len(rows)}")
for r in wrong: print(f"  MISS {r['id'].split('curriculum/')[-1][:70]} label={r['label']} choice={r['kind']} lim={r['lim']:.2f} bug={r['bug']:.2f}")
print(f"\ninput tokens: {total_tokens}  (~${total_tokens*0.042/1e6:.4f})")
