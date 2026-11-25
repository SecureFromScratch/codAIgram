import * as fs from "node:fs";
import * as path from "node:path";

export interface ScannedTestCase {
  readonly group: string;
  readonly name: string;
  readonly description: string;
  readonly prompt: string;
  readonly prompts: readonly { readonly when: string; readonly text: string }[];
}

export interface TestScanResult {
  readonly groups: readonly string[];
  readonly cases: readonly ScannedTestCase[];
}

export interface ScannedClass {
  readonly declaration: "CLASS" | "INTERFACE";
  readonly name: string;
  readonly sourceFile: string;
  readonly modifiedAt: string;
  readonly methods: readonly { readonly name: string; readonly overloads: readonly unknown[][] }[];
  readonly relations: readonly { readonly kind: "UNK"; readonly name: string; readonly target: string; readonly many: boolean }[];
}

/** Return the source text defining a named class or interface in a requested file. */
export function getTypeCode(workFolders: readonly string[], filepath: string, typeName: string): string | undefined {
  return getTypeCodes(workFolders, filepath, typeName)[0];
}

/** Return source text for every matching declaration across the supplied work folders. */
export function getTypeCodes(workFolders: readonly string[], filepath: string, typeName: string): readonly string[] {
  if (filepath.split(/[\\/]/u).includes("..")) return [];
  const candidates: readonly string[] = path.isAbsolute(filepath)
    ? [path.resolve(filepath)]
    : workFolders.map((folder: string) => path.resolve(folder, filepath));
  const matches: string[] = [];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
    const source: string = fs.readFileSync(candidate, "utf8");
    const declaration: RegExp = new RegExp(`\\b(?:class|interface)\\s+${escapeRegExp(typeName)}\\b`, "u");
    const match: RegExpExecArray | null = declaration.exec(source);
    if (!match || match.index === undefined) continue;
    const openingBrace: number = source.indexOf("{", match.index);
    if (openingBrace < 0) continue;
    let depth: number = 0;
    let inString: string | undefined;
    for (let index: number = openingBrace; index < source.length; index += 1) {
      const character: string = source[index] ?? "";
      if (inString) {
        if (character === "\\" ) index += 1;
        else if (character === inString) inString = undefined;
        continue;
      }
      if (character === '"' || character === "'" || character === "`") { inString = character; continue; }
      if (character === "{") depth += 1;
      if (character === "}" && --depth === 0) {
        matches.push(source.slice(match.index, index + 1).trim());
        break;
      }
    }
  }
  return matches;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\[\]\\]/gu, "\\$&");
}

const IGNORED_DIRECTORIES: ReadonlySet<string> = new Set<string>([".git", ".test-ca", ".vscode", ".vscode-launch-check", ".vscode-test", "coverage", "dist", "dist-tests", "node-compile-cache", "node_modules", "test-dist"]);
const SOURCE_PATTERN: RegExp = /\.(?:[cm]?[jt]s|[jt]sx)$/u;

export function findSourceFiles(workFolders: readonly string[] | string): readonly string[] {
  const files: string[] = [];
  const folders: readonly string[] = typeof workFolders === "string" ? [workFolders] : workFolders;
  const pending: string[] = folders.map((folder: string) => path.resolve(folder));
  while (pending.length > 0) {
    const directory: string | undefined = pending.pop();
    if (!directory) continue;
    const entries: readonly fs.Dirent[] = fs.readdirSync(directory, { withFileTypes: true });
    entries.forEach((entry: fs.Dirent) => {
      const entryPath: string = path.join(directory, entry.name);
      if (entry.isDirectory() && !IGNORED_DIRECTORIES.has(entry.name)) pending.push(entryPath);
      if (entry.isFile()) files.push(entryPath);
    });
  }
  return files.filter((filePath: string) => SOURCE_PATTERN.test(filePath)).sort((left: string, right: string) => left.localeCompare(right));
}

export function scanForTests(workFolders: readonly string[]): TestScanResult {
  const files: readonly string[] = findSourceFiles(workFolders);
  const groupsByDirectory: Map<string, string> = new Map<string, string>();
  files.filter((filePath: string) => /\.test\.(?:[cm]?[jt]s|[jt]sx)$/u.test(filePath)).forEach((filePath: string) => {
    groupsByDirectory.set(path.dirname(filePath), path.basename(filePath).replace(/\.test\..+$/u, ""));
  });
  const cases: ScannedTestCase[] = [];
  files.filter((filePath: string) => /\.case\.(?:[cm]?[jt]s|[jt]sx)$/u.test(filePath)).forEach((filePath: string) => {
    const source: string = fs.readFileSync(filePath, "utf8");
    const group: string = groupsByDirectory.get(path.dirname(filePath)) ?? "";
    const title: string = source.match(/title\s*:\s*["'`]([^"'`]+)["'`]/u)?.[1] ?? path.basename(filePath);
    const prompt: string = source.match(/prompt\s*:\s*["'`]([^"'`]+)["'`]/u)?.[1] ?? "";
    const name: string = path.basename(filePath).replace(/\.case\..+$/u, "");
    cases.push({ group, name, description: title, prompt, prompts: prompt ? [{ when: "", text: prompt }] : [] });
  });
  const groups: readonly string[] = Array.from(new Set<string>(Array.from(groupsByDirectory.values()))).sort();
  return { groups, cases: cases.sort((left: ScannedTestCase, right: ScannedTestCase) => `${left.group}.${left.name}`.localeCompare(`${right.group}.${right.name}`)) };
}

export function scanForClasses(workFolders: readonly string[]): readonly ScannedClass[] {
  const results: ScannedClass[] = [];
  findSourceFiles(workFolders).forEach((filePath: string) => {
    const source: string = fs.readFileSync(filePath, "utf8");
    const declarationPattern: RegExp = /\b(class|interface)\s+([A-Za-z_$][\w$]*)/gu;
    let match: RegExpExecArray | null = declarationPattern.exec(source);
    while (match) {
      const declaration: "CLASS" | "INTERFACE" = match[1] === "class" ? "CLASS" : "INTERFACE";
      const name: string = match[2] ?? "";
      const methods: { name: string; overloads: readonly unknown[][] }[] = [];
      const body: string = source.slice(match.index);
      const methodPattern: RegExp = /\b([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*[{;]/gu;
      let methodMatch: RegExpExecArray | null = methodPattern.exec(body);
      while (methodMatch) {
        const methodName: string = methodMatch[1] ?? "";
        if (methodName !== "if" && methodName !== "for" && methodName !== "while") methods.push({ name: methodName, overloads: [[]] });
        methodMatch = methodPattern.exec(body);
      }
      results.push({ declaration, name, sourceFile: path.relative(path.resolve(workFolders[0] ?? "."), filePath).split(path.sep).join("/"), modifiedAt: fs.statSync(filePath).mtime.toISOString(), methods, relations: [] });
      match = declarationPattern.exec(source);
    }
  });
  return results.sort((left: ScannedClass, right: ScannedClass) => left.name.localeCompare(right.name));
}
