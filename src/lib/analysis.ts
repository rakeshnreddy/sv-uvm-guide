import * as acorn from "acorn";

export interface AnalysisResult {
  dependencies: string[];
  performance: Record<string, number>;
}

/**
 * Parse source code into an AST using acorn.
 */
export function parseAST(code: string) {
  return acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" });
}

/**
 * Very lightweight pattern matcher that checks whether the serialized AST
 * contains the provided pattern string. This is a placeholder for a real
 * pattern matching engine.
 */
export function matchPattern(ast: unknown, pattern: string): boolean {
  return JSON.stringify(ast).includes(pattern);
}

/**
 * Recursively walk the AST collecting module dependencies from import
 * declarations. This intentionally avoids external traversal libraries to
 * keep the example self-contained.
 */
export function analyzeDependencies(ast: any): string[] {
  const deps: string[] = [];
  (function walk(node: any) {
    if (node && typeof node === "object") {
      if (node.type === "ImportDeclaration" && node.source?.value) {
        deps.push(String(node.source.value));
      }
      for (const key of Object.keys(node)) {
        const value = (node as any)[key];
        if (Array.isArray(value)) {
          value.forEach(walk);
        } else if (value && typeof value === "object") {
          walk(value);
        }
      }
    }
  })(ast);
  return deps;
}

/**
 * Produce a naive timing prediction for each module. In a real system this
 * would use historical run data or static analysis to estimate cost.
 */
export function predictTiming(modules: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const mod of modules) {
    result[mod] = mod.length;
  }
  return result;
}

export function analyzeSource(code: string): AnalysisResult {
  const ast = parseAST(code);
  const dependencies = analyzeDependencies(ast);
  const performance = predictTiming(dependencies);
  return { dependencies, performance };
}
