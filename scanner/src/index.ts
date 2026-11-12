import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { ClassDetails, ClassMember as ClassMemberT, CompositeTypeT, FieldType as FieldTypeT } from '@codaigram/shared/class-types';
import { JsonMap } from '@codaigram/shared/json-map';
import { initializeLog, log, logAndThrow, loggedFetch } from './utils.js';

enum FileType {
  Test = 'test',
  Class = 'class'
}

type CliArgumentsT = {
  readonly rootPaths: readonly string[];
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

type RelationT = {
  readonly kind: 'UNK';
  readonly name: string;
  readonly target: string;
  // UNTRUST-ALLOW-BOOLEAN: The existing class-details HTTP contract represents reference multiplicity as a boolean; Scanner must preserve that established wire shape while it has no dedicated multiplicity enum.
  readonly many: boolean;
};

type ClassDetailsT = ClassDetails & { readonly declaration: 'CLASS' | 'INTERFACE'; };

const GROUP_FILE_PATTERN: RegExp = /\.test\.(?:[cm]?[jt]s|[jt]sx)$/u;
const CASE_FILE_PATTERN: RegExp = /\.case\.(?:[cm]?[jt]s|[jt]sx)$/u;
const SOURCE_FILE_PATTERN: RegExp = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const PROJECT_NAME_PATTERN: RegExp = /^[A-Za-z][A-Za-z0-9_-]{0,99}$/u;
const IGNORED_DIRECTORY_NAMES: ReadonlySet<string> = new Set<string>(['.git', 'coverage', 'dist', 'dist-tests', 'dist-types', 'node_modules', 'test-dist']);

function parseArguments(argumentsList: readonly string[]): CliArgumentsT {
  if (argumentsList.length < 2) logAndThrow(new Error('Usage: scanner <project-name> <folder[,folder...]> --types <test|class|test,class> [--server-url <url>]'));
  const projectName: string | undefined = argumentsList[0];
  const rootArgument: string | undefined = argumentsList[1];
  if (!rootArgument || !projectName) return logAndThrow(new Error('Usage: scanner <project-name> <folder[,folder...]> --types <test|class|test,class> [--server-url <url>]'));
  if (!PROJECT_NAME_PATTERN.test(projectName)) logAndThrow(new Error('Project name must start with a letter and contain only letters, digits, hyphens, or underscores.'));
  const folders: string[] = rootArgument.split(',').map((folder: string) => folder.trim());
  if (folders.some((folder: string) => !folder)) logAndThrow(new Error('Every scan folder must be nonempty.'));
  const candidates: string[] = Array.from(new Set(folders.map((folder: string) => path.resolve(folder))));
  candidates.forEach((candidate: string) => {
    if (!fs.statSync(candidate).isDirectory()) logAndThrow(new Error('Scan folder must be a directory.'));
  });
  const rootPaths: string[] = candidates.filter((candidate: string) => !candidates.some((other: string) => other !== candidate && isInsideDirectory(candidate, other)));
  const typeOptionIndex: number = argumentsList.indexOf('--types');
  const serverUrlOptionIndex: number = argumentsList.indexOf('--server-url');
  const typeValue: string | undefined = typeOptionIndex === -1 ? FileType.Test : argumentsList[typeOptionIndex + 1];
  const typeNames: readonly string[] = typeValue?.split(',').map((item: string) => item.trim()) ?? [];
  if (typeNames.length === 0 || typeNames.some((item: string) => item !== FileType.Test && item !== FileType.Class)) logAndThrow(new Error('--types must be test, class, or a comma-separated combination such as test,class.'));
  const fileTypes: readonly FileType[] = typeNames.map((item: string) => item === FileType.Test ? FileType.Test : FileType.Class);
  if (serverUrlOptionIndex === -1) return { rootPaths, projectName, fileTypes };
  const serverUrl: string | undefined = argumentsList[serverUrlOptionIndex + 1];
  if (!serverUrl) return logAndThrow(new Error('--server-url requires a URL.'));
  new URL(serverUrl);
  return { rootPaths, projectName, fileTypes, serverUrl };
}

function isInsideDirectory(candidate: string, parent: string): boolean {
  const relative: string = path.relative(parent, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function findFiles(rootPath: string): readonly string[] {
  const pendingDirectories: string[] = [rootPath];
  const files: string[] = [];
  while (pendingDirectories.length > 0) {
    const directory: string | undefined = pendingDirectories.pop();
    if (!directory) continue;
    const entries: readonly fs.Dirent[] = fs.readdirSync(directory, { withFileTypes: true }).sort((left: fs.Dirent, right: fs.Dirent) => left.name.localeCompare(right.name));
    for (let index: number = 0; index < entries.length; index += 1) {
      const entry: fs.Dirent = entries[index]!;
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
    if (groupName) return groupName;
    if (currentDirectory === rootPath) break;
    const parentDirectory: string = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) break;
    currentDirectory = parentDirectory;
  }
  return logAndThrow(new Error(`Test case ${path.relative(rootPath, casePath)} has no ancestor test-group file.`));
}

function propertyInitializer(objectLiteral: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (let index: number = 0; index < objectLiteral.properties.length; index += 1) {
    const property: ts.ObjectLiteralElementLike = objectLiteral.properties.at(index)!;
    if (!ts.isPropertyAssignment(property)) continue;
    const propertyName: string = property.name.getText();
    if (propertyName === name || propertyName === `'${name}'` || propertyName === `"${name}"`) return property.initializer;
  }
  // UNTRUST-ALLOW-NULLISH: TypeScript represents a missing object member as undefined; this boundary returns the absence to the caller, which validates the required metadata.
  return undefined;
}

function stringValue(expression: ts.Expression | undefined, fieldName: string, filePath: string): string {
  if (expression && (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))) return expression.text;
  return logAndThrow(new Error(`Test case ${filePath} must define TEST_CASE_METADATA.${fieldName} as a string literal.`));
}

function readCaseMetadata(casePath: string): TestCaseT {
  const sourceText: string = fs.readFileSync(casePath, 'utf8');
  const sourceFile: ts.SourceFile = ts.createSourceFile(casePath, sourceText, ts.ScriptTarget.ESNext, true);
  for (let statementIndex: number = 0; statementIndex < sourceFile.statements.length; statementIndex += 1) {
    const statement: ts.Statement = sourceFile.statements.at(statementIndex)!;
    if (!ts.isVariableStatement(statement)) continue;
    for (let declarationIndex: number = 0; declarationIndex < statement.declarationList.declarations.length; declarationIndex += 1) {
      const declaration: ts.VariableDeclaration = statement.declarationList.declarations.at(declarationIndex)!;
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'TEST_CASE_METADATA' || !declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) continue;
      const description: string = stringValue(propertyInitializer(declaration.initializer, 'title'), 'title', casePath);
      const promptExpression: ts.Expression | undefined = propertyInitializer(declaration.initializer, 'prompt');
      if (!promptExpression || !ts.isObjectLiteralExpression(promptExpression)) return logAndThrow(new Error(`Test case ${casePath} must define TEST_CASE_METADATA.prompt.`));
      const availability: string = stringValue(propertyInitializer(promptExpression, 'availability'), 'prompt.availability', casePath);
      const promptFieldName: string = availability === 'available' ? 'text' : 'reason';
      const prompt: string = stringValue(propertyInitializer(promptExpression, promptFieldName), `prompt.${promptFieldName}`, casePath);
      return { group: '', name: '', description, prompt };
    }
  }
  return logAndThrow(new Error(`Test case ${casePath} must export TEST_CASE_METADATA.`));
}

function scanTests(rootPath: string): ScanResultT {
  const files: readonly string[] = findFiles(rootPath);
  const groupFiles: readonly string[] = files.filter((filePath: string) => GROUP_FILE_PATTERN.test(filePath));
  const caseFiles: readonly string[] = files.filter((filePath: string) => CASE_FILE_PATTERN.test(filePath));
  const groupNamesByDirectory: Map<string, string> = new Map<string, string>();
  const groups: string[] = [];
  for (let index: number = 0; index < groupFiles.length; index += 1) {
    const groupFile: string = groupFiles[index]!;
    const groupName: string = nameWithoutSuffix(groupFile, GROUP_FILE_PATTERN);
    groupNamesByDirectory.set(path.dirname(groupFile), groupName);
    groups.push(groupName);
    log('INFO', `TEST GROUP ${groupName}`);
  }
  const cases: TestCaseT[] = [];
  for (let index: number = 0; index < caseFiles.length; index += 1) {
    const caseFile: string = caseFiles[index]!;
    const groupName: string = findNearestGroupName(caseFile, rootPath, groupNamesByDirectory);
    const caseName: string = nameWithoutSuffix(caseFile, CASE_FILE_PATTERN);
    const metadata: TestCaseT = readCaseMetadata(caseFile);
    cases.push({
      group: groupName,
      name: caseName,
      description: metadata.description,
      prompt: metadata.prompt });
    log('INFO', `TEST CASE ${groupName}.${caseName} ${JSON.stringify({
      description: metadata.description,
      prompt: metadata.prompt })}`);
  }
  return {
    groups: groups.sort((left: string, right: string) => left.localeCompare(right)),
    cases: cases.sort((left: TestCaseT, right: TestCaseT) => `${left.group}.${left.name}`.localeCompare(`${right.group}.${right.name}`)) };
}

function declarationName(declaration: ts.ClassDeclaration | ts.InterfaceDeclaration): string | undefined {
  return declaration.name?.text;
}

function memberName(member: ts.NamedDeclaration): string | undefined {
  const name: ts.DeclarationName | undefined = member.name;
  if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) return name.text;
  // UNTRUST-ALLOW-NULLISH: A computed or otherwise unsupported TypeScript property name cannot become a stable server relationship name, so this scanner intentionally omits that member without rejecting the containing declaration.
  return undefined;
}

