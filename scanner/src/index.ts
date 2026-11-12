import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

enum FileType {
  Test = 'test'
}

type CliArgumentsT = {
  readonly rootPath: string;
  readonly projectName: string;
  readonly fileTypes: readonly FileType[];
  readonly serverUrl?: string;
};

type ScanResultT = {
  readonly groups: readonly string[];
  readonly cases: readonly TestCaseT[];
};

type TestCaseT = {
  readonly group: string;
  readonly name: string;
  readonly description: string;
  readonly prompt: string;
};

const GROUP_FILE_PATTERN: RegExp = /\.test\.(?:[cm]?[jt]s|[jt]sx)$/u;
const CASE_FILE_PATTERN: RegExp = /\.case\.(?:[cm]?[jt]s|[jt]sx)$/u;
const PROJECT_NAME_PATTERN: RegExp = /^[A-Za-z][A-Za-z0-9_-]{0,99}$/u;
const IGNORED_DIRECTORY_NAMES: ReadonlySet<string> = new Set<string>(['.git', 'coverage', 'dist', 'dist-types', 'node_modules', 'test-dist']);

function parseArguments(argumentsList: readonly string[]): CliArgumentsT {
  if (argumentsList.length < 2) throw new Error('Usage: scanner <folder> <project-name> --types test');
  const rootArgument: string | undefined = argumentsList[0];
  const projectName: string | undefined = argumentsList[1];
  if (rootArgument === undefined || projectName === undefined) throw new Error('Usage: scanner <folder> <project-name> --types test');
  const rootPath: string = path.resolve(rootArgument);
  if (!PROJECT_NAME_PATTERN.test(projectName)) throw new Error('Project name must start with a letter and contain only letters, digits, hyphens, or underscores.');
  const typeOptionIndex: number = argumentsList.indexOf('--types');
  const serverUrlOptionIndex: number = argumentsList.indexOf('--server-url');
  if (typeOptionIndex !== -1) {
    const typeValue: string | undefined = argumentsList[typeOptionIndex + 1];
    if (typeValue !== FileType.Test) throw new Error('Only the test file type is currently supported.');
  }
  if (serverUrlOptionIndex === -1) return { rootPath, projectName, fileTypes: [FileType.Test] };
  const serverUrl: string | undefined = argumentsList[serverUrlOptionIndex + 1];
  if (serverUrl === undefined) throw new Error('--server-url requires a URL.');
  new URL(serverUrl);
  return { rootPath, projectName, fileTypes: [FileType.Test], serverUrl };
}

function findFiles(rootPath: string): readonly string[] {
  const pendingDirectories: string[] = [rootPath];
  const files: string[] = [];
  while (pendingDirectories.length > 0) {
    const directory: string | undefined = pendingDirectories.pop();
    if (directory === undefined) continue;
    const entries: readonly fs.Dirent[] = fs.readdirSync(directory, { withFileTypes: true }).sort((left: fs.Dirent, right: fs.Dirent) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const entryPath: string = path.join(directory, entry.name);
      if (entry.isDirectory() && !IGNORED_DIRECTORY_NAMES.has(entry.name)) pendingDirectories.push(entryPath);
      if (entry.isFile()) files.push(entryPath);
    }
  }
  return files.sort((left: string, right: string) => left.localeCompare(right));
}

function nameWithoutSuffix(filePath: string, suffixPattern: RegExp): string {
  const fileName: string = path.basename(filePath);
  return fileName.replace(suffixPattern, '');
}

function findNearestGroupName(casePath: string, rootPath: string, groupNamesByDirectory: ReadonlyMap<string, string>): string {
  let currentDirectory: string = path.dirname(casePath);
  while (true) {
    const groupName: string | undefined = groupNamesByDirectory.get(currentDirectory);
    if (groupName !== undefined) return groupName;
    if (currentDirectory === rootPath) break;
    const parentDirectory: string = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) break;
    currentDirectory = parentDirectory;
  }
  throw new Error(`Test case ${path.relative(rootPath, casePath)} has no ancestor test-group file.`);
}

function propertyInitializer(objectLiteral: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const propertyName: string = property.name.getText();
    if (propertyName === name || propertyName === `'${name}'` || propertyName === `"${name}"`) return property.initializer;
  }
  return undefined;
}

