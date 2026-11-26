import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import type { ArgsListT, ClassDetails, ClassMember as ClassMemberT, CompositeTypeT, FieldType as FieldTypeT } from '@codaigram/shared/class-types';
import { JsonMap } from '@codaigram/shared/json-map';
import type { ScannedClassT as ClassDetailsT, ScannedUnknownRelationT as RelationT, StoredScannedClassT as StoredClassT } from '@codaigram/shared/model/class';
import type { PromptHistoryEntryT, ScannedTestCaseT as TestCaseT, TestScanResultT as ScanResultT } from '@codaigram/shared/model/test';
import { findSourceFiles } from '@codaigram/scan-shared';
import { formatFailure, initializeLog, log, logAndThrow, loggedFetch } from './scanner_utils.js';

enum FileType {
  Test = 'test',
  Class = 'class'
}

type CliArgumentsT = {
  readonly rootPaths: readonly string[];
  readonly projectName: string;
  readonly fileTypes: readonly FileType[];
  readonly slowtrace: boolean;
  readonly serverUrl?: string;
};

const GROUP_FILE_PATTERN: RegExp = /\.test\.(?:[cm]?[jt]s|[jt]sx)$/u;
const CASE_FILE_PATTERN: RegExp = /\.case\.(?:[cm]?[jt]s|[jt]sx)$/u;
const SOURCE_FILE_PATTERN: RegExp = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const PROJECT_NAME_PATTERN: RegExp = /^[A-Za-z][A-Za-z0-9_-]{0,99}$/u;
const IGNORED_DIRECTORY_NAMES: ReadonlySet<string> = new Set<string>(['.git', 'coverage', 'dist', 'dist-tests', 'dist-types', 'node_modules', 'test-dist']);

function parseArguments(argumentsList: readonly string[]): CliArgumentsT {
  if (argumentsList.length < 2) logAndThrow(new Error('Usage: scanner <project-name> <folder[,folder...]> --types <test|class|test,class> [--server-url <url>] [--slowtrace]'));
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
  const slowtrace: boolean = argumentsList.includes('--slowtrace');
  if (serverUrlOptionIndex === -1) return { rootPaths, projectName, fileTypes, slowtrace };
  const serverUrl: string | undefined = argumentsList[serverUrlOptionIndex + 1];
  if (!serverUrl) return logAndThrow(new Error('--server-url requires a URL.'));
  new URL(serverUrl);
  return { rootPaths, projectName, fileTypes, serverUrl, slowtrace };
}

function isInsideDirectory(candidate: string, parent: string): boolean {
  const relative: string = path.relative(parent, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

const findFiles = findSourceFiles;

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
    const propertyName: string = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : '';
    if (propertyName === name) return property.initializer;
  }
  // UNTRUST-ALLOW-NULLISH: TypeScript represents a missing object member as undefined; this boundary returns the absence to the caller, which validates the required metadata.
  return undefined;
}

function stringValue(expression: ts.Expression | undefined, fieldName: string, filePath: string): string {
  if (expression && (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))) return expression.text;
  return logAndThrow(new Error(`Test case ${filePath} must define TEST_CASE_METADATA.${fieldName} as a string literal.`));
}

function readPromptHistory(prompt: ts.ObjectLiteralExpression, casePath: string): PromptHistoryEntryT[] {
  const history: ts.Expression | undefined = propertyInitializer(prompt, 'history');
  if (!history || !ts.isArrayLiteralExpression(history)) return logAndThrow(new Error(`Test case ${casePath} must define prompt.history as an array.`));
  return history.elements.map((entry: ts.Expression) => {
    if (!ts.isObjectLiteralExpression(entry)) return logAndThrow(new Error(`Test case ${casePath} contains an invalid prompt history entry.`));
    const when: string = stringValue(propertyInitializer(entry, 'when'), 'prompt.history.when', casePath);
    const text: string = stringValue(propertyInitializer(entry, 'text'), 'prompt.history.text', casePath);
    if (!when.trim() || !text.trim()) return logAndThrow(new Error(`Test case ${casePath} contains an empty prompt history entry.`));
    return { when, text };
  });
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
      if (availability !== 'available' && availability !== 'unavailable') return logAndThrow(new Error(`Test case ${casePath} has invalid prompt availability.`));
      const prompts: PromptHistoryEntryT[] = readPromptHistory(promptExpression, casePath);
      const prompt: string = prompts.at(-1)?.text ?? '';
      return { group: '', name: '', description, prompt, prompts };
    }
  }
  return logAndThrow(new Error(`Test case ${casePath} must export TEST_CASE_METADATA.`));
}

