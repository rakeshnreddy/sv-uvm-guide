import { describe, expect, it } from "vitest";

import {
  actionFor,
  catcherSource,
  crcInjectMessages,
  CRC_DEMOTER,
  DEFAULT_KNOBS,
  errorCountOptions,
  knobsToConfig,
  REAL_BUG_INDEX,
  runReports,
  settingPlusarg,
  settingSource,
  verbosityLevelFor,
  type ReportMessage,
} from "@/lib/uvm-report-model";

const SCB = "uvm_test_top.env.scb";
const err = (id: string, text = "boom", source = SCB, time = 10): ReportMessage => ({ id, severity: "UVM_ERROR", text, source, time });
const info = (id: string, verbosity: ReportMessage["verbosity"], source = SCB): ReportMessage => ({ id, severity: "UVM_INFO", verbosity, text: "hello", source, time: 0 });

describe("uvm-report-model: report handler defaults (uvm_report_handler::initialize)", () => {
  it("default actions: INFO/WARNING display, ERROR display+count, FATAL display+exit", () => {
    expect(actionFor(SCB, "UVM_INFO", "X", [])).toEqual(["UVM_DISPLAY"]);
    expect(actionFor(SCB, "UVM_WARNING", "X", [])).toEqual(["UVM_DISPLAY"]);
    expect(actionFor(SCB, "UVM_ERROR", "X", [])).toEqual(["UVM_DISPLAY", "UVM_COUNT"]);
    expect(actionFor(SCB, "UVM_FATAL", "X", [])).toEqual(["UVM_DISPLAY", "UVM_EXIT"]);
  });

  it("default verbosity is UVM_MEDIUM: a UVM_HIGH info is filtered, a UVM_MEDIUM info is shown", () => {
    const run = runReports([info("A", "UVM_HIGH"), info("B", "UVM_MEDIUM")]);
    expect(run.outcomes.map((o) => o.fate)).toEqual(["filtered", "displayed"]);
    expect(run.severityCounts.UVM_INFO).toBe(1);
  });

  it("verbosity only filters UVM_INFO (uvm_report_object::uvm_report): errors pass even at UVM_NONE", () => {
    const run = runReports([err("E")], { settings: [{ kind: "verbosity", comp: "*", level: "UVM_NONE" }], catchers: [], maxQuitCount: 0 });
    expect(run.outcomes[0].fate).toBe("displayed");
    expect(run.severityCounts.UVM_ERROR).toBe(1);
  });

  it("an id verbosity beats the component verbosity (get_verbosity_level: id > max)", () => {
    const settings = [
      { kind: "verbosity" as const, comp: "*", level: "UVM_LOW" as const },
      { kind: "id_verbosity" as const, comp: "*", id: "DRV", level: "UVM_FULL" as const },
    ];
    expect(verbosityLevelFor(SCB, "DRV", settings)).toBe(400);
    expect(verbosityLevelFor(SCB, "SCB", settings)).toBe(100);
  });
});

describe("uvm-report-model: action precedence (uvm_report_handler::get_action)", () => {
  it("(severity,id) action beats id action, which beats severity action", () => {
    const settings = [
      { kind: "severity_action" as const, comp: "*", severity: "UVM_ERROR" as const, action: ["UVM_DISPLAY" as const] },
      { kind: "id_action" as const, comp: "*", id: "CRC", action: ["UVM_LOG" as const] },
      { kind: "severity_id_action" as const, comp: "*", severity: "UVM_ERROR" as const, id: "CRC", action: [] },
    ];
    expect(actionFor(SCB, "UVM_ERROR", "CRC", settings)).toEqual([]);
    expect(actionFor(SCB, "UVM_WARNING", "CRC", settings)).toEqual(["UVM_LOG"]);
    expect(actionFor(SCB, "UVM_ERROR", "SCB", settings)).toEqual(["UVM_DISPLAY"]);
  });

  it("settings apply only to components matching the glob", () => {
    const settings = [{ kind: "severity_action" as const, comp: "uvm_test_top.env.agt.*", severity: "UVM_ERROR" as const, action: [] }];
    expect(actionFor("uvm_test_top.env.agt.mon", "UVM_ERROR", "X", settings)).toEqual([]);
    expect(actionFor(SCB, "UVM_ERROR", "X", settings)).toEqual(["UVM_DISPLAY", "UVM_COUNT"]);
  });
});