function stringValue(expression: ts.Expression | undefined, fieldName: string, filePath: string): string {
  if (expression !== undefined && (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))) return expression.text;
  throw new Error(`Test case ${filePath} must define TEST_CASE_METADATA.${fieldName} as a string literal.`);
}

function readCaseMetadata(casePath: string): TestCaseT {
  const sourceText: string = fs.readFileSync(casePath, 'utf8');
  const sourceFile: ts.SourceFile = ts.createSourceFile(casePath, sourceText, ts.ScriptTarget.ESNext, true);
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'TEST_CASE_METADATA' || declaration.initializer === undefined || !ts.isObjectLiteralExpression(declaration.initializer)) continue;
      const description: string = stringValue(propertyInitializer(declaration.initializer, 'title'), 'title', casePath);
      const promptExpression: ts.Expression | undefined = propertyInitializer(declaration.initializer, 'prompt');
      if (promptExpression === undefined || !ts.isObjectLiteralExpression(promptExpression)) throw new Error(`Test case ${casePath} must define TEST_CASE_METADATA.prompt.`);
      const availability: string = stringValue(propertyInitializer(promptExpression, 'availability'), 'prompt.availability', casePath);
      const promptFieldName: string = availability === 'available' ? 'text' : 'reason';
      const prompt: string = stringValue(propertyInitializer(promptExpression, promptFieldName), `prompt.${promptFieldName}`, casePath);
      return { group: '', name: '', description, prompt };
    }
  }
  throw new Error(`Test case ${casePath} must export TEST_CASE_METADATA.`);
}

function scanTests(rootPath: string): ScanResultT {
  const files: readonly string[] = findFiles(rootPath);
  const groupFiles: readonly string[] = files.filter((filePath: string) => GROUP_FILE_PATTERN.test(filePath));
  const caseFiles: readonly string[] = files.filter((filePath: string) => CASE_FILE_PATTERN.test(filePath));
  const groupNamesByDirectory: Map<string, string> = new Map<string, string>();
  const groups: string[] = [];
  for (const groupFile of groupFiles) {
    const groupName: string = nameWithoutSuffix(groupFile, GROUP_FILE_PATTERN);
    groupNamesByDirectory.set(path.dirname(groupFile), groupName);
    groups.push(groupName);
  }
  const cases: TestCaseT[] = [];
  for (const caseFile of caseFiles) {
    const groupName: string = findNearestGroupName(caseFile, rootPath, groupNamesByDirectory);
    const caseName: string = nameWithoutSuffix(caseFile, CASE_FILE_PATTERN);
    const metadata: TestCaseT = readCaseMetadata(caseFile);
    cases.push({ group: groupName, name: caseName, description: metadata.description, prompt: metadata.prompt });
  }
  return { groups: groups.sort((left: string, right: string) => left.localeCompare(right)), cases: cases.sort((left: TestCaseT, right: TestCaseT) => `${left.group}.${left.name}`.localeCompare(`${right.group}.${right.name}`)) };
}

async function run(): Promise<void> {
  const argumentsValue: CliArgumentsT = parseArguments(process.argv.slice(2));
  if (!fs.statSync(argumentsValue.rootPath).isDirectory()) throw new Error('Scan folder must be a directory.');
  if (!argumentsValue.fileTypes.includes(FileType.Test)) return;
  const result: ScanResultT = scanTests(argumentsValue.rootPath);
  for (const groupName of result.groups) console.log(`TEST GROUP ${groupName}`);
  for (const testCase of result.cases) {
    console.log(`TEST CASE ${testCase.group}.${testCase.name}`);
    console.log(`  DESCRIPTION ${testCase.description}`);
    console.log(`  PROMPT ${testCase.prompt}`);
  }
  if (argumentsValue.serverUrl === undefined) return;
  const response: Response = await fetch(new URL('/api/updateTests', argumentsValue.serverUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result.cases) });
  if (!response.ok) throw new Error(`Test upload failed with HTTP ${String(response.status)}.`);
}

void run().catch((error: unknown) => {
  const message: string = error instanceof Error ? error.message : 'Scanner failed.';
  console.error(message);
  process.exitCode = 2;
});