type TestFlowCallT = {
  readonly call: string;
  readonly subcalls?: readonly TestFlowCallT[];
  readonly recursiveCall?: readonly string[];
};

type TestFlowT = {
  readonly testname: string;
  readonly calls: readonly TestFlowCallT[];
};

type TestFunctionT = {
  readonly key: ts.Node;
  readonly declaration: ts.FunctionLikeDeclaration;
};

type ActiveTestFunctionT = {
  readonly key: ts.Node;
  readonly route: readonly string[];
};

function testTitle(sourceFile: ts.SourceFile, fallback: string): string {
  for (let statementIndex: number = 0; statementIndex < sourceFile.statements.length; statementIndex += 1) {
    const statement: ts.Statement = sourceFile.statements.at(statementIndex)!;
    if (!ts.isVariableStatement(statement)) continue;
    for (let declarationIndex: number = 0; declarationIndex < statement.declarationList.declarations.length; declarationIndex += 1) {
      const declaration: ts.VariableDeclaration = statement.declarationList.declarations.at(declarationIndex)!;
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'TEST_CASE_METADATA' || !declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) continue;
      const title: ts.Expression | undefined = propertyInitializer(declaration.initializer, 'title');
      if (title && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))) return title.text;
    }
  }
  return fallback;
}

function callName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    if (ts.isIdentifier(expression.expression)) return `${expression.expression.text}.${expression.name.text}`;
    return expression.name.text;
  }
  if (ts.isElementAccessExpression(expression)) return expression.getText();
  return expression.getText();
}

function testFunctionTarget(call: ts.CallExpression, checker: ts.TypeChecker): TestFunctionT | undefined {
  let symbolLocation: ts.Node = call.expression;
  if (ts.isPropertyAccessExpression(symbolLocation)) symbolLocation = symbolLocation.name;
  if (!ts.isIdentifier(symbolLocation)) return undefined;
  let symbol: ts.Symbol | undefined = checker.getSymbolAtLocation(symbolLocation);
  if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) symbol = checker.getAliasedSymbol(symbol);
  const declarations: readonly ts.Declaration[] = symbol?.declarations ?? [];
  for (let declarationIndex: number = 0; declarationIndex < declarations.length; declarationIndex += 1) {
    const declaration: ts.Declaration = declarations[declarationIndex]!;
    if (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration) || ts.isFunctionExpression(declaration) || ts.isArrowFunction(declaration)) {
      return { key: declaration, declaration };
    }
    if (ts.isVariableDeclaration(declaration) && declaration.initializer && (ts.isFunctionExpression(declaration.initializer) || ts.isArrowFunction(declaration.initializer))) {
      return { key: declaration, declaration: declaration.initializer };
    }
  }
  return undefined;
}

function testFlowCalls(node: ts.Node, checker: ts.TypeChecker, activeFunctions: readonly ActiveTestFunctionT[], route: readonly string[]): TestFlowCallT[] {
  if (ts.isCallExpression(node)) return [buildTestFlowCall(node, checker, activeFunctions, route)];
  const calls: TestFlowCallT[] = [];
  function visit(current: ts.Node): void {
    if (ts.isFunctionLike(current) && current !== node) return;
    if (ts.isCallExpression(current)) {
      calls.push(buildTestFlowCall(current, checker, activeFunctions, route));
      return;
    }
    current.forEachChild(visit);
  }
  node.forEachChild(visit);
  return calls;
}