function hasModifier(member: ts.Node, kind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(member)) return false;
  return ts.getModifiers(member)?.some((modifier: ts.Modifier) => modifier.kind === kind) ?? false;
}

function isPublicMember(member: ts.Node): boolean {
  return !hasModifier(member, ts.SyntaxKind.PrivateKeyword) && !hasModifier(member, ts.SyntaxKind.ProtectedKeyword);
}

function compositeType(type: ts.TypeNode | undefined): CompositeTypeT {
  if (!type) return 'unknown';
  if (ts.isTypeLiteralNode(type)) {
    const fields: JsonMap<string, CompositeTypeT> = new JsonMap<string, CompositeTypeT>();
    type.members.forEach((member: ts.TypeElement) => {
      if (!ts.isPropertySignature(member)) return;
      const name: string | undefined = memberName(member);
      if (name) fields.set(name, compositeType(member.type));
    });
    return fields;
  }
  if (ts.isUnionTypeNode(type) && type.types.every((part: ts.TypeNode) => ts.isLiteralTypeNode(part) && ts.isStringLiteral(part.literal))) {
    return type.types.map((part: ts.TypeNode) => (part as ts.LiteralTypeNode).literal.getText().slice(1, -1));
  }
  return type.getText().replace(/\s+/gu, ' ').trim();
}

