/**
 * Array manipulation methods (IEEE 1800-2023 §7.12): locator, ordering and
 * reduction methods with their return types, `with` clauses and width rules.
 * Pure and deterministic (shuffle uses a seeded LCG). No React.
 */
import { SV_ELEM_TYPES, wrapToWidth, type PredictionChoice } from "@/lib/systemverilog-array-model";

export type MethodElemTypeId = "int" | "byte" | "bit8";
/** Queue, dynamic and fixed-size arrays behave the same for every method; associative arrays differ. */
export type MethodArrayKind = "queue" | "assoc";

export interface MethodArray {
  kind: MethodArrayKind;
  name: string;
  elemType: MethodElemTypeId;
  values: number[];
  /** Associative arrays only: string indices in index order, parallel to `values`. */
  keys: string[];
}

export type ArrayMethodName =
  | "find"
  | "find_index"
  | "find_first"
  | "find_first_index"
  | "find_last"
  | "find_last_index"
  | "min"
  | "max"
  | "unique"
  | "unique_index"
  | "sort"
  | "rsort"
  | "reverse"
  | "shuffle"
  | "sum"
  | "product"
  | "and"
  | "or"
  | "xor";

export type MethodFamily = "locator" | "ordering" | "reduction";

interface MethodInfo {
  family: MethodFamily;
  withRule: "required" | "optional" | "forbidden";
  /** What a locator returns: element values or indices. */
  yields?: "elements" | "indices";
  clause: string;
}

export const ARRAY_METHODS: Record<ArrayMethodName, MethodInfo> = {
  find: { family: "locator", withRule: "required", yields: "elements", clause: "§7.12.1" },
  find_index: { family: "locator", withRule: "required", yields: "indices", clause: "§7.12.1" },
  find_first: { family: "locator", withRule: "required", yields: "elements", clause: "§7.12.1" },
  find_first_index: { family: "locator", withRule: "required", yields: "indices", clause: "§7.12.1" },
  find_last: { family: "locator", withRule: "required", yields: "elements", clause: "§7.12.1" },
  find_last_index: { family: "locator", withRule: "required", yields: "indices", clause: "§7.12.1" },
  min: { family: "locator", withRule: "optional", yields: "elements", clause: "§7.12.1" },
  max: { family: "locator", withRule: "optional", yields: "elements", clause: "§7.12.1" },
  unique: { family: "locator", withRule: "optional", yields: "elements", clause: "§7.12.1" },
  unique_index: { family: "locator", withRule: "optional", yields: "indices", clause: "§7.12.1" },
  sort: { family: "ordering", withRule: "optional", clause: "§7.12.2" },
  rsort: { family: "ordering", withRule: "optional", clause: "§7.12.2" },
  reverse: { family: "ordering", withRule: "forbidden", clause: "§7.12.2" },
  shuffle: { family: "ordering", withRule: "forbidden", clause: "§7.12.2" },
  sum: { family: "reduction", withRule: "optional", clause: "§7.12.3" },
  product: { family: "reduction", withRule: "optional", clause: "§7.12.3" },
  and: { family: "reduction", withRule: "optional", clause: "§7.12.3" },
  or: { family: "reduction", withRule: "optional", clause: "§7.12.3" },
  xor: { family: "reduction", withRule: "optional", clause: "§7.12.3" },
};

export type WithClauseId = "none" | "gt20" | "eq15" | "even" | "lt10" | "mod10" | "int_cast" | "gt20_count";

interface WithClause {
  text: string;
  /** Width/sign of the expression's type; "elem" means the element type. */
  width: number | "elem";
  signed: boolean | "elem";
  evaluate: (item: number) => number;
  /** Why the expression has this type. */
  typeNote: string;
}