function buildTestFlowCall(callExpression: ts.CallExpression, checker: ts.TypeChecker, activeFunctions: readonly ActiveTestFunctionT[], parentRoute: readonly string[]): TestFlowCallT {
  const name: string = callName(callExpression.expression);
  const callRoute: readonly string[] = [...parentRoute, name];
  const target: TestFunctionT | undefined = testFunctionTarget(callExpression, checker);
  const activeTarget: ActiveTestFunctionT | undefined = target ? activeFunctions.find((item: ActiveTestFunctionT) => item.key === target.key) : undefined;
  if (activeTarget) return { call: name, recursiveCall: activeTarget.route };

  const nextActive: readonly ActiveTestFunctionT[] = target
    ? [...activeFunctions, { key: target.key, route: callRoute }]
    : activeFunctions;
  const nestedCalls: TestFlowCallT[] = [];
  if (ts.isPropertyAccessExpression(callExpression.expression) && ts.isCallExpression(callExpression.expression.expression)) {
    nestedCalls.push(buildTestFlowCall(callExpression.expression.expression, checker, activeFunctions, callRoute));
  } else if (ts.isCallExpression(callExpression.expression)) {
    nestedCalls.push(buildTestFlowCall(callExpression.expression, checker, activeFunctions, callRoute));
  }
  callExpression.arguments.forEach((argument: ts.Expression) => {
    if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) nestedCalls.push(...testFlowCalls(argument, checker, nextActive, callRoute));
    else nestedCalls.push(...testFlowCalls(argument, checker, activeFunctions, callRoute));
  });
  if (target && target.declaration.body) nestedCalls.push(...testFlowCalls(target.declaration.body, checker, nextActive, callRoute));
  if (nestedCalls.length === 0) return { call: name };
  return { call: name, subcalls: nestedCalls };
}

function testFlowForCase(casePath: string, title: string, program: ts.Program): TestFlowT {
  const sourceFile: ts.SourceFile | undefined = program.getSourceFile(casePath);
  if (!sourceFile) return logAndThrow(new Error(`Unable to load scanner test source ${casePath}.`));
  const checker: ts.TypeChecker = program.getTypeChecker();
  const calls: TestFlowCallT[] = [];
  let foundTest: boolean = false;
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const calledName: string = callName(node.expression);
      const callback: ts.Expression | undefined = node.arguments.at(1);
      if ((calledName === 'test' || calledName === 'it' || calledName.endsWith('.test') || calledName.endsWith('.it')) && callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        foundTest = true;
        calls.push(...testFlowCalls(callback, checker, [], []));
        return;
      }
    }
    node.forEachChild(visit);
  }
  visit(sourceFile);
  if (!foundTest) return logAndThrow(new Error(`Scanner test case ${casePath} does not contain a test/it callback for flow generation.`));
  return { testname: title, calls };
}

function writeTestFlow(casePath: string, flow: TestFlowT): void {
  const flowPath: string = casePath.replace(SOURCE_FILE_PATTERN, '.flow.json');
  fs.writeFileSync(flowPath, `${JSON.stringify(flow, null, 2)}\n`, 'utf8');
  log('INFO', `TEST FLOW ${path.relative(process.cwd(), flowPath)}`);
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
  const program: ts.Program = ts.createProgram({
    rootNames: files,
    options: {
      allowJs: true,
      checkJs: false,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ESNext
    }
  });
  for (let index: number = 0; index < caseFiles.length; index += 1) {
    const caseFile: string = caseFiles[index]!;
    const groupName: string = findNearestGroupName(caseFile, rootPath, groupNamesByDirectory);
    const caseName: string = nameWithoutSuffix(caseFile, CASE_FILE_PATTERN);
    const metadata: TestCaseT = readCaseMetadata(caseFile);
    const flowSourceFile: ts.SourceFile | undefined = program.getSourceFile(caseFile);
    if (!flowSourceFile) logAndThrow(new Error(`Unable to load scanner test source ${caseFile}.`));
    writeTestFlow(caseFile, testFlowForCase(caseFile, testTitle(flowSourceFile, caseName), program));
    cases.push({
      group: groupName,
      name: caseName,
      description: metadata.description,
      prompt: metadata.prompt,
      prompts: metadata.prompts });
    log('INFO', `TEST CASE ${groupName}.${caseName} ${JSON.stringify({
      description: metadata.description,
      prompts: metadata.prompts })}`);
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
  const withoutComments: string = ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, type, type.getSourceFile());
  return withoutComments.replace(/\s+/gu, ' ').trim();
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
    const argumentsList: FieldTypeT[] = [{ arg: '+RET', t: compositeType(member.type) }];
    member.parameters.forEach((parameter: ts.ParameterDeclaration) => {
      const argumentName: string | undefined = memberName(parameter);
      if (argumentName) argumentsList.push({ arg: argumentName, t: compositeType(parameter.type) });
    });
    appendMember(members, name, argumentsList);
    return;
  }
  if (ts.isCallSignatureDeclaration(member)) {
    const argumentsList: FieldTypeT[] = [{ arg: '+RET', t: compositeType(member.type) }];
    member.parameters.forEach((parameter: ts.ParameterDeclaration) => {
      const argumentName: string | undefined = memberName(parameter);
      if (argumentName) argumentsList.push({ arg: argumentName, t: compositeType(parameter.type) });
    });
    appendMember(members, '', argumentsList);
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
    return relationDetails(member, name, target, true);
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
    return relationDetails(member, name, containedTarget, true);
  }
  return relationDetails(member, name, target, false);
}

