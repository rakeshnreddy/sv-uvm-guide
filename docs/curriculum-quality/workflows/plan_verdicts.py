"""Rebuild plan.md §2's verdict table from the analysis and verify reports."""
import pathlib, re
root = pathlib.Path('/Users/Rakesh/Projects/sv-uvm-guide')
adir = root / 'docs/curriculum-quality/analysis'
plan = root / 'docs/curriculum-quality/plan.md'

# Verifier verdict changes, applied by the lead after reading each .verify.md.
OVERRIDES = {
    ('L17', 'I-SV-5_Synchronization_and_IPC'): '**rewrite** (verifier: major → rewrite)',
    ('L42', 'E-DBG-1_Advanced_UVM_Debug_Methodologies'): '**major** (index, hang-lab); `effective-debug.mdx` **rewrite** (verifier)',
    ('L44', 'E-PSS-1_Portable_Stimulus_Standard'): '**rewrite** (verifier: major → rewrite, lead accepted)',
    ('L47', 'E-SOC-1_SoC-Level_Verification_Strategies'): '**rewrite** (verifier: major → rewrite)',
    ('L15', 'I-SV-4A_SVA_Fundamentals'): '**major** (index); `immediate-vs-concurrent.mdx` **rewrite** (verifier)',
    ('L16', 'I-SV-4B_Advanced_Temporal_Logic'): '**major** (index); `local-variables.mdx` and `multi-clocking.mdx` **rewrite** (verifier); lab `assertions-1` **rewrite**',
    ('L25', 'I-UVM-6_UVM_Recording_Classes'): '**rewrite** (verifier: major → rewrite)',
    ('L27', 'A-UVM-4B_Advanced_RAL_Techniques'): '**major** (index); `explicit-vs-implicit`, `frontdoor-vs-backdoor`, `built-in-ral-sequences` **rewrite** (verifier, lead accepted)',
}

def ranges(ids):
    if not ids:
        return 'none'
    nums = [int(x[1:]) for x in ids]
    out, s = [], nums[0]
    for a, b in zip(nums, nums[1:] + [None]):
        if b != a + 1:
            out.append(f'L{s:02d}' if s == a else f'L{s:02d}–L{a:02d}')
            s = b
    return ', '.join(out)

rows, missing, unverified = [], [], []
for n in range(1, 49):
    gid = f'L{n:02d}'
    f = adir / f'{gid}.md'
    if not f.exists():
        missing.append(gid); continue
    verified = (adir / f'{gid}.verify.md').exists()
    if not verified:
        unverified.append(gid)
    lines = f.read_text().splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith('## Summary'))
    header = None
    for l in lines[start + 1:]:
        if not l.startswith('|'):
            if header: break
            continue
        cells = [c.strip() for c in l.strip().strip('|').split('|')]
        if header is None:
            header = cells; continue
        if set(cells[0]) <= set('-: '):
            continue
        rec = dict(zip(header, cells))
        mod = rec['Module'].strip('`')
        verdict = OVERRIDES.get((gid, mod), rec['Verdict'])
        scores = ' '.join(rec[f'R{k}'] for k in range(1, 10))
        rows.append(f"| {gid} | {mod} | {verdict} | {scores} | {rec['S1/S2/S3/S4']} | {rec['Effort']} | {'✓' if verified else 'pending'} |")

text = plan.read_text()
head = '| Group | Module | Verdict | R1 R2 R3 R4 R5 R6 R7 R8 R9 | S1/S2/S3/S4 | Effort | Verified |\n|---|---|---|---|---|---|---|\n'
i = text.index(head) + len(head)
j = text.index('| G29 |', i)
text = text[:i] + '\n'.join(rows) + '\n' + text[j:]
pend = re.search(r'\nPending analysis:[^\n]*\n', text)
text = text[:pend.start()] + f'\nPending analysis: {ranges(missing)}. Pending verification: {ranges(unverified)}.\n' + text[pend.end():]
plan.write_text(text)
print(len(rows), 'rows; missing', ranges(missing), '; unverified', ranges(unverified))
