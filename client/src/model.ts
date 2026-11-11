import { formatMember } from './signatures';

export const INITIAL_TEXT: string = `ClassDiagram
  addClass(name: string, publicMethods: string[])
  addPartialClass(name: string)
  connectClasses(from: string, to: string, connectionType: ConnectionType, arity: integer)
  recalcLayout()
OWNS classes: Class[]`;

export interface Relation {
  name: string;
  target: string;
  multiplicity: 'one' | 'many';
}
export interface Diagram {
  title: string;
  members: string[];
  targets: Relation[];
  classes?: Diagram[];
}
export type ParseResultT = { ok: true; diagram: Diagram } | {
  ok: false;
  message: string;
  diagram?: Diagram;
  partialRetention?: 'retain' | 'discard' };

/** A deliberately small first grammar for class members and ownership relationships. */
export function parseDiagram(text: string): ParseResultT {
  const lines: string[] = text.split(/\r?\n/);
  const blocks: string[][] = [[]];
  let hasContent: boolean = false;
  let blank: boolean = false;
  let depth: number = 0;
  for (let index: number = 0; index < lines.length; index++) {
    const line: string = lines.at(index) ?? '';
    const trimmed: string = line.trim();
    if (!trimmed) { if (hasContent && depth === 0) blank = true; (blocks.at(-1) ?? []).push(line); continue; }
    if (hasContent && depth === 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed) && !/^\s/.test(line)) {
      if (!blank) return {
        ok: false,
        message: 'Separate classes with a blank line.' };
      blocks.push([]);
    }
    (blocks.at(-1) ?? []).push(line);
    hasContent = true;
    blank = false;
    depth = Math.max(0, depth + (trimmed.match(/\(/g) ?? []).length - (trimmed.match(/\)/g) ?? []).length);
  }
  const classes: Diagram[] = [];
  let failure: ParseResultT | undefined;
  for (let index: number = 0; index < blocks.length; index++) {
    const block: string[] = blocks.at(index) ?? [];
    const parsed: ParseResultT = parseClass(block.join('\n'));
    if (!parsed.ok && !parsed.diagram) return parsed;
    if (!parsed.ok) failure = parsed;
    const diagram: Diagram | undefined = parsed.diagram;
    if (!diagram) return { ok: false, message: 'Start with a class name.' };
    if (classes.some((item: Diagram): boolean => item.title === diagram.title)) return {
      ok: false,
      message: `Duplicate class name: ${diagram.title}.` };
    classes.push(diagram);
  }
  const first: Diagram | undefined = classes.at(0);
  if (!first) return { ok: false, message: 'Start with a class name.' };
  const diagram: Diagram = classes.length > 1 ? {
    title: first.title,
    members: first.members,
    targets: first.targets,
    classes: classes.slice(1) } : first;
  return failure && !failure.ok ? {
    ok: false,
    message: failure.message,
    diagram,
    partialRetention: failure.partialRetention ?? 'discard' } : { ok: true, diagram };
}

function parseClass(text: string): ParseResultT {
  const lines: string[] = text.split(/\r?\n/).filter((line: string): boolean => line.trim().length > 0);
  const title: string = (lines.at(0) ?? '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(title)) return { ok: false, message: 'Start with a class name.' };
  const members: string[] = [];
  const targets: Relation[] = [];
  let ownershipError: string = '';
  let partialRetention: 'retain' | 'discard' = 'discard';
  for (let index: number = 1; index < lines.length; index++) {
    const rawLine: string = lines.at(index) ?? '';
    const line: string = rawLine.trim();
    if (/^OWNS\b/.test(line)) {
      const named: RegExpMatchArray | string[] = line.match(/^OWNS\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)?\s*(\[\s*\])?\s*$/) ?? [];
      const unnamed: RegExpMatchArray | string[] = line.match(/^OWNS\s+([A-Za-z_][A-Za-z0-9_]*)\s*(\[\s*\])?\s*$/) ?? [];
      if (named[1]) {
        const target: string = named[2] ?? '';
        if (!target) ownershipError = 'Enter the owned class type.';
        targets.push({
          name: named[1],
          target: target || '?',
          multiplicity: named[3] ? 'many' : 'one' });
      } else if (unnamed[1]) targets.push({
        name: '',
        target: unnamed[1],
        multiplicity: unnamed[2] ? 'many' : 'one' });
      else return {
        ok: false,
        message: 'Expected OWNS name: Type or OWNS Type.' };
    } else if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(line)) {
      if (!/^ {2}[^\s]/.test(rawLine)) return { ok: false, message: 'Indent methods exactly two spaces.' };
      let method: string = line;
      let depth: number = (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
      while (depth > 0 && index + 1 < lines.length) {
        index++;
        const continuation: string = lines.at(index) ?? '';
        if (!/^ {4}/.test(continuation)) return {
          ok: false,
          message: 'Indent method continuation lines at least four spaces.' };
        const part: string = continuation.trim();
        method += ` ${part}`;
        depth += (part.match(/\(/g) ?? []).length - (part.match(/\)/g) ?? []).length;
      }
      if (depth !== 0) return { ok: false, message: 'Complete the method signature.' };
      if (!('parameters' in formatMember(method))) return {
        ok: false,
        message: 'Expected method parameters as name: type.' };
      members.push(method);
    } else if (/^ {2}\S/.test(rawLine) && /^[A-Za-z_][A-Za-z0-9_]*\s*:\s*\S/.test(line)) {
      members.push(line);
    } else if (/^[A-Za-z_][A-Za-z0-9_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)?\s*:/.test(line) && !/^\s/.test(rawLine)) {
      ownershipError = 'Expected OWNS before the ownership declaration.';
      partialRetention = 'retain';
    } else return {
      ok: false,
      message: 'Expected an indented method or an OWNS relationship.' };
  }
  if (ownershipError) return {
    ok: false,
    message: ownershipError,
    diagram: { title, members, targets },
    partialRetention };
  return { ok: true, diagram: { title, members, targets } };
}