function relationDetails(member: ts.PropertyDeclaration | ts.PropertySignature, name: string, target: string, many: boolean): RelationT {
  if (!isPublicMember(member)) return { kind: 'UNK', name, member: name, target, many };
  return { kind: 'UNK', name, target, many };
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
    relations };
}

function typeAliasDetailsFor(declaration: ts.TypeAliasDeclaration): ClassDetailsT {
  if (!ts.isFunctionTypeNode(declaration.type)) {
    return {
      declaration: 'TYPE_ALIAS',
      name: declaration.name.text,
      state: ts.isUnionTypeNode(declaration.type) ? 'union' : 'alias',
      aliasType: compositeType(declaration.type),
      methods: [],
      relations: [],
    };
  }
  const args: FieldTypeT[] = declaration.type.parameters.flatMap((parameter: ts.ParameterDeclaration) => {
    const name: string | undefined = memberName(parameter);
    return name ? [{ arg: name, t: compositeType(parameter.type) }] : [];
  });
  return {
    declaration: 'TYPE_ALIAS',
    name: declaration.name.text,
    state: 'delegate',
    methods: [{
      name: '',
      overloads: [[{ arg: '+RET', t: compositeType(declaration.type.type) }, ...args]],
    }],
    relations: [],
  };
}

function scanClasses(rootPaths: readonly string[]): readonly ClassDetailsT[] {
  const discovered: readonly string[] = rootPaths.flatMap(findFiles);
  const knownFiles: ReadonlySet<string> = new Set(discovered);
  const files: readonly string[] = discovered.filter((filePath: string) => isClassSource(filePath, knownFiles));
  console.log(`Preparing class scan from ${files.length} source files.`);
  const program: ts.Program = ts.createProgram(files, {
    allowJs: true,
    noEmit: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
  });
  console.log('TypeScript program ready; checking declarations and exception usage.');
  const checker: ts.TypeChecker = program.getTypeChecker();
  const exceptionDeclarations: Set<ts.Declaration> = new Set<ts.Declaration>();
  function extendsError(type: ts.Type, visited: Set<ts.Type>): boolean {
    if (visited.has(type)) return false;
    visited.add(type);
    const symbol: ts.Symbol | undefined = type.getSymbol();
    if (symbol?.name === 'Error' && symbol.getDeclarations()?.some((declaration: ts.Declaration) => program.isSourceFileDefaultLibrary(declaration.getSourceFile()))) return true;
    if (!(type.flags & ts.TypeFlags.Object)) return false;
    const objectType: ts.ObjectType = type as ts.ObjectType;
    if (!(objectType.objectFlags & ts.ObjectFlags.ClassOrInterface)) return false;
    return checker.getBaseTypes(type as ts.InterfaceType).some((base: ts.BaseType) => extendsError(base, visited));
  }
  function markException(expression: ts.Expression): void {
    const type: ts.Type = checker.getTypeAtLocation(expression);
    const types: readonly ts.Type[] = type.isUnion() ? type.types : [type];
    types.forEach((item: ts.Type) => item.getSymbol()?.getDeclarations()?.forEach((declaration: ts.Declaration) => exceptionDeclarations.add(declaration)));
  }
  function visit(node: ts.Node): void {
    if (ts.isThrowStatement(node) && node.expression) markException(node.expression);
    if (ts.isCallExpression(node) && ((ts.isIdentifier(node.expression) && node.expression.text === 'logAndThrow') || (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'logAndThrow'))) {
      const argument: ts.Expression | undefined = node.arguments.at(0);
      if (argument) markException(argument);
    }
    ts.forEachChild(node, visit);
  }
  files.forEach((filePath: string) => {
    const source: ts.SourceFile | undefined = program.getSourceFile(filePath);
    if (source) visit(source);
  });
  const details: ClassDetailsT[] = [];
  files.forEach((filePath: string) => {
    const sourceFile: ts.SourceFile | undefined = program.getSourceFile(filePath);
    if (!sourceFile) return;
    sourceFile.forEachChild((node: ts.Node) => {
      if (!ts.isClassDeclaration(node) && !ts.isInterfaceDeclaration(node) && !ts.isTypeAliasDeclaration(node)) return;
      const detail: ClassDetailsT | undefined = ts.isTypeAliasDeclaration(node) ? typeAliasDetailsFor(node) : classDetailsFor(node);
      if (detail) {
        if (exceptionDeclarations.has(node) || ts.isClassDeclaration(node) && extendsError(checker.getTypeAtLocation(node), new Set<ts.Type>())) detail.usage = 'ex';
        const root: string = rootPaths.find((candidate: string) => !path.relative(candidate, filePath).startsWith('..')) ?? rootPaths[0]!;
        detail.sourceFile = path.relative(root, filePath).split(path.sep).join('/');
        detail.modifiedAt = fs.statSync(filePath).mtime.toISOString();
        details.push(detail);
      }
    });
  });
  const declarationsByName: Map<string, ClassDetailsT[]> = new Map<string, ClassDetailsT[]>();
  details.forEach((detail: ClassDetailsT) => {
    const declarations: ClassDetailsT[] = declarationsByName.get(detail.name) ?? [];
    declarations.push(detail);
    declarationsByName.set(detail.name, declarations);
  });
  declarationsByName.forEach((declarations: ClassDetailsT[], name: string) => {
    if (declarations.length > 1) {
      const files: string[] = [...new Set(declarations
        .map((declaration: ClassDetailsT) => declaration.sourceFile)
        .filter((sourceFile: string | undefined): sourceFile is string => sourceFile !== undefined))];
      logAndThrow(new Error(`Class scan found duplicate declaration ${name} in files: ${files.join(', ')}.`));
    }
  });
  if (details.length === 0) {
    logAndThrow(new Error(`Class scan found no class or interface declarations in the scanned source files under: ${rootPaths.join(', ')}. Verify the scan folders and source filters.`));
  }
  return details.sort((left: ClassDetailsT, right: ClassDetailsT) => left.name.localeCompare(right.name));
}

