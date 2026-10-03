/**
 * Deterministic model of the SystemVerilog DPI-C boundary (IEEE 1800-2023
 * Clause 35 and Annex H): how each SystemVerilog type arrives in C, and which
 * import/export combinations are legal.
 *
 * Type rules (tests/lib/sv-dpi-model.test.ts):
 * - Basic types map per Table H.1: byte→char, shortint→short int, int→int,
 *   longint→long long, real→double, shortreal→float, chandle→void*,
 *   string→const char*, scalar bit→svBit, scalar logic→svLogic.
 * - Small input arguments (the types above) are passed by value with const;
 *   every other input is passed by const reference (H.8.7).
 * - output and inout arguments are always passed by reference (H.8.8); an
 *   output string is a const char** (H.8.10).
 * - Packed vectors use the canonical svBitVecVal / svLogicVecVal chunks (H.7.7, H.8.4).
 * - Open arrays are always passed by const svOpenArrayHandle, whatever the
 *   direction, and are read with svLow/svHigh/svSize and the H.12 accessors (H.8.6, H.12).
 * - Only small types may be function results (§35.5.5, H.8.9).
 *
 * Legality rules:
 * - An imported task can never be pure (§35.5.1.3).
 * - pure is only for non-void functions with no output/inout arguments (§35.5.2),
 *   and a pure function must have no side effects; calls may be removed or reused (§35.5.2).
 * - An import that calls exported subroutines or touches SV data other than its
 *   arguments shall be context; otherwise the effect is unpredictable and can crash (§35.5.1.3).
 * - Calling an exported task from an imported function is never legal; an
 *   imported task may call one only if it is context (§35.8).
 * - Imported functions consume zero simulation time (§35.5.1.1). An imported task
 *   suspends only when it calls an exported task that executes a delay, event or
 *   wait (§35.5.1.5). C code that blocks on I/O blocks the whole simulator either way.
 * - Class methods cannot be exported (§35.7); exported subroutines cannot take
 *   open arrays (H.8.2).
 */

export type Direction = "input" | "output";

export interface DpiType {
  id: string;
  /** SystemVerilog formal, written as `<type> x` with `x` as the name. */
  sv: string;
  /** C parameter type for an input formal. */
  cInput: string;
  /** C parameter type for an output or inout formal. */
  cOutput: string;
  /** Small values: passed by value as inputs and allowed as function results (H.8.7, §35.5.5). */
  small: boolean;
  /** How C code reads the value. */
  access: string;
  note: string;
  clause: string;
  /** Wrong answers learners give, with the diagnosis. */
  misconceptions: { c: string; why: string }[];
}

const byRef = "Only small inputs are passed by value; output and inout arguments always arrive as pointers (H.8.7, H.8.8).";
const notLogic = "svLogicVecVal is only for 4-state packed vectors. This type has its own C equivalent in Table H.1.";