export const WITH_CLAUSES: Record<Exclude<WithClauseId, "none">, WithClause> = {
  gt20: { text: "item > 20", width: 1, signed: false, evaluate: (x) => (x > 20 ? 1 : 0), typeNote: "a relational operator yields a 1-bit value (§11.4.4)" },
  eq15: { text: "item == 15", width: 1, signed: false, evaluate: (x) => (x === 15 ? 1 : 0), typeNote: "an equality operator yields a 1-bit value" },
  even: { text: "item % 2 == 0", width: 1, signed: false, evaluate: (x) => (x % 2 === 0 ? 1 : 0), typeNote: "an equality operator yields a 1-bit value" },
  lt10: { text: "item < 10", width: 1, signed: false, evaluate: (x) => (x < 10 ? 1 : 0), typeNote: "a relational operator yields a 1-bit value (§11.4.4)" },
  mod10: { text: "item % 10", width: 32, signed: "elem", evaluate: (x) => x % 10, typeNote: "the 32-bit literal 10 widens the expression to 32 bits" },
  int_cast: { text: "int'(item)", width: 32, signed: true, evaluate: (x) => x, typeNote: "the cast makes each value a 32-bit signed int" },
  gt20_count: { text: "int'(item > 20)", width: 32, signed: true, evaluate: (x) => (x > 20 ? 1 : 0), typeNote: "the cast widens each 1-bit result to int before summing" },
};

/** The `with` clauses the explorer offers for a method (including ones that are errors, to teach the rule). */
export function withChoicesFor(method: ArrayMethodName): WithClauseId[] {
  const info = ARRAY_METHODS[method];
  if (info.family === "reduction") return ["none", "int_cast", "gt20", "gt20_count"];
  if (info.family === "ordering") return ["none", "mod10"];
  if (info.withRule === "required") return ["gt20", "eq15", "even", "lt10", "none"];
  return ["none", "mod10"];
}

export function elemDecl(type: MethodElemTypeId): string {
  return SV_ELEM_TYPES[type].decl;
}

export function methodCallText(array: MethodArray, method: ArrayMethodName, withId: WithClauseId): string {
  const w = withId === "none" ? "" : ` with (${WITH_CLAUSES[withId].text})`;
  return `${array.name}.${method}()${w}`;
}

export interface ScalarResult {
  value: number;
  exact: string;
  width: number;
  signed: boolean;
  overflow: boolean;
  typeText: string;
}

export interface MethodOutcome {
  call: string;
  /** A complete, legal statement that captures the result (or the offending line, for errors). */
  statement: string;
  kind: "queue" | "scalar" | "void" | "error";
  returnType: string;
  error?: { text: string; clause: string };
  queue?: Array<number | string>;
  scalar?: ScalarResult;
  /** Array contents after the call (ordering methods change them in place). */
  after: number[];
  afterKeys: string[];
  /** Positions in `after` to highlight. */
  highlight: number[];
  why: string;
  clause: string;
  /** Behaviour the LRM leaves unspecified, and how the model picks. */
  notes: string[];
}

/** Small deterministic LCG (Numerical Recipes constants). */
export function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const exprType = (array: MethodArray, withId: WithClauseId) => {
  const t = SV_ELEM_TYPES[array.elemType];
  if (withId === "none") return { width: t.width, signed: t.signed, text: t.decl };
  const w = WITH_CLAUSES[withId];
  const width = w.width === "elem" ? t.width : w.width;
  const signed = w.signed === "elem" ? t.signed : w.signed;
  const text = width === 1 ? "1-bit" : width === 32 && signed ? "int" : `${width}-bit ${signed ? "signed" : "unsigned"}`;
  return { width, signed, text };
};

function errorOutcome(array: MethodArray, call: string, text: string, clause: string, why: string): MethodOutcome {
  return {
    call,
    statement: `${call};`,
    kind: "error",
    returnType: "—",
    error: { text, clause },
    after: array.values,
    afterKeys: array.keys,
    highlight: [],
    why,
    clause,
    notes: [],
  };
}