function appendMember(members: Map<string, FieldTypeT[][]>, name: string, overload: FieldTypeT[]): void {
  const existing: FieldTypeT[][] = members.get(name) ?? [];
  const field: FieldTypeT | undefined = overload.at(0);
  const existingAccessor: FieldTypeT[] | undefined = existing.find((args: FieldTypeT[]) => args.length === 1 && (args[0]?.arg === '+GET' || args[0]?.arg === '+SET' || args[0]?.arg === '+PROP'));
  if (existingAccessor && field && (field.arg === '+GET' || field.arg === '+SET')) {
    existing.splice(existing.indexOf(existingAccessor), 1, [{ arg: '+PROP', t: field.t }]);
  } else if (!existing.some((args: FieldTypeT[]) => JSON.stringify(args) === JSON.stringify(overload))) {
    existing.push(overload);
  }
  members.set(name, existing);
}

function scanMember(member: ts.ClassElement | ts.TypeElement, members: Map<string, FieldTypeT[][]>): void {
  if (!isPublicMember(member)) return;
  if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
    const name: string | undefined = memberName(member);
    if (!name) return;
    appendMember(members, name, [{
      arg: hasModifier(member, ts.SyntaxKind.ReadonlyKeyword) ? '+RO' : '+RW',
      t: compositeType(member.type) }]);
    return;
  }
  if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
    const name: string | undefined = memberName(member);
    if (!name) return;
    const argumentsList: FieldTypeT[] = [];
    member.parameters.forEach((parameter: ts.ParameterDeclaration) => {
      const argumentName: string | undefined = memberName(parameter);
      if (argumentName) argumentsList.push({ arg: argumentName, t: compositeType(parameter.type) });
    });
    appendMember(members, name, argumentsList);
    return;
  }
  if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
    const name: string | undefined = memberName(member);
    if (!name) return;
    const valueParameter: ts.ParameterDeclaration | undefined = member.parameters.at(0);
    appendMember(members, name, [{
      arg: ts.isGetAccessorDeclaration(member) ? '+GET' : '+SET',
      t: ts.isGetAccessorDeclaration(member) ? compositeType(member.type) : compositeType(valueParameter?.type) }]);
  }
}