function isClassSource(filePath: string, knownFiles: ReadonlySet<string>): boolean {
  const pathSegments: string[] = filePath.split(/[\\/]/u);
  if (!pathSegments.includes('src') || pathSegments.some((segment: string) => /^(?:test|tests|__tests__)$/iu.test(segment))) return false;
  if (!SOURCE_FILE_PATTERN.test(filePath) || /\.d\.[cm]?ts$/u.test(filePath)) return false;
  if (/\.js$/u.test(filePath) && knownFiles.has(filePath.replace(/\.js$/u, '.ts'))) return false;
  if (/\.jsx$/u.test(filePath) && knownFiles.has(filePath.replace(/\.jsx$/u, '.tsx'))) return false;
  if (/\.mjs$/u.test(filePath) && knownFiles.has(filePath.replace(/\.mjs$/u, '.mts'))) return false;
  if (/\.cjs$/u.test(filePath) && knownFiles.has(filePath.replace(/\.cjs$/u, '.cts'))) return false;
  return true;
}

async function uploadTests(projectName: string, cases: readonly TestCaseT[], serverUrl: string): Promise<void> {
  log('INFO', `Uploading ${cases.length} test cases`);
  const payload: string = JSON.stringify(cases);
  const response: Response = await loggedFetch(new URL(`/api/${projectName}/updateTests`, serverUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload }, payload);
  if (!response.ok) logAndThrow(new Error(`Test upload failed with HTTP ${String(response.status)}.`));
  log('INFO', `Test upload completed with HTTP ${String(response.status)}`);
}