export const DPI_TYPES: DpiType[] = [
  {
    id: "byte",
    sv: "byte x",
    cInput: "char x",
    cOutput: "char* x",
    small: true,
    access: "x is a plain C char",
    note: "byte is 8-bit, 2-state and signed.",
    clause: "Table H.1, H.8.7",
    misconceptions: [
      { c: "const svBitVecVal* x", why: "byte is a basic integer type, not a packed bit vector, so it maps straight to char." },
      { c: "char* x", why: byRef },
    ],
  },
  {
    id: "shortint",
    sv: "shortint x",
    cInput: "short int x",
    cOutput: "short int* x",
    small: true,
    access: "x is a plain C short",
    note: "16-bit, 2-state.",
    clause: "Table H.1, H.8.7",
    misconceptions: [
      { c: "int x", why: "shortint is 16 bits; Table H.1 maps it to short int." },
      { c: "short int* x", why: byRef },
    ],
  },
  {
    id: "int",
    sv: "int x",
    cInput: "int x",
    cOutput: "int* x",
    small: true,
    access: "x is a plain C int",
    note: "32-bit, 2-state. The most common DPI argument type.",
    clause: "Table H.1, H.8.7",
    misconceptions: [
      { c: "const svLogicVecVal* x", why: notLogic },
      { c: "int* x", why: byRef },
      { c: "const svOpenArrayHandle x", why: "Handles are only for open (unsized) arrays." },
    ],
  },
  {
    id: "longint",
    sv: "longint x",
    cInput: "long long x",
    cOutput: "long long* x",
    small: true,
    access: "x is a plain C long long",
    note: "64-bit, 2-state. Do not use C long: it is 32 bits on some platforms.",
    clause: "Table H.1, H.8.7",
    misconceptions: [
      { c: "long x", why: "C long is 32 bits on some platforms; Table H.1 says long long." },
      { c: "const svBitVecVal* x", why: "longint is a basic integer type, so it maps to long long, not to canonical chunks." },
    ],
  },
  {
    id: "real",
    sv: "real x",
    cInput: "double x",
    cOutput: "double* x",
    small: true,
    access: "x is a plain C double",
    note: "shortreal maps to float.",
    clause: "Table H.1, H.8.7",
    misconceptions: [
      { c: "float x", why: "float is the C type for shortreal. real is double precision." },
      { c: "double* x", why: byRef },
    ],
  },
  {
    id: "shortreal",
    sv: "shortreal x",
    cInput: "float x",
    cOutput: "float* x",
    small: true,
    access: "x is a plain C float",
    note: "Single precision; real maps to double.",
    clause: "Table H.1, H.8.7",
    misconceptions: [
      { c: "double x", why: "double is the C type for real. shortreal is single precision: float." },
      { c: "float* x", why: byRef },
    ],
  },
  {
    id: "chandle",
    sv: "chandle x",
    cInput: "void* x",
    cOutput: "void** x",
    small: true,
    access: "x is an opaque C pointer; SV can only store it and pass it back",
    note: "Use it to keep a C model object alive between calls. C owns and frees the memory.",
    clause: "Table H.1, H.8.7",
    misconceptions: [
      { c: "int x", why: "A pointer does not fit an int on 64-bit hosts. chandle is void*." },
      { c: "void** x", why: byRef },
    ],
  },
  {
    id: "string",
    sv: "string x",
    cInput: "const char* x",
    cOutput: "const char** x",
    small: true,
    access: "x is a null-terminated C string owned by SystemVerilog",
    note: "Do not free it or keep the pointer after the call returns: copy it (for example with strdup) if C needs it later.",
    clause: "Table H.1, H.8.10",
    misconceptions: [
      { c: "char* x", why: "Input arguments are const in C (H.8.7): the C code must not modify SV's string." },
      { c: "const svOpenArrayHandle x", why: "A string is not an open array; it arrives as const char*." },
    ],
  },
  {
    id: "bit",
    sv: "bit x",
    cInput: "svBit x",
    cOutput: "svBit* x",
    small: true,
    access: "svBit is an unsigned char holding 0 or 1",
    note: "A single bit is a scalar, so it is small and passed by value.",
    clause: "Table H.1, H.10.1.1",
    misconceptions: [
      { c: "const svBitVecVal* x", why: "Vectors use svBitVecVal; a scalar bit is small and passed by value as svBit." },
      { c: "bool x", why: "DPI uses svBit (unsigned char) for scalar bit; C bool is not part of the mapping." },
    ],
  },
  {
    id: "logic",
    sv: "logic x",
    cInput: "svLogic x",
    cOutput: "svLogic* x",
    small: true,
    access: "svLogic encodings: sv_0 = 0, sv_1 = 1, sv_z = 2, sv_x = 3",
    note: "The four states survive the crossing as four distinct codes.",
    clause: "Table H.1, H.10.1.1",
    misconceptions: [
      { c: "const svLogicVecVal* x", why: "A scalar logic is small and passed by value as svLogic; svLogicVecVal is for vectors." },
      { c: "svBit x", why: "svBit only holds 0/1. logic needs svLogic so X and Z survive." },
    ],
  },
  {
    id: "bitvec",
    sv: "bit [7:0] x",
    cInput: "const svBitVecVal* x",
    cOutput: "svBitVecVal* x",
    small: false,
    access: "x[0] holds bits 7:0 in a 32-bit chunk; SV_PACKED_DATA_NELEMS(8) == 1. Mask unused bits.",
    note: "Packed vectors are passed by reference in canonical 32-bit chunks, even when only 8 bits wide.",
    clause: "H.7.7, H.8.4, H.8.7",
    misconceptions: [
      { c: "unsigned char x", why: "Only byte (a basic type) maps to char. A packed bit vector is not small, so it arrives as a pointer to canonical chunks (H.8.7)." },
      { c: "const svLogicVecVal* x", why: "bit is 2-state: its canonical type is svBitVecVal (no bval word)." },
    ],
  },
  {
    id: "logicvec",
    sv: "logic [31:0] x",
    cInput: "const svLogicVecVal* x",
    cOutput: "svLogicVecVal* x",
    small: false,
    access: "x[0].aval and x[0].bval: bval=0 → 0/1 from aval; aval=0,bval=1 → Z; aval=1,bval=1 → X",
    note: "Each 32-bit chunk carries an aval word and a bval word, exactly like VPI's vecval.",
    clause: "H.7.7, H.10.1.2",
    misconceptions: [
      { c: "int x", why: "The types must match exactly; a 4-state vector would lose X and Z. It arrives as svLogicVecVal chunks." },
      { c: "svLogicVecVal x", why: "Packed vectors are not small, so inputs arrive by const reference (pointer), not by value (H.8.7)." },
    ],
  },
  {
    id: "openint",
    sv: "int x[]",
    cInput: "const svOpenArrayHandle x",
    cOutput: "const svOpenArrayHandle x",
    small: false,
    access: "for (int i = svLow(x, 1); i <= svHigh(x, 1); i++) { int v = *(int*)svGetArrElemPtr1(x, i); }",
    note: "Open arrays always arrive as a handle, for any direction. Indices are the actual argument's SV indices.",
    clause: "H.8.6, H.12.2, H.12.4",
    misconceptions: [
      { c: "int* x", why: "Only sized arrays arrive as a C array. An unsized (open) array arrives as a handle (H.8.6)." },
      { c: "const svLogicVecVal* x", why: "int elements are 2-state and C-compatible; the array itself is passed by handle." },
    ],
  },
  {
    id: "openbitvec",
    sv: "bit [7:0] x[]",
    cInput: "const svOpenArrayHandle x",
    cOutput: "const svOpenArrayHandle x",
    small: false,
    access: "svBitVecVal w; svGetBitArrElem1VecVal(&w, x, i);   // copy element i out in canonical form",
    note: "Elements that are packed vectors are copied in and out with the H.12.5 VecVal accessors.",
    clause: "H.8.6, H.12.5",
    misconceptions: [
      { c: "const svBitVecVal* x", why: "That is a single packed vector. An unsized array of them arrives as a handle." },
      { c: "unsigned char* x", why: "Open arrays are never raw C arrays; read them through the handle." },
    ],
  },
  {
    id: "openlogicvec",
    sv: "logic [31:0] x[]",
    cInput: "const svOpenArrayHandle x",
    cOutput: "const svOpenArrayHandle x",
    small: false,
    access: "svLogicVecVal w; svGetLogicArrElem1VecVal(&w, x, i);",
    note: "Same handle, 4-state elements: each copied element has aval and bval.",
    clause: "H.8.6, H.12.5",
    misconceptions: [
      { c: "const svLogicVecVal* x", why: "That is one packed vector. The unsized array arrives as a handle." },
      { c: "svOpenArrayHandle x", why: "Handles are always const qualified: C must not modify the handle (H.8.6)." },
    ],
  },
];