function referenceName(typeNode: ts.TypeNode): string | undefined {
  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) return typeNode.typeName.text;
  // UNTRUST-ALLOW-NULLISH: A non-identifier TypeScript type expression has no single named declaration target for the provisional scanner relationship model, so this scanner intentionally omits that member relationship.
  return undefined;
}

function relationFor(member: ts.PropertyDeclaration | ts.PropertySignature): RelationT | undefined {
  const name: string | undefined = memberName(member);
  // UNTRUST-ALLOW-NULLISH: Properties without a stable name or explicit type cannot be represented in the current class-details contract, so the scanner intentionally omits them rather than inventing a target.
  if (!name || !member.type) return undefined;
  if (ts.isArrayTypeNode(member.type)) {
    const target: string | undefined = referenceName(member.type.elementType);
    if (!target) {
      // UNTRUST-ALLOW-NULLISH: An array whose element type has no simple identifier cannot be represented as a relationship target in the provisional scanner model, so this scanner intentionally omits that property.
      return undefined;
    }
    return { kind: 'UNK', name, target, many: true };
  }
  // UNTRUST-ALLOW-NULLISH: Primitive, union, intersection, and other non-reference property types have no named declaration target in the provisional scanner model, so the scanner intentionally omits that property.
  if (!ts.isTypeReferenceNode(member.type)) return undefined;
  const target: string | undefined = referenceName(member.type);
  if (!target) {
    // UNTRUST-ALLOW-NULLISH: A qualified or computed type reference has no stable simple declaration name in the provisional scanner model, so this scanner intentionally omits that property relationship.
    return undefined;
  }
  const firstTypeArgument: ts.TypeNode | undefined = member.type.typeArguments?.at(0);
  if (firstTypeArgument) {
    const containedTarget: string | undefined = referenceName(firstTypeArgument);
    if (!containedTarget) {
      // UNTRUST-ALLOW-NULLISH: A generic holding container with a non-identifier element type cannot produce a stable relationship target in the provisional scanner model, so this scanner intentionally omits that property.
      return undefined;
    }
    return { kind: 'UNK', name, target: containedTarget, many: true };
  }
  return { kind: 'UNK', name, target, many: false };
}

function classDetailsFor(declaration: ts.ClassDeclaration | ts.InterfaceDeclaration): ClassDetailsT | undefined {
  const name: string | undefined = declarationName(declaration);
  if (!name) {
    // UNTRUST-ALLOW-NULLISH: Anonymous class expressions and unnamed declarations have no stable document identity for the class-details API, so the scanner intentionally omits them from the persisted inventory.
    return undefined;
  }
  const relations: RelationT[] = [];
  const memberOverloads: Map<string, FieldTypeT[][]> = new Map<string, FieldTypeT[][]>();
  declaration.members.forEach((member: ts.ClassElement | ts.TypeElement) => {
    scanMember(member, memberOverloads);
    if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
      const relation: RelationT | undefined = relationFor(member);
      if (relation) relations.push(relation);
    }
  });
  return {
    declaration: ts.isClassDeclaration(declaration) ? 'CLASS' : 'INTERFACE',
    name,
    methods: Array.from(memberOverloads.entries(), ([name, overloads]: [string, FieldTypeT[][]]) => ({ name, overloads })),
    relations,
    isPartial: false };
}

