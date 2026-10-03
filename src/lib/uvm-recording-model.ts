/**
 * Deterministic model of UVM transaction recording from a driver:
 *   begin_tr(req, "drv") … drive … end_tr(req)
 *
 * Rules checked against uvm-core 2020.3.1 (IEEE 1800.2-2020):
 *  - base/uvm_component.svh: recording_detail defaults to UVM_NONE, so
 *    get_recording_enabled() (13.1.6.14) is 0 until set_recording_enabled(1) (13.1.6.13)
 *    or a non-zero "recording_detail" config value is applied. The library reads that
 *    value in the component constructor and again in apply_config_settings (build_phase);
 *    a config_db::set after the component's build is never read (library behaviour,
 *    beyond 1800.2).
 *  - m_begin_tr(): with recording disabled no recorder is opened and begin_tr returns
 *    handle 0 (13.1.7.3). Enabled: get_tr_stream(stream_name, "TVM") then open_recorder.
 *  - end_tr() (13.1.7.5): calls tr.record(recorder) — field automation + do_record() —
 *    then closes the recorder. So attributes hold the values at end_tr, and a missing
 *    end_tr leaves the recorder open with no attributes recorded.
 *  - base/uvm_coreservice.svh: the default database is uvm_text_tr_database ("tr_db.log");
 *    simulators substitute their own uvm_tr_database (Clause 7).
 */

export type RecordingEnable = "default" | "set_recording_enabled" | "config-before-build" | "config-in-run-phase";
export type RecordImpl = "none" | "field-macros" | "do_record";

export interface RecordingSetup {
  enable: RecordingEnable;
  impl: RecordImpl;
  callEndTr: boolean;
}

export interface Bus {
  kind: "WRITE" | "READ";
  addr: number;
  data: number;
  /** Filled in by the driver during the read. */
  rdata?: number;
}

export interface RecordedTransaction {
  handle: number;
  label: string;
  begin: number;
  /** null while the recorder is still open. */
  end: number | null;
  attributes: [string, string][];
}

export interface RecordingRun {
  enabled: boolean;
  enableWhy: string;
  /** Return value of each begin_tr call. */
  beginTrHandles: number[];
  streamName: string | null;
  transactions: RecordedTransaction[];
  verdict: string;
}

export const DRIVE_NS = 20;

export const recordingItems: Bus[] = [
  { kind: "WRITE", addr: 0x10, data: 0xa5 },
  { kind: "READ", addr: 0x14, data: 0, rdata: 0x3c },
  { kind: "WRITE", addr: 0x18, data: 0x5a },
];

export const enableSource: Record<RecordingEnable, string[]> = {
  default: ["// nothing: recording_detail stays UVM_NONE"],
  set_recording_enabled: ["// pkt_driver::build_phase", "set_recording_enabled(1);"],
  "config-before-build": ["// test build_phase, before env is created", 'uvm_config_db#(int)::set(this, "env.agt.drv", "recording_detail", UVM_FULL);'],
  "config-in-run-phase": ["// test run_phase (too late)", 'uvm_config_db#(int)::set(this, "env.agt.drv", "recording_detail", UVM_FULL);'],
};

export const implSource: Record<RecordImpl, string[]> = {
  none: ["`uvm_object_utils(bus_item)", "// no field macros, no do_record()"],
  "field-macros": [
    "`uvm_object_utils_begin(bus_item)",
    "  `uvm_field_enum(kind_e, kind, UVM_ALL_ON)",
    "  `uvm_field_int(addr,  UVM_ALL_ON)",
    "  `uvm_field_int(data,  UVM_ALL_ON)",
    "  `uvm_field_int(rdata, UVM_ALL_ON)",
    "`uvm_object_utils_end",
  ],
  do_record: [
    "virtual function void do_record(uvm_recorder recorder);",
    "  super.do_record(recorder);",
    '  `uvm_record_string("kind", kind.name())',
    '  `uvm_record_field("addr", addr)',
    '  `uvm_record_field("data", data)',
    '  `uvm_record_field("rdata", rdata)',
    "endfunction",
  ],
};