export function findType(id: string): DpiType {
  const t = DPI_TYPES.find((d) => d.id === id);
  if (!t) throw new Error(`Unknown DPI type ${id}`);
  return t;
}

/** The C parameter for a formal of this type and direction. */
export function cParameter(type: DpiType, dir: Direction): string {
  return dir === "input" ? type.cInput : type.cOutput;
}

export function svImport(type: DpiType, dir: Direction): string {
  return `import "DPI-C" function void c_use(${dir} ${type.sv});`;
}

export function cPrototype(type: DpiType, dir: Direction): string {
  return `void c_use(${cParameter(type, dir)});`;
}

/** Whether a function may return this type (§35.5.5). */
export function allowedAsResult(svResult: string): boolean {
  if (svResult === "void") return true;
  return Boolean(DPI_TYPES.find((d) => d.sv === `${svResult} x`)?.small);
}

// ---------------------------------------------------------------------------
// Import/export legality
// ---------------------------------------------------------------------------

export interface DpiDecl {
  direction: "import" | "export";
  kind: "function" | "task";
  property?: "pure" | "context";
  /** Function result written in SV, e.g. "int", "void", "logic [31:0]". */
  result?: string;
  hasOutputArgs?: boolean;
  /** What the C body calls back into. */
  callsExport?: "function" | "task";
  /** C body writes files, prints, or keeps static state. */
  sideEffects?: boolean;
  /** C body blocks on I/O (socket, pipe, sleep). */
  blocksOnIo?: boolean;
  exportsClassMethod?: boolean;
  exportHasOpenArray?: boolean;
}

