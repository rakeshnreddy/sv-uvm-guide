/**
 * UVM glob matching, as used by the factory (instance-override paths) and by
 * uvm_config_db / uvm_resource_pool (set() scopes).
 *
 * Source: uvm-core 2020.3.1
 * - src/base/uvm_globals.svh `uvm_is_match(expr, str)` calls
 *   `uvm_re_match(expr, str, deglob=1) == 0`.
 * - src/dpi/uvm_regex.cc `uvm_glob_to_re`:
 *   - an empty glob (or a lone "/") becomes `^$`;
 *   - a glob wrapped in slashes (`/re/`) is already a regular expression and
 *     is searched unanchored;
 *   - otherwise `*` → `.*`, `+` → `.+`, `?` → `.`, and `. [ ] ( )` are escaped;
 *     the result is anchored with `^…$`.
 *
 * `*` therefore matches any run of characters, including dots: the scope
 * `uvm_test_top.env.agt*` matches `uvm_test_top.env.agt0.drv` too.
 */

const ESCAPED = new Set([".", "[", "]", "(", ")"]);

/** Converts a UVM glob to a JavaScript RegExp, or null if it cannot be compiled. */
export function uvmGlobToRegExp(glob: string): RegExp | null {
  if (glob.length === 0 || glob === "/") return /^$/;
  try {
    if (glob.length >= 2 && glob.startsWith("/") && glob.endsWith("/")) {
      return new RegExp(glob.slice(1, -1));
    }
    let re = glob.startsWith("^") ? "" : "^";
    for (const ch of glob) {
      if (ch === "*" || ch === "+") re += `.${ch}`;
      else if (ch === "?") re += ".";
      else if (ESCAPED.has(ch)) re += `\\${ch}`;
      else re += ch;
    }
    if (!re.endsWith("$")) re += "$";
    return new RegExp(re);
  } catch {
    return null;
  }
}

/** `uvm_is_match(expr, str)`: true when the glob (or /regex/) `expr` matches `str`. */
export function uvmIsMatch(expr: string, str: string): boolean {
  const re = uvmGlobToRegExp(expr);
  return re ? re.test(str) : false;
}

/**
 * The factory only treats a path as a pattern when it contains `*` or `?`
 * (`uvm_factory_override::m_has_wildcard`, uvm_factory.svh). Any other path is
 * compared with plain string equality, and the path "*" matches every context
 * (`m_matches_inst_override`).
 */
export function factoryPathHasWildcard(path: string): boolean {
  return path.includes("*") || path.includes("?");
}

export function factoryPathMatches(pattern: string, fullInstPath: string): boolean {
  if (factoryPathHasWildcard(pattern)) return pattern === "*" || uvmIsMatch(pattern, fullInstPath);
  return pattern === fullInstPath;
}
