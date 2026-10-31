// Experiment 2: rerank the real lexical search's top 15 with one Noul per candidate (cookbook: re-ranking).
import fs from "node:fs";
import * as engine from "/Users/Rakesh/Projects/sv-uvm-guide/src/components/search/search-engine";
const { searchCurriculum } = engine as any;
const raw = JSON.parse(fs.readFileSync("/Users/Rakesh/Projects/sv-uvm-guide/src/generated/search-index.json", "utf8"));
const rawDocs: any[] = Array.isArray(raw) ? raw : (Object.values(raw).find((v) => Array.isArray(v)) as any[]);
const builderName = Object.keys(engine).find((k) => /build|prepare|create|hydrate|toSearch|fromIndex|index/i.test(k) && typeof (engine as any)[k] === "function");
console.log("builder:", builderName, "| raw doc keys:", Object.keys(rawDocs[0]).join(","));
const docs: any[] = (engine as any).prepareSearchDocuments(raw);
const key = process.env.TYPESAFE_API_KEY!;
// Hand labels: the module codes a learner would expect to land in.
const QUERIES: [string, string[]][] = [
  ["why doesn't my always_comb run at time zero", ["F2C", "F3A"]],
  ["difference between == and === when a signal is x", ["F2A", "F1B"]],
  ["what is a vacuous success in an assertion", ["F1B", "I-SV-4A"]],
  ["how do uvm_config_db set and get find each other", ["I-UVM-2C"]],
  ["what does a virtual sequencer do", ["I-UVM-3B"]],
  ["AXI wrapping burst address calculation", ["B-AXI-2"]],
  ["AHB two cycle error response HRESP HREADY", ["B-AHB-1", "B-AHB-2"]],
  ["should I use a mailbox or a semaphore", ["F2D", "I-SV-5"]],
  ["sequence lock versus grab on a sequencer", ["I-UVM-3B"]],
  ["which processes does disable fork kill", ["F2C", "I-SV-5"]],
  ["ignore_bins in a covergroup cross", ["I-SV-3A", "I-SV-3B"]],
  ["why does my scoreboard compare pass when the output is x", ["F1B", "F2A", "F2E"]],
];
let tokens = 0, lexHits = 0, jevHits = 0, lexTop5 = 0, jevTop5 = 0;
const KW: Record<string,string> = {"why doesn't my always_comb run at time zero": "always_comb time zero", "difference between == and === when a signal is x": "equality x", "what is a vacuous success in an assertion": "vacuous success", "how do uvm_config_db set and get find each other": "uvm_config_db set get", "what does a virtual sequencer do": "virtual sequencer", "AXI wrapping burst address calculation": "wrap burst address", "AHB two cycle error response HRESP HREADY": "error response HRESP", "should I use a mailbox or a semaphore": "mailbox semaphore", "sequence lock versus grab on a sequencer": "lock grab", "which processes does disable fork kill": "disable fork", "ignore_bins in a covergroup cross": "ignore_bins cross", "why does my scoreboard compare pass when the output is x": "scoreboard x"};
console.log("AND check:", searchCurriculum(docs, "mailbox semaphore", 3).length, "results for \"mailbox semaphore\";", searchCurriculum(docs, "mailbox or semaphore", 3).length, "for \"mailbox or semaphore\";", searchCurriculum(docs, "use mailbox semaphore", 3).length, "for \"use mailbox semaphore\"");
for (const [q, want] of QUERIES) {
  const seen = new Set<string>(); const cands: any[] = [];
  for (const r of [...searchCurriculum(docs, q, 15), ...searchCurriculum(docs, KW[q], 15)]) { if (!seen.has(r.doc.id)) { seen.add(r.doc.id); cands.push(r); } }
  cands.splice(15);
  const ok = (r: any) => !!r && want.includes(r.doc.code);
  if (!cands.length) { console.log(`L✗ J✗  ${q}\n     lexical returned NO candidates`); continue; }
  lexHits += ok(cands[0]) ? 1 : 0; lexTop5 += cands.slice(0, 5).some(ok) ? 1 : 0;
  const questions: Record<string, any> = {};
  cands.forEach((r, i) => {
    const d = r.doc;
    questions[`c${i}`] = { type: "noul",
      instructions: `Does this curriculum section answer \`query\`?\nSection: ${d.moduleTitle} > ${d.lessonTitle} > ${d.title}\nText: ${String(d.text ?? d.snippet ?? (d.fields ?? []).map((f: any) => f.text).join(" | ")).slice(0, 700)}`,
      criteria: { true: "A learner who opens this section finds the explanation or rule that the query asks about.",
                  false: "The section only mentions the same words, or covers a neighbouring topic." } };
  });
  const res = await fetch("https://api.typesafe.ai/v1/systemone", { method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "jev-latest", state: { query: q }, questions }) });
  if (!res.ok) { console.log("HTTP", res.status, (await res.text()).slice(0, 300)); process.exit(1); }
  const ans: any = await res.json(); tokens += ans.usage?.input_tokens ?? 0;
  const rer = cands.map((r, i) => ({ r, p: ans.answers[`c${i}`].noul })).sort((a, b) => b.p - a.p);
  jevHits += ok(rer[0].r) ? 1 : 0; jevTop5 += rer.slice(0, 5).some((x) => ok(x.r)) ? 1 : 0;
  console.log(`${ok(cands[0]) ? "L✓" : "L✗"} ${ok(rer[0].r) ? "J✓" : "J✗"}  ${q}\n     lexical: ${cands[0].doc.code} ${cands[0].doc.title.slice(0, 50)}\n     jev:     ${rer[0].r.doc.code} ${rer[0].r.doc.title.slice(0, 50)} (p=${rer[0].p.toFixed(2)}; best-candidate p=${Math.max(...rer.map(x=>x.p)).toFixed(2)})`);
}
console.log(`\nTop-1 module hit: lexical ${lexHits}/12, jev-reranked ${jevHits}/12 | top-5: lexical ${lexTop5}/12, jev ${jevTop5}/12 | input tokens ${tokens} (~$${(tokens*0.042/1e6).toFixed(4)})`);