export type DpiVerdict = "legal" | "compile-error" | "runtime-undefined";

export interface DpiCheck {
  verdict: DpiVerdict;
  reasons: { text: string; clause: string }[];
  /** What happens to simulation time during the call. */
  time: string;
}

export function checkDpi(decl: DpiDecl): DpiCheck {
  const errors: DpiCheck["reasons"] = [];
  const runtime: DpiCheck["reasons"] = [];
  const notes: DpiCheck["reasons"] = [];

  if (decl.direction === "export") {
    if (decl.exportsClassMethod) errors.push({ text: "Class member functions cannot be exported.", clause: "§35.7" });
    if (decl.exportHasOpenArray) errors.push({ text: "Exported tasks and functions cannot have open-array arguments.", clause: "H.8.2" });
  }
  if (decl.direction === "import") {
    if (decl.property === "pure" && decl.kind === "task") errors.push({ text: "An imported task can never be declared pure.", clause: "§35.5.1.3" });
    if (decl.property === "pure" && decl.kind === "function" && (decl.result === "void" || decl.hasOutputArgs)) {
      errors.push({ text: "Only non-void functions with no output or inout arguments can be pure.", clause: "§35.5.2" });
    }
    if (decl.kind === "function" && decl.result && !allowedAsResult(decl.result)) {
      errors.push({
        text: `${decl.result} cannot be a DPI function result: results are restricted to small values (void, byte, shortint, int, longint, real, shortreal, chandle, string, scalar bit/logic). Return it through an output argument.`,
        clause: "§35.5.5",
      });
    }
  }
  if (errors.length > 0) {
    return { verdict: "compile-error", reasons: errors, time: "Nothing runs: the declaration is rejected before simulation starts." };
  }

  if (decl.direction === "import") {
    if (decl.kind === "function" && decl.callsExport === "task") {
      runtime.push({
        text: "It is never legal to call an exported task from an imported function (just as a SystemVerilog function cannot enable a task). The SV compiler cannot see the C body, so nothing stops it at compile time.",
        clause: "§35.8",
      });
    } else if (decl.callsExport && decl.property !== "context") {
      runtime.push({
        text: "An import that calls exported subroutines shall be declared context. Without it the call has no proper SV scope: behaviour is unpredictable and can crash.",
        clause: "§35.5.1.3",
      });
    }
    if (decl.property === "pure" && decl.sideEffects) {
      runtime.push({
        text: "A pure function must have no side effects. The compiler may remove the call or reuse an earlier result, so prints, file writes and counters can silently disappear.",
        clause: "§35.5.2",
      });
    }
    if (decl.property === "context") notes.push({ text: "context makes the call instrumented with its SV scope, so calling exports (or VPI) is safe.", clause: "§35.5.3" });
    if (decl.property === "pure") notes.push({ text: "pure lets the compiler optimise calls; the result must depend only on the inputs.", clause: "§35.5.2" });
  }

  let time: string;
  if (decl.kind === "function") {
    time = "Zero simulation time: an imported function completes instantly, like any SV function. While the C code runs, no other SV process runs.";
  } else if (decl.callsExport === "task" && decl.property === "context") {
    time = "Simulation time can pass, but only inside the exported SV task (its @, # or wait). While the C code itself runs, nothing else in the simulator runs.";
  } else {
    time = "Zero simulation time unless the task calls an exported task that waits. Being a task does not let other SV processes run while C executes.";
  }
  if (decl.blocksOnIo) {
    notes.push({
      text: "C code that blocks on I/O freezes the whole simulator: $time does not move and no other SV process runs until it returns, whether the import is a function or a task.",
      clause: "§35.5.1.1, §35.5.1.5",
    });
  }

  if (runtime.length > 0) return { verdict: "runtime-undefined", reasons: runtime, time };
  return { verdict: "legal", reasons: notes, time };
}

