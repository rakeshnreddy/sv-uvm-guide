"use strict";

const fs = require("node:fs");

const releasedRoutes = new Set([
  "T1_Foundational/F1A_The_Cost_of_Bugs/index",
  "T1_Foundational/F1B_The_Verification_Mindset/index",
  "T1_Foundational/F1C_Why_SystemVerilog/index",
  "T1_Foundational/F2A_Core_Data_Types/index",
  "T1_Foundational/F2A_Core_Data_Types/structs-unions-enums",
]);

const key = ({ gate, visual, label, width, theme }) => JSON.stringify([gate, visual, label, width, theme]);

function releasedFindings(gates, crops = new Map()) {
  const findings = new Map();
  for (const [gate, outcome] of Object.entries(gates)) {
    if (outcome.status !== "FAIL") continue;
    const entries = gate === "G5" ? [...outcome.details?.bad || [], ...outcome.details?.unmeasured || []]
      : /^G(?:6|1[1-7])$/.test(gate) && Array.isArray(outcome.details) ? outcome.details : [];
    for (const { figure, line, label, width, theme, value, ratio, size } of entries) {
      if (!(figure && line && label && width && theme)) continue;
      const images = crops.get(JSON.stringify([line, width, theme]));
      const finding = { gate, visual: `${figure}@${line}`, label, width, theme,
        value: value ?? (gate === "G6" ? `${size.toFixed(2)} px` : ratio == null ? "unmeasured" : `${ratio.toFixed(2)}:1`),
        ...(images ? { crops: images } : {}),
      };
      findings.set(key(finding), finding);
    }
  }
  return [...findings.values()];
}

function releaseStatus(gates, findings, baseline, visual) {
  const byKey = new Map(baseline.map(finding => [key(finding), finding]));
  const seen = new Set(findings.map(key));
  const newFindings = findings.filter(finding => !byKey.has(key(finding)));
  const cleared = baseline.filter(finding => !seen.has(key(finding)) &&
    (!visual || finding.visual === visual) && gates[finding.gate] && gates[finding.gate].status !== "SKIPPED");
  const retained = findings.length - newFindings.length;
  for (const [gate, outcome] of Object.entries(gates)) {
    const total = findings.filter(finding => finding.gate === gate).length;
    if (!total) continue;
    const added = newFindings.filter(finding => finding.gate === gate).length;
    const unmeasured = gate === "G5" && outcome.details?.unmeasured?.some(finding => !finding.figure);
    gates[gate] = { ...outcome, status: added || unmeasured ? "FAIL" : "PASS",
      summary: `(${total - added} baseline, ${added} new) ${outcome.summary}` };
  }
  return { retained, newFindings, cleared };
}

function writeReleasedBaseline(file, { lesson, base, head, gates, findings, decisions, kitNotes, incomplete }) {
  if (incomplete || Object.entries(gates).some(([gate, outcome]) =>
    outcome.status === "FAIL" && gate !== "G9" && !findings.some(finding => finding.gate === gate))) return false;
  // The baseline locks visual measurements. Test infrastructure can fail an
  // otherwise complete run, but relaunching it never replaces those readings.
  const pendingChecks = gates.G9.status === "FAIL" ? [{ gate: "G9", summary: gates.G9.summary }] : [];
  fs.writeFileSync(file, JSON.stringify({ lesson, base, head, findings, decisions,
    kitNotes: kitNotes.length, ...(pendingChecks.length ? { pendingChecks } : {}) }, null, 2) + "\n", { flag: "wx" });
  return true;
}

module.exports = { releaseStatus, releasedFindings, releasedRoutes, writeReleasedBaseline };
