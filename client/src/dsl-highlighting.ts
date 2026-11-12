import { EditorState, RangeSetBuilder, StateField, type Transaction } from '@codemirror/state';
import { Decoration, EditorView, hoverTooltip, type DecorationSet, type Tooltip } from '@codemirror/view';
import { parseDiagram } from './model';

const CLASS_NAME: Decoration = Decoration.mark({ class: 'dsl-class-name' });
const METHOD_NAME: Decoration = Decoration.mark({ class: 'dsl-method-name' });
const OWNERSHIP: Decoration = Decoration.mark({ class: 'dsl-ownership' });
const PARAMETER: Decoration = Decoration.mark({ class: 'dsl-parameter' });
const TYPE: Decoration = Decoration.mark({ class: 'dsl-type' });
const KEYWORD: Decoration = Decoration.mark({ class: 'dsl-type-keyword' });
const PUNCTUATION: Decoration = Decoration.mark({ class: 'dsl-punctuation' });
const RELATION_KEYWORDS: ReadonlySet<string> = new Set<string>(['OWNS', 'REF', 'UNK']);
function error(message: string): Decoration { return Decoration.mark({ class: 'dsl-error', attributes: { title: message } }); }
const MISSING_CLASS: Decoration = Decoration.line({ attributes: { class: 'dsl-missing-class' } });
const BUILTIN_TYPES: ReadonlySet<string> = new Set(['string', 'number', 'boolean', 'integer', 'void', 'unknown', 'any']);

/** Highlight the current text, including incomplete signatures during editing. */
function decorations(state: EditorState): DecorationSet {
  const builder: RangeSetBuilder<Decoration> = new RangeSetBuilder<Decoration>();
  let hasHeading: boolean = false;
  let blankBefore: boolean = false;
  let parentheses: number = 0;
  let typeContext: boolean = false;
  let genericDepth: number = 0;
  for (let lineNumber: number = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line: ReturnType<EditorState['doc']['line']> = state.doc.line(lineNumber);
    const text: string = line.text;
    if (!text.trim()) { blankBefore = true; continue; }
    const nextClass: boolean = hasHeading && blankBefore && parentheses === 0 && /^[A-Za-z_][A-Za-z0-9_]*\s*$/.test(text) && !/^\s/.test(text);
    blankBefore = false;
    if (!hasHeading || nextClass) {
      const heading: RegExpMatchArray | string[] = text.match(/\S(?:.*\S)?/) ?? [];
      const value: string = heading.at(0) ?? '';
      const start: number = text.indexOf(value);
      if (value) builder.add(line.from + start, line.from + start + value.length, CLASS_NAME);
      hasHeading = true;
      continue;
    }
    const isRelationship: boolean = /^\s*(?:OWNS|REF|UNK)\b/.test(text);
    const startsMethod: boolean = parentheses === 0 && /^ {2}\S/.test(text) && !isRelationship;
    const tokens: RegExpMatchArray[] = Array.from(text.matchAll(/[A-Za-z_][A-Za-z0-9_]*|[()[\]<>:,]/g));
    tokens.forEach((token: RegExpMatchArray, index: number) => {
      const value: string = token.at(0) ?? '';
      const position: number = token.index ?? 0;
      let mark: Decoration = PUNCTUATION;
      if (/^[A-Za-z_]/.test(value)) {
        if (isRelationship && index === 0 && RELATION_KEYWORDS.has(value)) mark = OWNERSHIP;
        else if (startsMethod && index === 0) mark = METHOD_NAME;
        else if (BUILTIN_TYPES.has(value)) mark = KEYWORD;
        else if (typeContext) mark = TYPE;
        else mark = PARAMETER;
      }
      builder.add(line.from + position, line.from + position + value.length, mark);
      if (value === ':') typeContext = true;
      else if (value === '<') genericDepth++;
      else if (value === '>') genericDepth = Math.max(0, genericDepth - 1);
      else if (value === ',' && genericDepth === 0) typeContext = false;
      if (!isRelationship && value === '(') parentheses++;
      else if (!isRelationship && value === ')') parentheses = Math.max(0, parentheses - 1);
    });
    if (isRelationship || parentheses === 0) { typeContext = false; genericDepth = 0; }
  }
  return builder.finish();
}

export const dslHighlighting: StateField<DecorationSet> = StateField.define<DecorationSet>({
  create: (state: EditorState) => decorations(state),
  update: (previous: DecorationSet, transaction: Transaction) => transaction.docChanged ? decorations(transaction.state) : previous,
  provide: (field: StateField<DecorationSet>) => EditorView.decorations.from(field)
});