describe("uvm-report-model: report server counting (uvm_report_server::execute_report_message)", () => {
  it("UVM_NO_ACTION drops an error before counting: the summary shows 0 errors", () => {
    const run = runReports([err("E")], { settings: [{ kind: "severity_action", comp: "*", severity: "UVM_ERROR", action: [] }], catchers: [], maxQuitCount: 0 });
    expect(run.outcomes[0].fate).toBe("no-action");
    expect(run.severityCounts.UVM_ERROR).toBe(0);
    expect(run.verdict.passed).toBe(true);
  });

  it("removing UVM_COUNT does NOT remove the error from the severity count", () => {
    const run = runReports([err("E"), err("E")], {
      settings: [{ kind: "severity_action", comp: "*", severity: "UVM_ERROR", action: ["UVM_DISPLAY"] }],
      catchers: [],
      maxQuitCount: 1,
    });
    expect(run.severityCounts.UVM_ERROR).toBe(2);
    expect(run.quitCount).toBe(0);
    expect(run.exitedAt).toBeUndefined();
  });

  it("max_quit_count defaults to 0: any number of errors never stops the run", () => {
    const run = runReports([err("A"), err("B"), err("C"), err("D")]);
    expect(run.exitedAt).toBeUndefined();
    expect(run.severityCounts.UVM_ERROR).toBe(4);
    expect(run.summaryLines.some((l) => l.startsWith("Quit count"))).toBe(false);
  });

  it("+UVM_MAX_QUIT_COUNT=2 adds UVM_EXIT on the second counted error; later reports never happen", () => {
    const run = runReports([err("A"), err("B"), err("C")], { settings: [], catchers: [], maxQuitCount: 2 });
    expect(run.outcomes[1].exits).toBe(true);
    expect(run.outcomes[1].action).toContain("UVM_EXIT");
    expect(run.outcomes[2].fate).toBe("not-reached");
    expect(run.severityCounts.UVM_ERROR).toBe(2);
    expect(run.summaryLines).toContain("Quit count reached!");
    expect(run.summaryLines).toContain("Quit count :     2 of     2");
  });

  it("UVM_FATAL exits by default", () => {
    const run = runReports([{ ...err("F"), severity: "UVM_FATAL" }, err("E")]);
    expect(run.outcomes[0].exits).toBe(true);
    expect(run.outcomes[1].fate).toBe("not-reached");
  });

  it("$error (IEEE 1800-2023 §20.10) is never counted by the UVM report server", () => {
    const run = runReports([{ ...err("a_chk"), origin: "sv" }]);
    expect(run.outcomes[0].fate).toBe("sv-task");
    expect(run.severityCounts.UVM_ERROR).toBe(0);
    expect(run.svErrors).toBe(1);
    expect(run.verdict.passed).toBe(true);
    expect(run.verdict.reason).toMatch(/\$error/);
  });

  it("summary layout follows m_report_summarize: severity counts then id counts sorted by id", () => {
    const run = runReports([err("ZED"), err("ALPHA"), info("MID", "UVM_LOW")]);
    const i = run.summaryLines.indexOf("** Report counts by severity");
    expect(run.summaryLines[0]).toBe("--- UVM Report Summary ---");
    expect(run.summaryLines.slice(i + 1, i + 5)).toEqual(["UVM_INFO :    1", "UVM_WARNING :    0", "UVM_ERROR :    2", "UVM_FATAL :    0"]);
    expect(run.summaryLines.slice(-3)).toEqual(["[ALPHA]     1", "[MID]     1", "[ZED]     1"]);
  });
});

