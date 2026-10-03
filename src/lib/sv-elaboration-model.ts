/**
 * Deterministic model of two elaboration-time naming rules learners need for
 * hierarchical paths (config_db, bind, waveforms):
 *
 * 1. `bind` (IEEE 1800-2023 §23.11)
 *    - `bind <module> <inst>` inserts the instance into every instance of the module, designwide.
 *    - `bind <module> : <inst-list> <inst>` inserts it only into the listed instances.
 *    - `bind <instance-path> <inst>` inserts it into that one instance.
 *    - The bound instance behaves as if written at the end of the target scope, so
 *      its path is `<target instance path>.<instance name>` and port expressions are
 *      resolved in the target scope.
 *    - An instance name that clashes with a name already in the target scope, or with
 *      a name introduced by another bind, is an error.
 *
 * 2. Generate block names (§27.4, §27.6)
 *    - Every generate construct in a scope is numbered 1, 2, 3 … in textual order,
 *      named or not.
 *    - An unnamed generate block is called `genblk<n>`; leading zeros are added while
 *      that name clashes with an explicitly declared name.
 *    - Loop generate blocks are indexed: `<name>[i]`.
 */

// ---------------------------------------------------------------------------
// bind
// ---------------------------------------------------------------------------

export interface DesignInstance {
  path: string;
  module: string;
  /** Names already declared inside this instance's module (for clash checks). */
  localNames?: string[];
}

export type BindForm = "module" | "module-list" | "instance";

export interface BindDirective {
  form: BindForm;
  /** Module name (module, module-list) or instance path (instance). */
  target: string;
  /** For module-list: instance paths of `target` to bind into. */
  instances?: string[];
  /** The module/interface/checker being instantiated. */
  unit: string;
  instanceName: string;
  ports: string;
}

export interface BoundInstance {
  path: string;
  parent: string;
  unit: string;
}

export interface BindError {
  message: string;
  clause: string;
}

export interface BindResult {
  bound: BoundInstance[];
  errors: BindError[];
}

export function bindToSource(bind: BindDirective): string {
  const head =
    bind.form === "module"
      ? `bind ${bind.target}`
      : bind.form === "module-list"
        ? `bind ${bind.target} : ${(bind.instances ?? []).join(", ")}`
        : `bind ${bind.target}`;
  return `${head} ${bind.unit} ${bind.instanceName} (${bind.ports});`;
}

export function bindTargets(design: DesignInstance[], bind: BindDirective): { targets: DesignInstance[]; errors: BindError[] } {
  if (bind.form === "module") {
    const targets = design.filter((d) => d.module === bind.target);
    return targets.length > 0
      ? { targets, errors: [] }
      : { targets, errors: [{ message: `No instance of module ${bind.target} exists, so nothing is bound.`, clause: "§23.11" }] };
  }
  if (bind.form === "module-list") {
    const errors: BindError[] = [];
    const targets: DesignInstance[] = [];
    for (const p of bind.instances ?? []) {
      const inst = design.find((d) => d.path === p);
      if (!inst || inst.module !== bind.target) errors.push({ message: `${p} is not an instance of ${bind.target}.`, clause: "§23.11" });
      else targets.push(inst);
    }
    return { targets, errors };
  }
  const inst = design.find((d) => d.path === bind.target);
  return inst ? { targets: [inst], errors: [] } : { targets: [], errors: [{ message: `No instance ${bind.target} exists.`, clause: "§23.11" }] };
}

export function resolveBinds(design: DesignInstance[], binds: BindDirective[]): BindResult {
  const bound: BoundInstance[] = [];
  const errors: BindError[] = [];
  const introduced = new Map<string, string[]>();
  for (const bind of binds) {
    const { targets, errors: targetErrors } = bindTargets(design, bind);
    errors.push(...targetErrors);
    for (const target of targets) {
      const existing = [...(target.localNames ?? []), ...(introduced.get(target.path) ?? [])];
      if (existing.includes(bind.instanceName)) {
        errors.push({
          message: `${target.path} already has a name ${bind.instanceName}; a bound instance name may not clash with it.`,
          clause: "§23.11",
        });
        continue;
      }
      introduced.set(target.path, [...(introduced.get(target.path) ?? []), bind.instanceName]);
      bound.push({ path: `${target.path}.${bind.instanceName}`, parent: target.path, unit: bind.unit });
    }
  }
  return { bound, errors };
}

// ---------------------------------------------------------------------------
// generate block names
// ---------------------------------------------------------------------------

export interface GenerateConstruct {
  kind: "loop" | "if";
  /** `begin : label`. Absent = unnamed block. */
  label?: string;
  /** Loop only: number of iterations (genvar 0..n-1). */
  iterations?: number;
  /** If only: whether the condition elaborates true (no else branch modelled). */
  condition?: boolean;
  /** Names declared in the generated block (instances, variables). */
  items: string[];
  /** Generate constructs nested inside the block. */
  nested?: GenerateConstruct[];
}

export interface GenerateScope {
  path: string;
  /** Explicitly declared names in the scope (parameters, signals, instances). */
  declared: string[];
  constructs: GenerateConstruct[];
}

/** Name of each construct's block per §27.6 (label, or genblk<n> with leading zeros on clash). */
export function generateBlockNames(declared: string[], constructs: GenerateConstruct[]): string[] {
  const taken = new Set([...declared, ...constructs.flatMap((c) => (c.label ? [c.label] : []))]);
  return constructs.map((c, index) => {
    if (c.label) return c.label;
    const n = String(index + 1);
    let name = `genblk${n}`;
    let zeros = "";
    while (taken.has(name)) {
      zeros += "0";
      name = `genblk${zeros}${n}`;
    }
    taken.add(name);
    return name;
  });
}

/** Every full hierarchical path created by the scope's generate constructs. */
export function elaborateGenerate(scope: GenerateScope): string[] {
  const names = generateBlockNames(scope.declared, scope.constructs);
  const paths: string[] = [];
  scope.constructs.forEach((c, i) => {
    const blocks: string[] =
      c.kind === "loop" ? Array.from({ length: c.iterations ?? 0 }, (_, k) => `${scope.path}.${names[i]}[${k}]`) : c.condition ? [`${scope.path}.${names[i]}`] : [];
    for (const block of blocks) {
      for (const item of c.items) paths.push(`${block}.${item}`);
      if (c.nested?.length) {
        paths.push(...elaborateGenerate({ path: block, declared: [...c.items, ...c.nested.flatMap((n) => (n.label ? [n.label] : []))], constructs: c.nested }));
      }
    }
  });
  return paths;
}