function scanClasses(rootPaths: readonly string[]): readonly ClassDetailsT[] {
  const discovered: readonly string[] = rootPaths.flatMap(findFiles);
  const knownFiles: ReadonlySet<string> = new Set(discovered);
  const files: readonly string[] = discovered.filter((filePath: string) => isClassSource(filePath, knownFiles));
  const details: ClassDetailsT[] = [];
  files.forEach((filePath: string) => {
    const sourceText: string = fs.readFileSync(filePath, 'utf8');
    const sourceFile: ts.SourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ESNext, true);
    sourceFile.forEachChild((node: ts.Node) => {
      if (!ts.isClassDeclaration(node) && !ts.isInterfaceDeclaration(node)) return;
      const detail: ClassDetailsT | undefined = classDetailsFor(node);
      if (detail) details.push(detail);
    });
  });
  const uniqueNames: Set<string> = new Set<string>();
  details.forEach((detail: ClassDetailsT) => {
    if (uniqueNames.has(detail.name)) logAndThrow(new Error(`Class scan found duplicate declaration ${detail.name}.`));
    uniqueNames.add(detail.name);
  });
  return details.sort((left: ClassDetailsT, right: ClassDetailsT) => left.name.localeCompare(right.name));
}

function isClassSource(filePath: string, knownFiles: ReadonlySet<string>): boolean {
  if (!SOURCE_FILE_PATTERN.test(filePath) || /\.d\.[cm]?ts$/u.test(filePath)) return false;
  if (/\.js$/u.test(filePath) && knownFiles.has(filePath.replace(/\.js$/u, '.ts'))) return false;
  if (/\.jsx$/u.test(filePath) && knownFiles.has(filePath.replace(/\.jsx$/u, '.tsx'))) return false;
  if (/\.mjs$/u.test(filePath) && knownFiles.has(filePath.replace(/\.mjs$/u, '.mts'))) return false;
  if (/\.cjs$/u.test(filePath) && knownFiles.has(filePath.replace(/\.cjs$/u, '.cts'))) return false;
  return true;
}

async function uploadTests(cases: readonly TestCaseT[], serverUrl: string): Promise<void> {
  log('INFO', `Uploading ${cases.length} test cases`);
  const payload: string = JSON.stringify(cases);
  const response: Response = await loggedFetch(new URL('/api/updateTests', serverUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload }, payload);
  if (!response.ok) logAndThrow(new Error(`Test upload failed with HTTP ${String(response.status)}.`));
  log('INFO', `Test upload completed with HTTP ${String(response.status)}`);
}

async function uploadClasses(classes: readonly ClassDetailsT[], serverUrl: string): Promise<void> {
  log('INFO', `Uploading ${classes.length} class declarations`);
  const payload: string = JSON.stringify(classes.map((detail: ClassDetailsT) => ({
    name: detail.name,
    methods: detail.methods,
    relations: detail.relations,
    isPartial: detail.isPartial })));
  const response: Response = await loggedFetch(new URL('/api/updateClasses', serverUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload }, payload);
  if (!response.ok) logAndThrow(new Error(`Class upload failed with HTTP ${String(response.status)}.`));
  log('INFO', `Class upload completed with HTTP ${String(response.status)}`);
}

function printClassDetails(detail: ClassDetailsT): void {
  console.log(`${detail.declaration} ${detail.name}`);
  detail.methods.forEach((member: ClassMemberT) => {
    const marker: FieldTypeT | undefined = member.overloads.at(0)?.at(0);
    if (marker?.arg === '+RO' || marker?.arg === '+RW') {
      console.log(`  FIELD ${member.name} ${marker.arg}: ${typeToText(marker.t)}`);
    } else if (marker?.arg === '+GET' || marker?.arg === '+SET' || marker?.arg === '+PROP') {
      console.log(`  ACCESSOR ${member.name} ${marker.arg}: ${typeToText(marker.t)}`);
    } else {
      member.overloads.forEach((args: FieldTypeT[]) => { console.log(`  METHOD ${member.name}(${args.map((field: FieldTypeT) => `${field.arg}: ${typeToText(field.t)}`).join(', ')})`); });
    }
  });
  detail.relations.forEach((relation: ClassDetails['relations'][number]) => {
    console.log(`  RELATION ${relation.kind} ${relation.name}: ${relation.target}${relation.many ? '[]' : ''}`);
  });
}