describe("uvm-report-model: report catchers (uvm_report_catcher::process_all_report_catchers)", () => {
  it("demoting ERROR→INFO without set_action switches to INFO's default action (no UVM_COUNT)", () => {
    const run = runReports([err("CRC", "bad CRC")], { settings: [], catchers: [CRC_DEMOTER], maxQuitCount: 1 });
    const o = run.outcomes[0];
    expect(o.finalSeverity).toBe("UVM_INFO");
    expect(o.action).toEqual(["UVM_DISPLAY"]);
    expect(o.demoted).toBe(true);
    expect(run.severityCounts).toMatchObject({ UVM_INFO: 1, UVM_ERROR: 0 });
    expect(run.quitCount).toBe(0);
    expect(run.demoted.UVM_ERROR).toBe(1);
    expect(run.summaryLines).toContain("Number of demoted UVM_ERROR reports  :    1");
  });

  it("an id-specific action is kept when a catcher demotes (only a default action is re-derived)", () => {
    const run = runReports([err("CRC", "bad CRC")], {
      settings: [{ kind: "id_action", comp: "*", id: "CRC", action: ["UVM_DISPLAY", "UVM_LOG", "UVM_COUNT"] }],
      catchers: [CRC_DEMOTER],
      maxQuitCount: 0,
    });
    expect(run.outcomes[0].action).toEqual(["UVM_DISPLAY", "UVM_LOG", "UVM_COUNT"]);
  });

  it("CAUGHT drops the message: not displayed, not counted, counted as caught", () => {
    const run = runReports([err("X")], { settings: [], catchers: [{ name: "c", id: "X", verdict: "CAUGHT" }], maxQuitCount: 0 });
    expect(run.outcomes[0].fate).toBe("caught");
    expect(run.severityCounts.UVM_ERROR).toBe(0);
    expect(run.caught.UVM_ERROR).toBe(1);
  });

  it("catchers run in registration order and CAUGHT stops the chain", () => {
    const run = runReports([err("X")], {
      settings: [],
      catchers: [
        { name: "first", id: "X", verdict: "CAUGHT" },
        { name: "second", id: "X", demoteTo: "UVM_WARNING", verdict: "THROW" },
      ],
      maxQuitCount: 0,
    });
    expect(run.outcomes[0].caughtBy).toBe("first");
    expect(run.outcomes[0].finalSeverity).toBe("UVM_ERROR");
    expect(run.outcomes[0].stages.filter((s) => s.stage === "catcher")).toHaveLength(1);
  });

  it("a disabled catcher (callback_mode(0)) is skipped", () => {
    const run = runReports([err("X")], { settings: [], catchers: [{ name: "c", id: "X", verdict: "CAUGHT", enabled: false }], maxQuitCount: 0 });
    expect(run.outcomes[0].fate).toBe("displayed");
  });

  it("a catcher never sees a UVM_INFO filtered by verbosity", () => {
    const run = runReports([info("DRV", "UVM_HIGH")], { settings: [], catchers: [{ name: "c", id: "*", verdict: "CAUGHT" }], maxQuitCount: 0 });
    expect(run.outcomes[0].fate).toBe("filtered");
    expect(run.outcomes[0].stages.some((s) => s.stage === "catcher")).toBe(false);
  });

  it("a catcher cannot see $error", () => {
    const run = runReports([{ ...err("a_chk"), origin: "sv" }], { settings: [], catchers: [{ name: "c", id: "*", verdict: "CAUGHT" }], maxQuitCount: 0 });
    expect(run.outcomes[0].fate).toBe("sv-task");
    expect(run.caught.UVM_ERROR).toBe(0);
  });
});

describe("uvm-report-model: severity overrides (uvm_report_handler::process_report_message)", () => {
  it("an id-specific override wins over a generic one, and the action follows the new severity", () => {
    const run = runReports([err("CRC")], {
      settings: [
        { kind: "severity_override", comp: "*", from: "UVM_ERROR", to: "UVM_FATAL" },
        { kind: "severity_id_override", comp: "*", id: "CRC", from: "UVM_ERROR", to: "UVM_WARNING" },
      ],
      catchers: [],
      maxQuitCount: 0,
    });
    expect(run.outcomes[0].finalSeverity).toBe("UVM_WARNING");
    expect(run.outcomes[0].action).toEqual(["UVM_DISPLAY"]);
    expect(run.severityCounts.UVM_WARNING).toBe(1);
  });

  it("an id with an override for another severity blocks the generic override", () => {
    const run = runReports([err("CRC")], {
      settings: [
        { kind: "severity_override", comp: "*", from: "UVM_ERROR", to: "UVM_FATAL" },
        { kind: "severity_id_override", comp: "*", id: "CRC", from: "UVM_WARNING", to: "UVM_INFO" },
      ],
      catchers: [],
      maxQuitCount: 0,
    });
    expect(run.outcomes[0].finalSeverity).toBe("UVM_ERROR");
  });
});

