import fs from 'fs';
import path from 'path';

type Finding = {
  file: string;
  line: number;
  className: string;
  variable: string;
  snippet: string;
};

const roots = ['tests', 'labs'];
const ignoredDirs = new Set([
  path.join('tests', 'sv_examples', 'uvm'),
]);

function walkFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (ignoredDirs.has(resolved) || entry.name.startsWith('.')) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...walkFiles(resolved));
    } else if (entry.isFile()) {
      if (resolved.endsWith('.sv') || resolved.endsWith('.svh')) {
        files.push(resolved);
      }
    }
  }
  return files;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function collectUvmClassNames(files: string[]): Set<string> {
  const classNames = new Set<string>();
  const classRegex = /class\s+([A-Za-z_][\w]*)\s+extends\s+uvm_[^{;]*;/g;

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const stripped = stripComments(raw);
    let match: RegExpExecArray | null;
    while ((match = classRegex.exec(stripped)) !== null) {
      classNames.add(match[1]);
    }
  }

  return classNames;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function auditFile(filePath: string, classNames: Set<string>): Finding[] {
  if (classNames.size === 0) {
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const stripped = stripComments(raw);
  const lines = stripped.split(/\r?\n/);
  const findings: Finding[] = [];

  const classNamePattern = Array.from(classNames)
    .map(escapeRegExp)
    .sort((a, b) => b.length - a.length)
    .join('|');

  const declarationRegex = new RegExp(
    `\\b(${classNamePattern})(?:\\s*#\\s*\\([^;]*\\))?\\s+([^;]+)`,
    'g',
  );

  const assignmentRegex = /\b([A-Za-z_][\w]*)\s*=\s*new\b/g;

  const varTypes = new Map<string, string>();

  lines.forEach((line, index) => {
    const flaggedVars = new Set<string>();

    let declMatch: RegExpExecArray | null;
    declarationRegex.lastIndex = 0;
    while ((declMatch = declarationRegex.exec(line)) !== null) {
      const className = declMatch[1];
      const namesSegment = declMatch[2];
      const candidateNames = namesSegment.split(',');
      candidateNames.forEach((candidate) => {
        const [rawName, initializer] = candidate.split('=');
        const trimmedName = rawName?.trim();
        if (!trimmedName) {
          return;
        }

        const cleanName = trimmedName.replace(/\[[^\]]*\]$/g, '').trim();
        if (!cleanName) {
          return;
        }

        varTypes.set(cleanName, className);

        if (initializer && /\bnew\b/.test(initializer)) {
          findings.push({
            file: filePath,
            line: index + 1,
            className,
            variable: cleanName,
            snippet: line.trim(),
          });
          flaggedVars.add(cleanName);
        }
      });
    }

    let assignMatch: RegExpExecArray | null;
    assignmentRegex.lastIndex = 0;
    while ((assignMatch = assignmentRegex.exec(line)) !== null) {
      const varName = assignMatch[1];
      if (flaggedVars.has(varName)) {
        continue;
      }
      const className = varTypes.get(varName);
      if (!className) {
        continue;
      }

      findings.push({
        file: filePath,
        line: index + 1,
        className,
        variable: varName,
        snippet: line.trim(),
      });
      flaggedVars.add(varName);
    }
  });

  return findings;
}

function main() {
  const repoRoot = process.cwd();
  const targetFiles = roots
    .map((relative) => path.join(repoRoot, relative))
    .filter((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory())
    .flatMap((dir) => walkFiles(dir));

  if (targetFiles.length === 0) {
    console.log('No SystemVerilog sources found to audit.');
    process.exit(0);
  }

  const uvmClasses = collectUvmClassNames(targetFiles);

  if (uvmClasses.size === 0) {
    console.log('No classes extending uvm_* were detected.');
    process.exit(0);
  }

  const allFindings = targetFiles.flatMap((file) => auditFile(file, uvmClasses));

  if (allFindings.length === 0) {
    console.log('✅ No direct new() usage found for UVM-derived classes.');
    return;
  }

  console.error('❌ Direct new() usage detected for UVM-derived classes:\n');
  allFindings.forEach((finding) => {
    const relative = path.relative(repoRoot, finding.file);
    console.error(
      `- ${relative}:${finding.line} → ${finding.className} '${finding.variable}' uses new(): ${finding.snippet}`,
    );
  });

  console.error('\nReplace new() with ::type_id::create(...) to leverage the UVM factory.');
  process.exit(1);
}

main();