export function driverSource(callEndTr: boolean): string[] {
  return [
    "task run_phase(uvm_phase phase);",
    "  forever begin",
    "    seq_item_port.get_next_item(req);",
    '    void\'(begin_tr(req, "drv"));',
    "    drive(req);                 // 20 ns; a READ fills req.rdata",
    callEndTr ? "    end_tr(req);                // records req, closes it" : "    // end_tr(req);  ← forgotten",
    "    seq_item_port.item_done();",
    "  end",
    "endtask",
  ];
}

function isEnabled(enable: RecordingEnable): { enabled: boolean; why: string } {
  switch (enable) {
    case "default":
      return { enabled: false, why: "recording_detail defaults to UVM_NONE, so get_recording_enabled() is 0." };
    case "set_recording_enabled":
      return { enabled: true, why: "set_recording_enabled(1) turns recording on for this component (IEEE 1800.2 13.1.6.13)." };
    case "config-before-build":
      return { enabled: true, why: "The driver reads recording_detail when it is constructed and built, so a set made before then enables recording (uvm-core library behaviour)." };
    case "config-in-run-phase":
      return { enabled: false, why: "The driver read recording_detail during construction and build_phase. A set made in run_phase is never read." };
  }
}

const hex = (n: number) => `'h${n.toString(16)}`;

export function runRecording(setup: RecordingSetup, items: Bus[] = recordingItems): RecordingRun {
  const { enabled, why } = isEnabled(setup.enable);
  const beginTrHandles: number[] = [];
  const transactions: RecordedTransaction[] = [];
  let nextHandle = 101;
  items.forEach((item, i) => {
    const begin = i * DRIVE_NS;
    if (!enabled) {
      beginTrHandles.push(0);
      return;
    }
    const handle = nextHandle++;
    beginTrHandles.push(handle);
    const end = setup.callEndTr ? begin + DRIVE_NS : null;
    // tr.record(recorder) runs inside end_tr, after drive() filled rdata.
    let attributes: [string, string][] = [];
    if (setup.callEndTr && setup.impl !== "none") {
      attributes = [
        ["kind", item.kind],
        ["addr", hex(item.addr)],
        ["data", hex(item.data)],
        ["rdata", hex(item.rdata ?? 0)],
      ];
    }
    transactions.push({ handle, label: "req", begin, end, attributes });
  });

  let verdict: string;
  if (!enabled) verdict = "The stream is empty: every begin_tr returned 0 and no recorder was opened.";
  else if (!setup.callEndTr) verdict = "Each transaction opens and never closes. Attributes are recorded inside end_tr, so none are recorded.";
  else if (setup.impl === "none") verdict = "Transactions appear with begin and end times but no attributes: nothing tells record() which fields to write.";
  else verdict = "Each transaction has begin/end times and attributes. rdata holds the read data because record() runs at end_tr, after the driver filled it.";

  return { enabled, enableWhy: why, beginTrHandles, streamName: enabled ? "drv (scope uvm_test_top.env.agt.drv)" : null, transactions, verdict };
}

export interface RecordingPrediction {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

/** Options for "after three items, what does the transaction stream show?" */
export function recordingPredictionOptions(setup: RecordingSetup): RecordingPrediction[] {
  const run = runRecording(setup);
  const outcome = !run.enabled ? "empty" : !setup.callEndTr ? "open" : setup.impl === "none" ? "bare" : "full";
  const all: Omit<RecordingPrediction, "correct">[] = [
    {
      id: "full",
      label: "Three closed transactions with kind, addr, data and rdata",
      feedback: "That needs all three: recording enabled on the driver, a recording implementation (field macros or do_record), and end_tr to record and close each one.",
    },
    {
      id: "bare",
      label: "Three closed transactions, but no field values",
      feedback: "Begin/end times come from begin_tr/end_tr; field values come from record(), which needs field macros or a do_record().",
    },
    {
      id: "open",
      label: "Three transactions that never end",
      feedback: "A recorder opened by begin_tr is closed — and its fields recorded — only by end_tr.",
    },
    {
      id: "empty",
      label: "Nothing at all",
      feedback: "Recording is off by default (recording_detail = UVM_NONE). With it off, begin_tr returns 0 and opens nothing.",
    },
  ];
  return all.map((o) => ({ ...o, correct: o.id === outcome }));
}