function sourceFilesFor(rootPaths: readonly string[]): ReadonlySet<string> {
  const discovered: readonly string[] = rootPaths.flatMap(findFiles);
  const knownFiles: ReadonlySet<string> = new Set(discovered);
  const sourceFiles: Set<string> = new Set<string>();
  discovered.filter((filePath: string) => isClassSource(filePath, knownFiles)).forEach((filePath: string) => {
    const root: string = rootPaths.find((candidate: string) => !path.relative(candidate, filePath).startsWith('..')) ?? rootPaths[0]!;
    sourceFiles.add(path.relative(root, filePath).split(path.sep).join('/'));
  });
  return sourceFiles;
}

type UploadClassT = Omit<ClassDetailsT, 'declaration'>;
type UploadMemberT = {
  name: string;
  overloads: { args: ArgsListT }[];
};

async function deletedClassesForRemovedDeclarations(projectName: string, classes: readonly ClassDetailsT[], rootPaths: readonly string[], serverUrl: string): Promise<UploadClassT[]> {
  const response: Response = await loggedFetch(new URL(`/api/${projectName}/getClasses`, serverUrl));
  if (!response.ok) logAndThrow(new Error(`Class inventory lookup failed with HTTP ${String(response.status)}.`));
  const inventory: { classes: StoredClassT[] } = await response.json() as { classes: StoredClassT[] };
  const currentSourceFiles: ReadonlySet<string> = sourceFilesFor(rootPaths);
  const declarationsBySourceFile: Map<string, ReadonlySet<string>> = new Map<string, ReadonlySet<string>>();
  classes.forEach((item: ClassDetailsT) => {
    if (!item.sourceFile) return;
    const names: Set<string> = new Set<string>(declarationsBySourceFile.get(item.sourceFile) ?? []);
    names.add(item.name);
    declarationsBySourceFile.set(item.sourceFile, names);
  });
  return inventory.classes
    .filter((item: StoredClassT) => {
      if (typeof item.sourceFile !== 'string' || item.state === 'deleted') return false;
      const currentDeclarations: ReadonlySet<string> | undefined = declarationsBySourceFile.get(item.sourceFile);
      return !currentSourceFiles.has(item.sourceFile) || !currentDeclarations?.has(item.name);
    })
    .map((item: StoredClassT) => ({
      name: item.name,
      methods: [],
      relations: [],
      state: 'deleted'
    }));
}

async function uploadClasses(projectName: string, classes: readonly ClassDetailsT[], rootPaths: readonly string[], serverUrl: string, slowtrace: boolean): Promise<void> {
  const deleted: UploadClassT[] = await deletedClassesForRemovedDeclarations(projectName, classes, rootPaths, serverUrl);
  const updates: readonly UploadClassT[] = [...classes, ...deleted];
  log('INFO', `Uploading ${updates.length} class declarations (${deleted.length} deleted from removed source files)`);
  if (updates.length === 0) {
    log('INFO', 'No class declarations to upload');
    return;
  }
  const origin = {
    kind: 'scan',
    name: os.userInfo().username,
    version: new Date().toISOString(),
  };
  const uploadClass: (detail: UploadClassT) => Record<string, unknown> = (detail: UploadClassT) => ({
    name: detail.name,
    usage: detail.usage,
    sourceFile: detail.sourceFile,
    modifiedAt: detail.modifiedAt,
    methods: detail.methods.map((member: ClassMemberT) => {
      const result: UploadMemberT = {
        name: member.name,
        overloads: member.overloads.map((args) => ({ args })),
      };
      return result;
    }),
    relations: detail.relations,
    state: detail.state,
    aliasType: detail.aliasType,
  });
  const endpoint: URL = new URL(`/api/${projectName}/updateClasses`, serverUrl);
  const upload = async (batch: readonly UploadClassT[]): Promise<void> => {
    const payload: string = JSON.stringify({
    origin: {
      ...origin,
    },
      classes: batch.map(uploadClass),
    });
    const response: Response = await loggedFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload }, payload);
    const responseBody: string = await response.text();
    if (!response.ok) {
      if (slowtrace) {
        const diagnostic = JSON.stringify({
          projectName,
          endpoint: endpoint.toString(),
          class: batch[0],
          uploadedClass: batch.length === 1 ? uploadClass(batch[0]!) : undefined,
          requestPayload: JSON.parse(payload) as unknown,
          responseStatus: response.status,
          responseBody,
        }, null, 2);
        console.error(`SLOWTRACE class upload failure:\n${diagnostic}`);
        log('ERROR', `SLOWTRACE class upload failure:\n${diagnostic}`);
      }
      logAndThrow(new Error(`Class upload failed with HTTP ${String(response.status)}. Server response: ${responseBody || '[empty response body]'}`));
    }
    log('INFO', `Class upload completed with HTTP ${String(response.status)}`);
  };
  if (slowtrace) {
    log('INFO', 'Slowtrace enabled: uploading one class declaration per request');
    for (const item of updates) await upload([item]);
    return;
  }
  await upload(updates);
}