function errors(state: EditorState, hiddenNames: readonly string[]): DecorationSet {
  const builder: RangeSetBuilder<Decoration> = new RangeSetBuilder<Decoration>();
  let headingLine: number = 1;
  while (headingLine <= state.doc.lines && !state.doc.line(headingLine).text.trim()) headingLine++;
  const heading: string = headingLine <= state.doc.lines ? state.doc.line(headingLine).text.trim() : '';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(heading)) {
    const first: ReturnType<EditorState['doc']['line']> = state.doc.line(1);
    if (!first.text.trim()) builder.add(first.from, first.from, MISSING_CLASS);
    else builder.add(first.from, first.to, error('Start with a class name.'));
    return builder.finish();
  }
  let hasHeading: boolean = false;
  let blank: boolean = false;
  const names: Set<string> = new Set<string>();
  for (let lineNumber: number = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line: ReturnType<EditorState['doc']['line']> = state.doc.line(lineNumber);
    const text: string = line.text.trim();
    if (!text) { blank = true; continue; }
    if (!hasHeading) {
      if (hiddenNames.includes(text)) { const start: number = line.text.indexOf(text); builder.add(line.from + start, line.from + start + text.length, error(`Class ${text} already exists. Type @ to edit it.`)); }
      hasHeading = true; names.add(text); blank = false; continue;
    }
    if (!/^\s/.test(line.text) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(text) && !RELATION_KEYWORDS.has(text)) {
      const message: string = names.has(text) ? `Duplicate class name: ${text}.` : hiddenNames.includes(text) ? `Class ${text} already exists. Type @ to edit it.` : 'Separate classes with a blank line.';
      if (!blank || names.has(text) || hiddenNames.includes(text)) builder.add(line.from, line.to, error(message));
      names.add(text); blank = false; continue;
    }
    blank = false;
    const malformed: boolean = !/^\s/.test(line.text) && !/^(?:OWNS|REF|UNK)\b/.test(text) && /^[A-Za-z_][A-Za-z0-9_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)?\s*:/.test(text);
    const missingType: boolean = /^(?:OWNS|REF|UNK)\s+[A-Za-z_][A-Za-z0-9_]*\s*:\s*$/.test(text);
    if (malformed || missingType) {
      const start: number = line.text.indexOf(text);
      builder.add(line.from + start, line.from + start + text.length, error(missingType ? 'Enter the related class type.' : 'Expected OWNS, REF, or UNK before the relationship declaration.'));
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(text)) {
      const parts: string[] = [line.text];
      let depth: number = (text.match(/\(/g) ?? []).length - (text.match(/\)/g) ?? []).length;
      let lastLine: number = lineNumber;
      while (depth > 0 && lastLine < state.doc.lines) {
        const next: ReturnType<EditorState['doc']['line']> = state.doc.line(lastLine + 1);
        if (next.text.trim() && !/^ {4}/.test(next.text)) break;
        lastLine++;
        parts.push(next.text);
        depth += (next.text.match(/\(/g) ?? []).length - (next.text.match(/\)/g) ?? []).length;
      }
      const parsed: ReturnType<typeof parseDiagram> = parseDiagram(`Diagram\n${parts.join('\n')}`);
      if (!parsed.ok) {
        for (let invalidLine: number = lineNumber; invalidLine <= lastLine; invalidLine++) {
          const invalid: ReturnType<EditorState['doc']['line']> = state.doc.line(invalidLine);
          const value: string = invalid.text.trim();
          if (value) {
            const start: number = invalid.text.indexOf(value);
            builder.add(invalid.from + start, invalid.from + start + value.length, error(parsed.message));
          }
        }
      }
      lineNumber = lastLine;
    } else if (!malformed && !missingType) {
      const parsed: ReturnType<typeof parseDiagram> = parseDiagram(`Diagram\n${line.text}`);
      if (!parsed.ok) {
        const start: number = line.text.indexOf(text);
        builder.add(line.from + start, line.from + start + text.length, error(parsed.message));
      }
    }
  }
  return builder.finish();
}

export function dslErrorsFor(hiddenNames: (text: string) => readonly string[]): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create: (state: EditorState) => errors(state, hiddenNames(state.doc.toString())),
    update: (previous: DecorationSet, transaction: Transaction) => transaction.docChanged ? errors(transaction.state, hiddenNames(transaction.state.doc.toString())) : previous,
    provide: (field: StateField<DecorationSet>) => EditorView.decorations.from(field)
  });
}

export const dslErrorTooltip: ReturnType<typeof hoverTooltip> = hoverTooltip((view: EditorView, position: number) => {
  const line: ReturnType<EditorState['doc']['lineAt']> = view.state.doc.lineAt(position);
  const location: { node: Node; offset: number } = view.domAtPos(position);
  // UNTRUST-ALLOW-NULLISH: Browser DOM nodes may be detached and parentElement returns null; convert that boundary to an absent value before checking for a diagnostic.
  const parent: Element | undefined = location.node instanceof Element ? location.node : location.node.parentElement ?? undefined;
  // UNTRUST-ALLOW-NULLISH: Element.closest returns null when there is no matching diagnostic; convert it to an absent value and show no tooltip in that case.
  const diagnostic: Element | undefined = parent?.closest('.dsl-error') ?? undefined;
  const message: string = diagnostic?.getAttribute('title') ?? '';
  if (!message) return [];
  return {
    pos: line.from,
    end: line.to,
    above: true,
    create: () => { const dom: HTMLElement = document.createElement('div'); dom.className = 'dsl-diagnostic-tooltip'; dom.textContent = message; return { dom }; } };
});