function typeToText(type: CompositeTypeT): string {
  if (typeof type === 'string') return type;
  if (Array.isArray(type)) return type.map((value: string) => `'${value}'`).join(' | ');
  return `{ ${Array.from(type.entries(), ([name, value]: [string, CompositeTypeT]) => `${name}: ${typeToText(value)}`).join(', ')} }`;
}

async function run(): Promise<void> {
  if (logOptionIndex >= 0 && (!argumentsList[logOptionIndex + 1] || argumentsList[logOptionIndex + 1]?.startsWith('--'))) logAndThrow(new Error('--logfile requires a file name.'));
  const argumentsValue: CliArgumentsT = parseArguments(process.argv.slice(2));
  log('INFO', `Starting scan for project ${argumentsValue.projectName} in ${argumentsValue.rootPaths.join(', ')}`);
  if (argumentsValue.fileTypes.includes(FileType.Test)) {
    const results: ScanResultT[] = argumentsValue.rootPaths.map(scanTests);
    const result: ScanResultT = {
      groups: results.flatMap((item: ScanResultT) => item.groups).sort((left: string, right: string) => left.localeCompare(right)),
      cases: results.flatMap((item: ScanResultT) => item.cases).sort((left: TestCaseT, right: TestCaseT) => `${left.group}.${left.name}`.localeCompare(`${right.group}.${right.name}`)) };
    const caseNames: Set<string> = new Set<string>();
    result.cases.forEach((item: TestCaseT) => {
      const identity: string = `${item.group}.${item.name}`;
      if (caseNames.has(identity)) logAndThrow(new Error(`Test scan found duplicate case ${identity}.`));
      caseNames.add(identity);
    });
    log('INFO', `Test scan completed: ${result.groups.length} groups, ${result.cases.length} cases`);
    for (let index: number = 0; index < result.groups.length; index += 1) console.log(`TEST GROUP ${result.groups[index]!}`);
    for (let index: number = 0; index < result.cases.length; index += 1) {
      const testCase: TestCaseT = result.cases[index]!;
      console.log(`TEST CASE ${testCase.group}.${testCase.name}`);
      console.log(`  DESCRIPTION ${testCase.description}`);
      console.log(`  PROMPT ${testCase.prompt}`);
    }
    if (argumentsValue.serverUrl) await uploadTests(result.cases, argumentsValue.serverUrl);
  }
  if (argumentsValue.fileTypes.includes(FileType.Class)) {
    const classes: readonly ClassDetailsT[] = scanClasses(argumentsValue.rootPaths);
    log('INFO', `Class scan completed: ${classes.length} declarations`);
    classes.forEach(printClassDetails);
    if (argumentsValue.serverUrl) await uploadClasses(classes, argumentsValue.serverUrl);
  }
}

const argumentsList: readonly string[] = process.argv.slice(2);
const logOptionIndex: number = argumentsList.indexOf('--logfile');
const logFileArgument: string = argumentsList[logOptionIndex + 1] ?? '';
const requestedLogFile: string = logOptionIndex < 0 || !logFileArgument || logFileArgument.startsWith('--') ? 'scanner.log' : logFileArgument;
try {
  initializeLog(requestedLogFile);
} catch (error: unknown) {
  console.error('Could not initialize scanner log:', error);
  process.exitCode = 2;
}

if (process.exitCode !== 2) void run().catch((error: unknown) => {
  console.error('Scanner failed:', error instanceof Error ? error.message : 'Unknown error');
  try {
    log('WARN', error instanceof Error ? error.stack ?? error.message : String(error));
    log('ERROR', error instanceof Error ? error.stack ?? error.message : String(error));
  } catch (loggingError: unknown) {
    console.error('Could not write scanner log:', loggingError);
  }
  process.exitCode = 2;
});