function printClassDetails(detail: ClassDetailsT): void {
  console.log(`${detail.declaration} ${detail.name}`);
  if (detail.state) console.log(`  STATE ${detail.state}`);
  detail.methods.forEach((member: ClassMemberT) => {
    member.overloads.forEach((args: FieldTypeT[]) => {
      const marker: FieldTypeT | undefined = args.at(0);
      if (marker?.arg === '+RO' || marker?.arg === '+RW') {
        console.log(`  FIELD ${member.name} ${marker.arg}: ${typeToText(marker.t)}`);
      } else if (marker?.arg === '+GET' || marker?.arg === '+SET' || marker?.arg === '+PROP') {
        console.log(`  ACCESSOR ${member.name} ${marker.arg}: ${typeToText(marker.t)}`);
      } else {
        const returnType: FieldTypeT | undefined = marker?.arg === '+RET' ? marker : undefined;
        const parameters: FieldTypeT[] = returnType ? args.slice(1) : args;
        const label: string = detail.state === 'delegate' ? 'DELEGATE' : member.name ? 'METHOD' : 'CALLABLE';
        const signature: string = `  ${label} ${member.name}(${parameters.map((field: FieldTypeT) => `${field.arg}: ${typeToText(field.t)}`).join(', ')})`;
        console.log(returnType ? `${signature} => ${typeToText(returnType.t)}` : signature);
      }
    });
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
    if (argumentsValue.serverUrl) await uploadTests(argumentsValue.projectName, result.cases, argumentsValue.serverUrl);
  }
  if (argumentsValue.fileTypes.includes(FileType.Class)) {
    const classes: readonly ClassDetailsT[] = scanClasses(argumentsValue.rootPaths);
    log('INFO', `Class scan completed: ${classes.length} declarations`);
    classes.forEach(printClassDetails);
    if (argumentsValue.serverUrl) await uploadClasses(argumentsValue.projectName, classes, argumentsValue.rootPaths, argumentsValue.serverUrl, argumentsValue.slowtrace);
  }
}

const argumentsList: readonly string[] = process.argv.slice(2);
const logOptionIndex: number = argumentsList.indexOf('--logfile');
const logFileArgument: string = argumentsList[logOptionIndex + 1] ?? '';
const requestedLogFile: string = logOptionIndex < 0 || !logFileArgument || logFileArgument.startsWith('--') ? 'scanner.log' : logFileArgument;
try {
  initializeLog(requestedLogFile);
} catch (error: unknown) {
  console.error(formatFailure('Could not initialize scanner log:', error));
  process.exitCode = 2;
}

if (process.exitCode !== 2) void run().catch((error: unknown) => {
  console.error(formatFailure('Scanner failed:', error));
  const failure: string = formatFailure('Scanner failed:', error);
  try {
    log('WARN', failure);
    log('ERROR', failure);
  } catch (loggingError: unknown) {
    console.error(formatFailure('Could not write scanner log:', loggingError));
  }
  process.exitCode = 2;
});