describe("uvm-report-model: crc_inject_test explorer scenario", () => {
  it("defaults: 3 UVM_ERRORs (2 injected + 1 real), the $error is invisible, the UVM_HIGH driver info is filtered", () => {
    const run = runReports(crcInjectMessages, knobsToConfig(DEFAULT_KNOBS));
    expect(run.severityCounts.UVM_ERROR).toBe(3);
    expect(run.svErrors).toBe(1);
    expect(run.outcomes[1].fate).toBe("filtered");
    expect(run.verdict.passed).toBe(false);
  });

  it("demoting only the CRC errors keeps the real scoreboard bug visible", () => {
    const run = runReports(crcInjectMessages, knobsToConfig({ ...DEFAULT_KNOBS, catcher: "demote-crc" }));
    expect(run.severityCounts.UVM_ERROR).toBe(1);
    expect(run.outcomes[REAL_BUG_INDEX].fate).toBe("displayed");
    expect(run.verdict.passed).toBe(false);
  });

  it("an over-broad catcher hides the real bug and the test falsely passes", () => {
    const run = runReports(crcInjectMessages, knobsToConfig({ ...DEFAULT_KNOBS, catcher: "catch-all-errors" }));
    expect(run.severityCounts.UVM_ERROR).toBe(0);
    expect(run.outcomes[REAL_BUG_INDEX].fate).toBe("caught");
    expect(run.verdict.passed).toBe(true);
  });

  it("+UVM_MAX_QUIT_COUNT=2 exits at the second injected error, before the real bug is reported", () => {
    const run = runReports(crcInjectMessages, knobsToConfig({ ...DEFAULT_KNOBS, maxQuitCount: 2 }));
    expect(run.exitedAt?.time).toBe(150);
    expect(run.outcomes[REAL_BUG_INDEX].fate).toBe("not-reached");
  });

  it("+UVM_VERBOSITY=UVM_LOW hides the UVM_MEDIUM scoreboard matches but no error", () => {
    const run = runReports(crcInjectMessages, knobsToConfig({ ...DEFAULT_KNOBS, verbosity: "UVM_LOW" }));
    expect(run.outcomes[2].fate).toBe("filtered");
    expect(run.severityCounts.UVM_ERROR).toBe(3);
  });

  it("prediction options contain exactly one correct count and the $error misconception", () => {
    const opts = errorCountOptions({ ...DEFAULT_KNOBS, catcher: "demote-crc" });
    expect(opts.filter((o) => o.correct)).toHaveLength(1);
    expect(opts.find((o) => o.correct)?.value).toBe(1);
    expect(opts.find((o) => o.value === 2)?.feedback).toMatch(/\$error/);
    expect(new Set(opts.map((o) => o.value)).size).toBe(opts.length);
  });
});

describe("uvm-report-model: generated code", () => {
  it("catcher source demotes with set_severity and returns THROW", () => {
    const src = catcherSource(CRC_DEMOTER).join("\n");
    expect(src).toContain("class crc_demoter extends uvm_report_catcher;");
    expect(src).toContain('get_id() == "CRC"');
    expect(src).toContain("set_severity(UVM_INFO);");
    expect(src).toContain("virtual function action_e catch();");
  });

  it("plusargs use the uvm_cmdline formats", () => {
    expect(settingPlusarg({ kind: "severity_action", comp: "uvm_test_top.env.*", severity: "UVM_ERROR", action: [] })).toBe(
      "+uvm_set_action=uvm_test_top.env.*,_ALL_,UVM_ERROR,UVM_NO_ACTION",
    );
    expect(settingPlusarg({ kind: "severity_id_override", comp: "uvm_test_top.env.agt.mon", id: "CRC", from: "UVM_ERROR", to: "UVM_INFO" })).toBe(
      "+uvm_set_severity=uvm_test_top.env.agt.mon,CRC,UVM_ERROR,UVM_INFO",
    );
    expect(settingPlusarg({ kind: "verbosity", comp: "*", level: "UVM_LOW" })).toBe("+UVM_VERBOSITY=UVM_LOW");
  });

  it("severity overrides have no _hier form", () => {
    expect(settingSource({ kind: "severity_override", comp: "uvm_test_top.env.*", from: "UVM_ERROR", to: "UVM_WARNING" })).toBe(
      "env.set_report_severity_override(UVM_ERROR, UVM_WARNING);",
    );
    expect(settingSource({ kind: "severity_action", comp: "uvm_test_top.env.*", severity: "UVM_ERROR", action: ["UVM_DISPLAY"] })).toBe(
      "env.set_report_severity_action_hier(UVM_ERROR, UVM_DISPLAY);",
    );
  });
});