export interface DpiScenario {
  id: string;
  title: string;
  sv: string[];
  c: string[];
  decl: DpiDecl;
}

export const DPI_SCENARIOS: DpiScenario[] = [
  {
    id: "pure-ok",
    title: "pure parity",
    sv: ['import "DPI-C" pure function int c_parity(input int data);'],
    c: ["int c_parity(int data) {", "  return __builtin_parity((unsigned)data);", "}"],
    decl: { direction: "import", kind: "function", property: "pure", result: "int" },
  },
  {
    id: "pure-task",
    title: "pure task",
    sv: ['import "DPI-C" pure task c_wait(input int n);'],
    c: ["int c_wait(int n) { return 0; }"],
    decl: { direction: "import", kind: "task", property: "pure" },
  },
  {
    id: "vector-result",
    title: "vector result",
    sv: ['import "DPI-C" function logic [31:0] c_read_reg(input int addr);'],
    c: ["/* what would the C return type even be? */"],
    decl: { direction: "import", kind: "function", result: "logic [31:0]" },
  },
  {
    id: "export-no-context",
    title: "export, no context",
    sv: [
      'export "DPI-C" function sv_now;',
      "function longint sv_now(); return $time; endfunction",
      'import "DPI-C" function void c_check(input int v);',
    ],
    c: ["extern long long sv_now(void);", "void c_check(int v) {", '  printf("[%lld] %d\\n", sv_now(), v);', "}"],
    decl: { direction: "import", kind: "function", result: "void", callsExport: "function" },
  },
  {
    id: "export-context",
    title: "export, with context",
    sv: [
      'export "DPI-C" function sv_now;',
      "function longint sv_now(); return $time; endfunction",
      'import "DPI-C" context function void c_check(input int v);',
    ],
    c: ["extern long long sv_now(void);", "void c_check(int v) {", '  printf("[%lld] %d\\n", sv_now(), v);', "}"],
    decl: { direction: "import", kind: "function", property: "context", result: "void", callsExport: "function" },
  },
  {
    id: "function-calls-task",
    title: "function calls exported task",
    sv: [
      'export "DPI-C" task sv_wait_cycles;',
      "task sv_wait_cycles(int n); repeat (n) @(posedge clk); endtask",
      'import "DPI-C" context function void c_step();',
    ],
    c: ["extern int sv_wait_cycles(int n);", "void c_step(void) {", "  sv_wait_cycles(5);", "}"],
    decl: { direction: "import", kind: "function", property: "context", result: "void", callsExport: "task" },
  },
  {
    id: "task-calls-task",
    title: "context task waits in SV",
    sv: [
      'export "DPI-C" task sv_wait_cycles;',
      "task sv_wait_cycles(int n); repeat (n) @(posedge clk); endtask",
      'import "DPI-C" context task c_run_firmware();',
    ],
    c: ["extern int sv_wait_cycles(int n);", "int c_run_firmware(void) {", "  /* ...model a firmware step... */", "  sv_wait_cycles(5);   /* time passes here, in SV */", "  return 0;", "}"],
    decl: { direction: "import", kind: "task", property: "context", callsExport: "task" },
  },
  {
    id: "pure-side-effect",
    title: "pure with a counter",
    sv: ['import "DPI-C" pure function int c_count(input int v);'],
    c: ["static int calls = 0;", "int c_count(int v) {", '  calls++; printf("call %d\\n", calls);', "  return v + 1;", "}"],
    decl: { direction: "import", kind: "function", property: "pure", result: "int", sideEffects: true },
  },
  {
    id: "blocking-io",
    title: "task blocks on a socket",
    sv: ['import "DPI-C" task c_wait_socket(output int status);'],
    c: ["int c_wait_socket(int* status) {", "  *status = recv(sock, buf, 64, 0);   /* blocks for seconds */", "  return 0;", "}"],
    decl: { direction: "import", kind: "task", blocksOnIo: true },
  },
];