export function evaluateMethod(array: MethodArray, method: ArrayMethodName, withId: WithClauseId, seed = 1): MethodOutcome {
  const info = ARRAY_METHODS[method];
  const call = methodCallText(array, method, withId);
  const decl = elemDecl(array.elemType);
  const isAssoc = array.kind === "assoc";
  const indexOf = (pos: number): number | string => (isAssoc ? array.keys[pos] : pos);
  const indexDecl = isAssoc ? "string" : "int";

  // ---- Legality ----
  if (info.family === "ordering" && isAssoc) {
    return errorOutcome(array, call, `Compile error: ${method}() is not allowed on an associative array`, "§7.12.2",
      "Ordering methods reorder any unpacked array except associative arrays, whose order is fixed by the index type.");
  }
  if (info.withRule === "forbidden" && withId !== "none") {
    return errorOutcome(array, call, `Compile error: ${method}() does not accept a with clause`, "§7.12.2",
      `Specifying a with clause on ${method}() is a compiler error; only sort() and rsort() take one.`);
  }
  if (info.withRule === "required" && withId === "none") {
    return errorOutcome(array, call, `Compile error: ${method}() needs a with clause`, "§7.12.1",
      `For find, find_index, find_first, find_first_index, find_last and find_last_index the with clause is mandatory.`);
  }

  const key = (x: number) => (withId === "none" ? x : WITH_CLAUSES[withId].evaluate(x));
  const positions = array.values.map((_, i) => i);
  const base = { call, after: array.values, afterKeys: array.keys, clause: info.clause, notes: [] as string[] };

  // ---- Locator methods: always return a queue (§7.12.1) ----
  if (info.family === "locator") {
    const yieldsIdx = info.yields === "indices";
    const qType = yieldsIdx ? `${indexDecl} r[$]` : `${decl} r[$]`;
    const statement = `${qType} = ${call};`;
    let picked: number[];
    let why: string;
    const notes: string[] = [];
    if (method.startsWith("find")) {
      const matches = positions.filter((i) => key(array.values[i]) !== 0);
      if (method === "find" || method === "find_index") picked = matches;
      else if (method.startsWith("find_first")) picked = matches.slice(0, 1);
      else picked = matches.slice(-1);
      why = picked.length === 0
        ? `No element satisfies ${WITH_CLAUSES[withId as Exclude<WithClauseId, "none">].text}, so the result is an empty queue, not an error.`
        : `${method}() returns a queue of the matching ${yieldsIdx ? (isAssoc ? "indices (string keys, the index type)" : "indices (int)") : "elements"}${method.includes("first") || method.includes("last") ? ", holding at most one entry" : ""}.`;
      if (method === "find" || method === "find_index") notes.push("The LRM says locator methods traverse the array in an unspecified order; the model lists matches in index order, as simulators usually do.");
    } else if (method === "min" || method === "max") {
      let best = -1;
      for (const i of positions) {
        if (best < 0) best = i;
        else if (method === "min" ? key(array.values[i]) < key(array.values[best]) : key(array.values[i]) > key(array.values[best])) best = i;
      }
      picked = best < 0 ? [] : [best];
      why = `${method}() returns a queue holding one element${withId === "none" ? "" : ` (the element whose ${WITH_CLAUSES[withId].text} is ${method === "min" ? "smallest" : "largest"})`}. Writing int m = ${array.name}.${method}(); does not compile.`;
      if (withId !== "none") notes.push("If several elements tie, the LRM returns only one and does not say which; the model takes the first.");
    } else {
      const seen = new Set<number>();
      picked = [];
      for (const i of positions) {
        const k = key(array.values[i]);
        if (!seen.has(k)) {
          seen.add(k);
          picked.push(i);
        }
      }
      why = `${method}() returns one entry for each distinct ${withId === "none" ? "value" : `value of ${WITH_CLAUSES[withId].text}`}, as a queue.`;
      notes.push("The order of unique() results is unrelated to the array order in the LRM; the model shows first occurrences in index order.");
    }
    return {
      ...base,
      statement,
      kind: "queue",
      returnType: `queue of ${yieldsIdx ? indexDecl : decl}`,
      queue: picked.map((i) => (yieldsIdx ? indexOf(i) : array.values[i])),
      highlight: picked,
      why,
      notes,
    };
  }

  // ---- Ordering methods: void, in place (§7.12.2) ----
  if (info.family === "ordering") {
    let order = [...positions];
    if (method === "sort") order.sort((a, b) => key(array.values[a]) - key(array.values[b]));
    else if (method === "rsort") order.sort((a, b) => key(array.values[b]) - key(array.values[a]));
    else if (method === "reverse") order.reverse();
    else {
      const rand = lcg(seed);
      for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    const after = order.map((i) => array.values[i]);
    const notes: string[] = [];
    if (withId !== "none") notes.push("Elements with equal keys may come out in any order; the model keeps their original order.");
    if (method === "shuffle") notes.push(`shuffle() uses the simulator's random generator; the model uses a seeded generator (seed ${seed}) so you can repeat it.`);
    const sentence: Record<string, string> = {
      sort: "Array sorted in ascending order",
      rsort: "Array sorted in descending order",
      reverse: "Array reversed",
      shuffle: "Array shuffled",
    };
    return {
      ...base,
      statement: `${call};`,
      kind: "void",
      returnType: "void (reorders in place)",
      after,
      afterKeys: array.keys,
      highlight: [],
      why: `${sentence[method]}${withId === "none" ? "" : ` by ${WITH_CLAUSES[withId].text}`}. Ordering methods are void functions: they change ${array.name} itself and return nothing.`,
      notes,
    };
  }

  // ---- Reduction methods: one value of the element type or the with-expression type (§7.12.3) ----
  const t = exprType(array, withId);
  const terms = array.values.map((x) => BigInt(key(x)));
  let exact: bigint;
  if (method === "sum") exact = terms.reduce((a, b) => a + b, BigInt(0));
  else if (method === "product") exact = terms.reduce((a, b) => a * b, BigInt(1));
  else if (method === "and") exact = terms.reduce((a, b) => a & b, BigInt(-1));
  else if (method === "or") exact = terms.reduce((a, b) => a | b, BigInt(0));
  else exact = terms.reduce((a, b) => a ^ b, BigInt(0));
  const value = wrapToWidth(exact, t.width, t.signed);
  const overflow = BigInt(value) !== exact && (method === "sum" || method === "product");
  const notes: string[] = [];
  let why: string;
  if (overflow) {
    why = `The exact ${method} is ${exact.toString()}, but the result has the ${withId === "none" ? `element type (${t.text})` : `type of ${WITH_CLAUSES[withId].text} (${t.text}; ${WITH_CLAUSES[withId].typeNote})`}, so it wraps to ${value}. Assigning it to an int afterwards does not restore the lost bits.`;
  } else {
    why = `The result has the ${withId === "none" ? `element type (${t.text})` : `type of ${WITH_CLAUSES[withId].text} (${t.text})`} and the value fits.`;
  }
  if (withId === "gt20_count") notes.push("Casting inside the with clause is the idiom for counting matches: sum() with (int'(item > 20)).");
  return {
    ...base,
    statement: `int total = ${call};`,
    kind: "scalar",
    returnType: withId === "none" ? `${decl} (element type)` : `${t.text} (type of the with expression)`,
    scalar: { value, exact: exact.toString(), width: t.width, signed: t.signed, overflow, typeText: t.text },
    highlight: withId === "gt20" || withId === "gt20_count" ? positions.filter((i) => key(array.values[i]) !== 0) : positions,
    why,
    notes,
  };
}

function formatQueue(items: ReadonlyArray<number | string>): string {
  return `'{${items.map((x) => (typeof x === "string" ? `"${x}"` : String(x))).join(", ")}}`;
}

export function formatMethodResult(outcome: MethodOutcome): string {
  if (outcome.kind === "error") return outcome.error?.text ?? "Compile error";
  if (outcome.kind === "queue") return formatQueue(outcome.queue ?? []);
  if (outcome.kind === "scalar") return String(outcome.scalar?.value);
  return `${outcome.call.split(".")[0]} = ${formatQueue(outcome.after)}`;
}

export interface MethodPrediction {
  question: string;
  options: PredictionChoice[];
}

function dedupe(options: PredictionChoice[]): PredictionChoice[] {
  const out: PredictionChoice[] = [];
  for (const o of options) {
    const i = out.findIndex((x) => x.label === o.label);
    if (i < 0) out.push(o);
    else if (o.correct) out[i] = o;
  }
  return out;
}

/** Prediction options for a method call; the correct option is the model's outcome. */
export function predictMethod(array: MethodArray, method: ArrayMethodName, withId: WithClauseId, seed = 1): MethodPrediction {
  const outcome = evaluateMethod(array, method, withId, seed);
  const info = ARRAY_METHODS[method];
  const question = `What does \`${outcome.call}\` produce?`;
  const correctLabel = formatMethodResult(outcome);

  if (outcome.kind === "error") {
    let wrong: PredictionChoice;
    if (info.family === "ordering" && array.kind === "assoc") {
      wrong = {
        id: "runs",
        label: `It reorders the values: ${formatMethodResult(evaluateMethod({ ...array, kind: "queue" }, method, "none", seed))}`,
        correct: false,
        feedback: "An associative array is always kept in index order, so ordering methods are illegal on it. Copy the values into a queue first if you need them sorted.",
      };
    } else if (info.withRule === "required") {
      wrong = {
        id: "runs",
        label: `It returns every element: ${formatQueue(array.kind === "assoc" && info.yields === "indices" ? array.keys : info.yields === "indices" ? array.values.map((_, i) => i) : array.values)}`,
        correct: false,
        feedback: "find-style methods have no default condition. You must say what to look for in a with clause.",
      };
    } else {
      wrong = {
        id: "runs",
        label: `The with clause is ignored: ${formatMethodResult(evaluateMethod(array, method, "none", seed))}`,
        correct: false,
        feedback: "A with clause on reverse() or shuffle() is not ignored; it is a compile error.",
      };
    }
    return {
      question,
      options: dedupe([{ id: "error", label: correctLabel, correct: true, feedback: `${outcome.why} (${outcome.error?.clause}).` }, wrong]),
    };
  }

  if (outcome.kind === "queue") {
    const vals = outcome.highlight.map((i) => array.values[i]);
    const idx = outcome.highlight.map((i) => (array.kind === "assoc" ? array.keys[i] : i));
    const options: PredictionChoice[] = [
      { id: "queue", label: correctLabel, correct: true, feedback: `${outcome.why} (${outcome.clause}).` },
    ];
    if (method === "min" || method === "max" || method.startsWith("find_first") || method.startsWith("find_last")) {
      if (outcome.queue && outcome.queue.length === 1) {
        options.push({
          id: "scalar",
          label: `The scalar ${typeof outcome.queue[0] === "string" ? `"${outcome.queue[0]}"` : outcome.queue[0]}`,
          correct: false,
          feedback: `Every locator method returns a queue, even when it holds one value. Capture it in a queue and read element [0].`,
        });
      }
    }
    if (info.yields === "indices") {
      options.push({ id: "values", label: formatQueue(vals), correct: false, feedback: `Those are the element values. ${method}() returns positions (or keys, for an associative array).` });
    } else if (method.startsWith("find") || method === "min" || method === "max") {
      options.push({ id: "indices", label: formatQueue(idx), correct: false, feedback: `Those are positions. ${method}() returns the elements themselves; use the _index variant for positions.` });
    }
    if (method === "unique") {
      const counts = new Map<number, number>();
      array.values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
      options.push({
        id: "singletons",
        label: formatQueue(array.values.filter((v) => counts.get(v) === 1)),
        correct: false,
        feedback: "unique() keeps one copy of every value, including values that were duplicated; it does not drop them.",
      });
    }
    if (method === "find" || method === "find_index") {
      options.push({ id: "first-only", label: formatQueue((info.yields === "indices" ? idx : vals).slice(0, 1)), correct: false, feedback: "That is find_first. find() and find_index() return every match." });
    }
    return { question, options: dedupe(options) };
  }

  if (outcome.kind === "void") {
    return {
      question,
      options: dedupe([
        { id: "inplace", label: correctLabel, correct: true, feedback: `${outcome.why} (${outcome.clause}).` },
        { id: "copy", label: `${array.name} = ${formatQueue(array.values)} (unchanged; a sorted copy is returned)`, correct: false, feedback: "Ordering methods are void: they reorder the array in place and return nothing." },
        ...(withId !== "none"
          ? [{
              id: "by-value",
              label: `${array.name} = ${formatQueue(evaluateMethod(array, method, "none", seed).after)}`,
              correct: false,
              feedback: `That ignores the with clause. ${method}() compares the values of ${WITH_CLAUSES[withId].text}, not the elements.`,
            }]
          : []),
      ]),
    };
  }

  const s = outcome.scalar as ScalarResult;
  const options: PredictionChoice[] = [{ id: "wrapped", label: correctLabel, correct: true, feedback: `${outcome.why} (${outcome.clause}).` }];
  if (s.overflow) {
    options.push({
      id: "exact",
      label: s.exact,
      correct: false,
      feedback: withId === "gt20"
        ? "You counted the matches, but each term is 1 bit wide, so the sum is 1 bit wide too. Write sum() with (int'(item > 20))."
        : "The result is not widened to int. It has the element type (or the with-expression type), so it wraps first. Use with (int'(item)).",
    });
  } else if (method === "sum" && withId === "none") {
    options.push({ id: "queue", label: formatQueue([s.value]), correct: false, feedback: "Reduction methods return a single value, not a queue. Only locator methods return queues." });
  }
  if (withId === "gt20" || withId === "gt20_count") {
    const count = array.values.filter((x) => x > 20).length;
    const total = array.values.filter((x) => x > 20).reduce((a, b) => a + b, 0);
    options.push({ id: "sum-of-matches", label: String(total), correct: false, feedback: "A with clause in a reduction does not filter elements; it replaces each element by the expression's value (0 or 1 here) before adding." });
    if (withId === "gt20" && count !== s.value) options.push({ id: "count", label: String(count), correct: false, feedback: "That is the number of matches, but the result is only 1 bit wide (the type of item > 20), so it wraps. Cast inside the with clause." });
    if (withId === "gt20_count" && count % 2 !== s.value) options.push({ id: "one-bit", label: String(count % 2), correct: false, feedback: "That is what the 1-bit sum without the cast would give. int'(item > 20) widens every term, so the count is exact." });
  }
  if (withId === "int_cast") {
    const plain = evaluateMethod(array, method, "none", seed).scalar;
    if (plain && plain.value !== s.value) {
      options.push({ id: "no-cast", label: String(plain.value), correct: false, feedback: `That is the wrapped ${plain.typeText} result you get without the cast. int'(item) makes every term 32-bit, so this ${method} no longer wraps.` });
    }
  }
  const deduped = dedupe(options);
  if (deduped.length < 2) {
    deduped.push({ id: "queue", label: formatQueue([s.value]), correct: false, feedback: "Reduction methods return a single value, not a queue. Only locator methods (find*, min, max, unique) return queues." });
  }
  return { question, options: deduped };
}

/** Starting data per element type, chosen so sum() overflows for the 8-bit types. */
export function methodDataPreset(elemType: MethodElemTypeId): number[] {
  if (elemType === "byte") return [100, 15, 8, 15, 23, 4, 8, 99];
  if (elemType === "bit8") return [200, 15, 8, 15, 23, 4, 8, 99];
  return [42, 15, 8, 15, 23, 4, 8, 99];
}

export const ASSOC_PRESET_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function createMethodArray(kind: MethodArrayKind, elemType: MethodElemTypeId, values = methodDataPreset(elemType)): MethodArray {
  const t = SV_ELEM_TYPES[elemType];
  return {
    kind,
    name: "data",
    elemType,
    values: values.map((v) => wrapToWidth(v, t.width, t.signed)),
    keys: kind === "assoc" ? ASSOC_PRESET_KEYS.slice(0, values.length) : [],
  };
}

export function methodArrayDeclaration(array: MethodArray): string {
  const decl = elemDecl(array.elemType);
  if (array.kind === "assoc") {
    return `${decl} ${array.name}[string] = '{${array.values.map((v, i) => `"${array.keys[i]}":${v}`).join(", ")}};`;
  }
  return `${decl} ${array.name}[$] = '{${array.values.join(", ")}};`;
}
