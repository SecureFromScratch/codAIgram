/// <reference types="vite/client" />
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorState, Transaction } from '@codemirror/state';
import { history, historyKeymap } from '@codemirror/commands';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { dia, shapes } from '@joint/core';
import type { Result } from 'neverthrow';
import type { CompositeTypeT } from '@codaigram/shared/class-types';
import { parseDiagram, type Diagram, type ParseResultT, type Relation } from './model';
import { classDetailsToDiagram, classDetailsToDiagramSet, loadClassDetails, type ClassDetails } from './class-details';
import { formatMember, type MemberDisplay, type Parameter } from './signatures';
import { dslErrorsFor, dslErrorTooltip, dslHighlighting } from './dsl-highlighting';
import { scheduleClick } from './click-timer';
import { logAndThrow } from './client_utils';
import { readAppStorageValue, writeAppStorageValue } from './app-storage';
import type { AppStorageKeyT, AppStorageReadT } from './app-storage';
import { loadTestsInventory, type TestCaseDetails } from './tests-inventory';
import { createProject as createProjectRequest, DEFAULT_PROJECT_NAME, loadProjectNames, NEW_PROJECT_OPTION } from './projects';
import { ClassWorkspaceModel, Model } from './workspace-model';
import { bridgeConnectionFailureMessage, clearPersistedVscodeBridgeSession, connectToVscodeBridge, loadPersistedVscodeBridgeSession, savePersistedVscodeBridgeSession, workspaceFolderDisplayPath, type PersistedVscodeBridgeSessionT, type VscodeBridgeConnectionT, type VscodeWorkspaceFolderT } from './vscode-bridge';
import { buildChatPromptOptions } from './chat-workspace';
import type { GetCodeResult } from '@codaigram/bridge-protocol/client';
import './style.css';

window.logAndThrow = logAndThrow;

type ClassContextMenuT = { status: 'closed' } | { status: 'open'; className: string; x: number; y: number; memberTooltip?: string; showActualCode?: boolean };
type ChatPanelStateT = 'open' | 'closed';
type RelatedPromptContextT = { readonly relatedFile: string; readonly relatedClass: string; readonly relatedMember: string };
const EMPTY_RELATED_PROMPT_CONTEXT: RelatedPromptContextT = { relatedFile: '', relatedClass: '', relatedMember: '' };
type NewProjectDialogStatusT = 'open' | 'closed';
type ProjectSettingsDialogStatusT = 'open' | 'closed';
type BridgeConnectionStatusT = 'connected' | 'disconnected';
type BridgeRequestStatusT = 'idle' | 'connecting';
type ChatMessageT = {
  readonly role: 'user' | 'assistant';
  readonly text: string;
};

function loadEditorPercent(): number {
  try {
    const key: AppStorageKeyT = 'editorPercent';
    const stored: AppStorageReadT = readAppStorageValue(key);
    if (stored.state === 'missing') return 42;
    const parsed: number = Number(stored.value);
    return Number.isFinite(parsed) && parsed >= 20 && parsed <= 80 ? parsed : 42;
  } catch (error: unknown) {
    console.warn('Could not read the saved workspace split.', error);
    return 42;
  }
}

function saveEditorPercent(value: number): void {
  try {
    const key: AppStorageKeyT = 'editorPercent';
    writeAppStorageValue(key, String(value));
  } catch (error: unknown) {
    console.warn('Could not save the workspace split.', error);
  }
}

function loadVscodeWorkspaceSelection(): readonly string[] {
  try {
    const key: AppStorageKeyT = 'vscodeBridgeWorkspaceUris';
    const stored: AppStorageReadT = readAppStorageValue(key);
    if (stored.state === 'missing') return [];
    const parsed: unknown = JSON.parse(stored.value) as unknown;
    return Array.isArray(parsed) && parsed.every((uri: unknown) => typeof uri === 'string') ? parsed : [];
  } catch (error: unknown) {
    console.warn('Could not read saved VS Code workspace selections.', error);
    return [];
  }
}

function saveVscodeWorkspaceSelection(uris: readonly string[]): void {
  try {
    const key: AppStorageKeyT = 'vscodeBridgeWorkspaceUris';
    writeAppStorageValue(key, JSON.stringify(uris));
  } catch (error: unknown) {
    console.warn('Could not save VS Code workspace selections.', error);
  }
}

function loadSavedProjectName(): string | undefined {
  const storedProject: AppStorageReadT = readAppStorageValue('selectedProject');
  if (storedProject.state !== 'present' || !/^[A-Za-z0-9_-]{1,100}$/u.test(storedProject.value)) return undefined;
  return storedProject.value;
}

function saveSelectedProjectName(projectName: string): void {
  try {
    writeAppStorageValue('selectedProject', projectName);
  } catch (error: unknown) {
    console.warn('Could not save the selected project.', error);
  }
}

function actualCodeIndentUnit(lines: readonly string[]): number {
  const openingBraceLine: number = lines.findIndex((line: string) => line.includes('{'));
  if (openingBraceLine < 0) return 3;
  const firstIndentedLine: string | undefined = lines.slice(openingBraceLine + 1).find((line: string) => line.trim().length > 0);
  if (firstIndentedLine === undefined) return 3;
  return /^[ ]*/u.exec(firstIndentedLine)?.[0].length || 3;
}

function actualCodeMarkup(source: string): React.ReactNode {
  const lines: readonly string[] = source.split(/\r?\n/u);
  const indentUnit: number = actualCodeIndentUnit(lines);
  return lines.map((line: string, index: number) => {
    const lineIndent: number = /^[ ]*/u.exec(line)?.[0].length ?? 0;
    const continuationIndent: number = lineIndent + indentUnit;
    return <Fragment key={index}>{index > 0 ? '\n' : ''}<span
      className="actual-code-line"
      style={{ paddingLeft: `${continuationIndent}ch`, textIndent: `-${continuationIndent}ch` }}
    >{line}</span></Fragment>;
  });
}

type WorkspaceSelectionModeT = 'none' | 'agent' | 'folder';

function workspaceSelectionMode(workspace: VscodeWorkspaceFolderT, selectedWorkspaceUris: readonly string[], selectedAgentUris: readonly string[]): WorkspaceSelectionModeT {
  if (selectedWorkspaceUris.includes(workspace.uri)) return 'folder';
  if (selectedAgentUris.includes(workspace.uri)) return 'agent';
  return 'none';
}

function workspaceSelectionIcon(mode: WorkspaceSelectionModeT): string {
  if (mode === 'agent') return '🤖';
  if (mode === 'folder') return '📁';
  return '☐';
}

function fitText(text: string, maxWidth: number, font: string): string {
  // UNTRUST-ALLOW-NULLISH: Browser canvas context creation may fail; the boundary is checked immediately and the display falls back to a safe ellipsis.
  const context: CanvasRenderingContext2D | null = document.createElement('canvas').getContext('2d');
  if (!context) return '…';
  context.font = font;
  if (context.measureText(text).width <= maxWidth) return text;
  const characters: string[] = Array.from(text);
  let prefix: string = '';
  for (let index: number = 0; index < characters.length; index++) {
    const candidate: string = prefix + (characters.at(index) ?? '');
    if (context.measureText(`${candidate}…`).width > maxWidth) break;
    prefix = candidate;
  }
  return `${prefix}…`;
}

function Editor({ initialText, onChange, onGoToClass, onAskAbout, selection, hiddenNames }: {
  initialText: string;
  onChange: (value: string) => void;
  onGoToClass: (className: string) => void;
  onAskAbout: (className: string, memberName: string) => void;
  selection: { revision: number; text: string };
  hiddenNames: (text: string) => readonly string[] }) {
  // UNTRUST-ALLOW-NULLISH: React initializes DOM refs as null before mounting and clears them on unmount; this boundary is checked before any DOM access.
  const host: React.RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  // UNTRUST-ALLOW-NULLISH: The editor view does not exist until React mounts it and is destroyed during cleanup; callers check this reference before use.
  const editor: React.RefObject<EditorView | null> = useRef<EditorView>(null);
  const selecting: React.RefObject<boolean> = useRef<boolean>(false);
  const [memberMenu, setMemberMenu]: [ClassContextMenuT, React.Dispatch<React.SetStateAction<ClassContextMenuT>>] = useState<ClassContextMenuT>({ status: 'closed' });
  useEffect(() => {
    if (!host.current) return;
    const view: EditorView = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialText,
        extensions: [lineNumbers(), history(), keymap.of([
          {
            key: 'Ctrl-g',
            run: (activeView: EditorView) => {
              const line: ReturnType<EditorState['doc']['lineAt']> = activeView.state.doc.lineAt(activeView.state.selection.main.head);
              const className: string = line.text.trim();
              if (/^\s/.test(line.text) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(className)) return false;
              onGoToClass(className);
              return true;
            },
          },
          ...historyKeymap,
        ]), dslHighlighting, dslErrorsFor(hiddenNames), dslErrorTooltip, EditorView.contentAttributes.of({ 'aria-label': 'Diagram text' }), EditorView.updateListener.of(update => { if (update.docChanged && !selecting.current) onChange(update.state.doc.toString()); })] }) });
    const onContextMenu = (event: MouseEvent): void => {
      const position: number | null = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (position === null) return;
      const line: string = view.state.doc.lineAt(position).text;
      if (!/^\s{2}\S/.test(line)) return;
      let className: string = '';
      const currentLineNumber: number = view.state.doc.lineAt(position).number;
      for (let lineNumber: number = currentLineNumber; lineNumber > 0; lineNumber--) {
        const candidate: string = view.state.doc.line(lineNumber).text;
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate.trim()) && !/^\s/.test(candidate)) {
          className = candidate.trim();
          break;
        }
      }
      if (!className) return;
      event.preventDefault();
      setMemberMenu({ status: 'open', className, x: event.clientX, y: event.clientY, memberTooltip: line.trim() });
    };
    view.dom.addEventListener('contextmenu', onContextMenu);
    editor.current = view;
    return () => {
      // UNTRUST-ALLOW-NULLISH: React editor refs use null as their unmounted state; clear the reference before destroying the view so later effects cannot use a stale instance.
      editor.current = null;
      view.dom.removeEventListener('contextmenu', onContextMenu);
      view.destroy();
    };
  }, [initialText, onChange, onAskAbout, hiddenNames]);
  useEffect(() => {
    if (!editor.current || selection.revision === 0) return;
    selecting.current = true;
    editor.current.dispatch({
      changes: {
        from: 0,
        to: editor.current.state.doc.length,
        insert: selection.text },
      annotations: Transaction.addToHistory.of(false) });
    selecting.current = false;
  }, [selection]);
  useEffect(() => {
    if (memberMenu.status !== 'open') return;
    const close = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && event.target instanceof Node && host.current?.contains(event.target)) return;
      setMemberMenu({ status: 'closed' });
    };
    window.addEventListener('keydown', close);
    window.addEventListener('click', close);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('click', close);
    };
  }, [memberMenu.status]);
  return <div className="editor" ref={host}>
    {memberMenu.status === 'open' ? <div className="class-context-menu" role="menu" aria-label="Text member actions" style={{ left: memberMenu.x, top: memberMenu.y }} onClick={(event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation()}>
      <button type="button" role="menuitem" onClick={() => { onAskAbout(memberMenu.className, memberMenu.memberTooltip?.split(/[(:]/)[0]?.trim() ?? ''); setMemberMenu({ status: 'closed' }); }}>Ask about...</button>
    </div> : ''}
  </div>;
}

type TooltipStateT = { visible: false } | {
  visible: true;
  index: number;
  left: number;
  top: number;
  anchorTop: number };

type ClassTooltipStateT = { visible: false } | {
  visible: true;
  name: string;
  sourceFile: string;
  modifiedAt: string;
  sourceCodeState: 'not-requested' | 'loading' | 'loaded' | 'unavailable';
  sourceCode: string;
  left: number;
  top: number;
};

function argumentColor(index: number): string { return `hsl(${(index * 137.508) % 360} 85% 78%)`; }

function compositeTypeText(type: CompositeTypeT): string {
  if (typeof type === 'string') return type;
  if (Array.isArray(type)) return type.map((value: string) => `'${value}'`).join(' | ');
  return `{ ${Array.from(type.entries(), ([name, value]: [string, CompositeTypeT]) => `${name}: ${compositeTypeText(value)}`).join(', ')} }`;
}

const GRAPH_TYPE_EXCLUSIONS: ReadonlySet<string> = new Set<string>([
  'string', 'number', 'boolean', 'bigint', 'symbol', 'undefined', 'null', 'void', 'never', 'unknown', 'any', 'object',
  'integer', 'positive', 'datetime', 'Array', 'ReadonlyArray', 'Promise', 'Map', 'ReadonlyMap', 'Set', 'ReadonlySet',
  'WeakMap', 'WeakSet', 'Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude', 'Extract',
  'NonNullable', 'ReturnType', 'Parameters', 'ConstructorParameters', 'InstanceType', 'ThisType', 'Awaited',
  'Date', 'RegExp', 'Error', 'Function', 'Object', 'String', 'Number', 'Boolean', 'keyof', 'typeof', 'infer',
  'extends', 'readonly', 'new', 'this', 'true', 'false',
]);

function graphTypeIdentifiers(type: CompositeTypeT): string[] {
  if (typeof type === 'string') return Array.from(type.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/gu), (match: RegExpMatchArray) => match[0]).filter((name: string) => !GRAPH_TYPE_EXCLUSIONS.has(name));
  if (Array.isArray(type)) return [];
  return Array.from(type.values()).flatMap(graphTypeIdentifiers);
}

function graphClassTargets(name: string, visited: ReadonlySet<string> = new Set<string>()): string[] {
  if (visited.has(name)) return [];
  const model: Result<ClassDetails, Error> = Model.current.tryGetModel(name);
  if (!model.isOk() || model.value.state === 'deleted') return model.isOk() ? [] : [name];
  if (model.value.state !== 'alias') return [name];
  if (model.value.aliasType === undefined) return [];
  const nextVisited: Set<string> = new Set<string>(visited);
  nextVisited.add(name);
  return graphTypeIdentifiers(model.value.aliasType).flatMap((target: string) => graphClassTargets(target, nextVisited));
}

function MethodTooltip({ member, left, top, anchorTop }: {
  member: MemberDisplay;
  left: number;
  top: number;
  anchorTop: number }) {
  const parameters: readonly Parameter[] = member.parameters ?? [];
  // UNTRUST-ALLOW-NULLISH: React DOM refs are null before mounting and after unmounting; the layout effect checks the ref before measuring the tooltip.
  const tooltipRef: React.RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!tooltipRef.current || !tooltipRef.current.parentElement) return;
    const element: HTMLDivElement = tooltipRef.current;
    if (!element.parentElement) return;
    const container: DOMRect = element.parentElement.getBoundingClientRect();
    const bounds: DOMRect = element.getBoundingClientRect();
    const minTop: number = Math.max(8, 8 - container.top);
    const maxBottom: number = Math.min(container.height - 8, window.innerHeight - container.top - 8);
    const minLeft: number = Math.max(8, 8 - container.left);
    const maxRight: number = Math.min(container.width - 8, window.innerWidth - container.left - 8);
    const desiredTop: number = top + bounds.height <= maxBottom ? top : anchorTop - bounds.height - 6;
    element.style.top = `${Math.max(minTop, Math.min(desiredTop, maxBottom - bounds.height))}px`;
    element.style.left = `${Math.max(minLeft, Math.min(left, maxRight - bounds.width))}px`;
  }, [member, left, top, anchorTop]);
  return <div id="method-tooltip" ref={tooltipRef} role="tooltip" className="method-tooltip" style={{ left, top }}>
    {member.parameters ? <><div className="tooltip-signature"><strong>{member.text.replace(/\(\)$/u, '')}</strong><span className="tooltip-paren">(</span>{parameters.map((parameter: Parameter, index: number) => <span key={`${index}-${parameter.name}`}><span className={`argument-color-${index}`} style={{ color: argumentColor(index) }}>{parameter.name}</span>{index + 1 < parameters.length ? <span className="tooltip-punctuation">, </span> : ''}</span>)}<span className="tooltip-paren">)</span></div>{parameters.length > 0 ? <div className="tooltip-parameters">{parameters.map((parameter: Parameter, index: number) => <Fragment key={`${index}-${parameter.name}`}><div className="tooltip-parameter"><span className="tooltip-dash">-</span><span className={`argument-color-${index}`} style={{ color: argumentColor(index) }}>{parameter.name}</span><span className="tooltip-punctuation">: </span><span className="tooltip-type">{parameter.type}</span></div>{parameter.aliasExpansion ? <div className="tooltip-parameter-expansion">{parameter.aliasExpansion.trimStart()}</div> : ''}</Fragment>)}</div> : ''}</> : <div className="tooltip-signature">{member.tooltip}</div>}
  </div>;
}

function Canvas({ diagram, partialRetention, visible, focusRequest, onSelect, onEditChain, onAskAbout, onGetActualCode }: {
  diagram: Diagram;
  partialRetention: 'retain' | 'discard';
  visible: readonly string[];
  focusRequest: { className: string; revision: number };
  onSelect: (name: string, exclusive: boolean) => void;
  onEditChain: (name: string) => void;
  onAskAbout: (className: string, memberName: string) => void;
  onGetActualCode: (className: string, sourceFile: string) => Promise<string> }) {
  const [tooltip, setTooltip]: [TooltipStateT, React.Dispatch<React.SetStateAction<TooltipStateT>>] = useState<TooltipStateT>({ visible: false });
  const [classTooltip, setClassTooltip]: [ClassTooltipStateT, React.Dispatch<React.SetStateAction<ClassTooltipStateT>>] = useState<ClassTooltipStateT>({ visible: false });
  const [contextMenu, setContextMenu]: [ClassContextMenuT, React.Dispatch<React.SetStateAction<ClassContextMenuT>>] = useState<ClassContextMenuT>({ status: 'closed' });
  const [showActualCode, setShowActualCode]: [boolean, React.Dispatch<React.SetStateAction<boolean>>] = useState<boolean>(false);
  const [actualCodeCache, setActualCodeCache]: [ReadonlyMap<string, string>, React.Dispatch<React.SetStateAction<ReadonlyMap<string, string>>>] = useState<ReadonlyMap<string, string>>(new Map<string, string>());
  const actualCodeRequests: React.RefObject<Set<string>> = useRef<Set<string>>(new Set<string>());
  // UNTRUST-ALLOW-NULLISH: React initializes DOM refs as null before mounting and clears them on unmount; this boundary is checked before any DOM access.
  const host: React.RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  const graphScroll: React.RefObject<{ left: number; top: number }> = useRef({ left: 0, top: 0 });
  const lastFocusedRevision: React.RefObject<number> = useRef<number>(0);
  useLayoutEffect(() => {
    if (!host.current) return;
    const canvasHost: HTMLDivElement = host.current;
    const graph: dia.Graph = new dia.Graph({}, { cellNamespace: shapes });
    const surface: HTMLDivElement = document.createElement('div');
    canvasHost.appendChild(surface);
    const paper: dia.Paper = new dia.Paper({
      el: surface,
      model: graph,
      width: 1100,
      height: Math.max(700, 400 + (diagram.classes?.length ?? 0) * 200),
      gridSize: 20,
      drawGrid: true,
      interactive: false,
      cellViewNamespace: shapes,
      background: { color: '#f8fafc' } });
    function formatClassMember(member: string, name: string): MemberDisplay {
      const details: Result<ClassDetails, Error> = Model.current.tryGetModel(name);
      const writable: string[] = details.isOk() ? details.value.methods.filter((item) => item.overloads.some((overload) => overload.some((field) => field.arg === '+RW' || field.arg === '+SET'))).map((item) => item.name) : [];
      const delegateTypes: string[] = Model.current.getClassNames().filter((className: string) => {
        const classDetails: Result<ClassDetails, Error> = Model.current.tryGetModel(className);
        return classDetails.isOk() && classDetails.value.state === 'delegate';
      });
      const aliasTypes: Map<string, string> = new Map<string, string>();
      Model.current.getClassNames().forEach((className: string) => {
        const classDetails: Result<ClassDetails, Error> = Model.current.tryGetModel(className);
        if (classDetails.isOk() && classDetails.value.state === 'alias' && classDetails.value.aliasType !== undefined) {
          aliasTypes.set(className, compositeTypeText(classDetails.value.aliasType));
        }
      });
      const display: MemberDisplay = formatMember(member, writable, delegateTypes, aliasTypes);
      const property: RegExpMatchArray | null = member.match(/^\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/u);
      const aliasName: string | undefined = property?.[1];
      if (aliasName) {
        const alias: Result<ClassDetails, Error> = Model.current.tryGetModel(aliasName);
        if (alias.isOk() && alias.value.state === 'alias' && alias.value.aliasType !== undefined) {
          display.aliasExpansion = `         (\u{1F3AD}${compositeTypeText(alias.value.aliasType)})`;
        }
      }
      return display;
    }
    function classHeaderText(name: string, width: number, state?: string): string {
      const details: Result<ClassDetails, Error> = Model.current.tryGetModel(name);
      const delegate: boolean = state === 'delegate' || details.isOk() && details.value.state === 'delegate';
      const union: boolean = state === 'union' || details.isOk() && details.value.state === 'union';
      if (union) return `\u{1F500}${fitText(name, width - 22, 'bold 17px Arial')}`;
      return delegate ? `${fitText(name, width - 22, 'bold 17px Arial')}⚡` : fitText(name, width, 'bold 17px Arial');
    }
    const members: MemberDisplay[] = diagram.members.map((member: string) => formatClassMember(member, diagram.title));
    function unionPanelRows(panels: readonly { type: string; aliasExpansion?: string }[]): string[] {
      return panels.flatMap((panel: { type: string; aliasExpansion?: string }, index: number) => [
        fitText(panel.type, 176, '13px monospace'),
        ...(panel.aliasExpansion ? [fitText(panel.aliasExpansion, 176, '13px monospace')] : []),
        ...(index + 1 < panels.length ? ['\u2500'.repeat(22)] : []),
      ]);
    }
    const rows: string[] = diagram.state === 'union' && diagram.unionPanels ? unionPanelRows(diagram.unionPanels) : members.flatMap((member: MemberDisplay) => [
      fitText(member.text, 176, '13px monospace'),
      ...(member.aliasExpansion ? [fitText(member.aliasExpansion, 176, '13px monospace')] : []),
    ]);
    const annotations: {
      start: number;
      end: number;
      attrs: {
        'data-method-tooltip': string;
        'data-method-index': string;
        'data-member-change': string;
        fill: string;
        'text-decoration'?: string;
        'aria-describedby': string;
        tabindex: number } }[] = [];
    let offset: number = 0;
    members.forEach((member: MemberDisplay, index: number) => {
      const row: string = fitText(member.text, 176, '13px monospace');
      annotations.push({
        start: offset,
        end: offset + row.length,
        attrs: {
          'data-method-tooltip': member.tooltip,
          'data-method-index': String(index),
          'data-member-change': diagram.memberStatuses?.at(index) ?? 'normal',
          fill: diagram.memberStatuses?.at(index) === 'changed' ? '#2563eb' : diagram.memberStatuses?.at(index) === 'deleted' ? '#24324b' : '#24324b',
          'text-decoration': diagram.memberStatuses?.at(index) === 'deleted' ? 'line-through' : 'none',
          'aria-describedby': 'method-tooltip',
          tabindex: 0 } });
      offset += row.length + 1;
      if (member.aliasExpansion) offset += fitText(member.aliasExpansion, 176, '13px monospace').length + 1;
    });
    const height: number = Math.max(70, 54 + rows.length * 18);
    const source: dia.Element = rows.length === 0 ? new shapes.standard.Rectangle() : new shapes.standard.HeaderedRectangle();
    source.position(50, 140); source.resize(rows.length === 0 ? 150 : 200, rows.length === 0 ? 30 : height);
    if (rows.length === 0) source.attr({
      body: { fill: '#e8efff', stroke: '#b5c2d3', strokeWidth: 1.5 },
      label: {
        text: classHeaderText(diagram.title, 130, diagram.state),
        fill: '#233f73',
        fontFamily: 'Arial',
        fontSize: 17,
        fontWeight: 'bold' },
    });
    else source.attr({
      body: { fill: '#fff', stroke: '#b5c2d3', strokeWidth: 1.5 },
      header: { fill: '#e8efff', stroke: '#b5c2d3', height: 30 },
      headerText: {
        text: classHeaderText(diagram.title, 180, diagram.state),
        fill: '#233f73',
        fontFamily: 'Arial',
        fontSize: 17,
        fontWeight: 'bold',
        y: 15 },
      bodyText: {
        text: rows.join('\n'),
        annotations,
        fill: '#24324b',
        fontFamily: 'monospace',
        fontSize: 13,
        textAnchor: 'start',
        x: 12,
        y: 42,
        textVerticalAnchor: 'top' } });
    source.addTo(graph);
    const nodeNames: Set<string> = new Set<string>();
    const addRelationTarget: (relation: Relation) => void = (relation: Relation): void => {
      graphClassTargets(relation.target).forEach((target: string) => nodeNames.add(target));
    };
    diagram.targets.forEach(addRelationTarget);
    (diagram.classes ?? []).forEach((item: Diagram) => { item.targets.forEach(addRelationTarget); });
    nodeNames.delete(diagram.title);
    Model.current.getClassNames().forEach((className: string) => {
      const classModel: Result<ClassDetails, Error> = Model.current.tryGetModel(className);
      if (!classModel.isOk() || classModel.value.state === 'deleted') return;
      if (classModel.value.state === 'alias') {
        if (classModel.value.aliasType !== undefined) graphTypeIdentifiers(classModel.value.aliasType).forEach((target: string) => graphClassTargets(target).forEach((resolved: string) => nodeNames.add(resolved)));
        return;
      }
      if (classModel.value.state !== 'partial' || partialRetention === 'retain') nodeNames.add(className);
    });
    const nodes: Map<string, dia.Element> = new Map<string, dia.Element>();
    let memberOffset: number = diagram.members.length;
    (diagram.classes ?? []).forEach((item: Diagram, index: number) => {
      if (item.state === 'alias') {
        const alias: Result<ClassDetails, Error> = Model.current.tryGetModel(item.title);
        if (alias.isOk() && alias.value.aliasType !== undefined) graphTypeIdentifiers(alias.value.aliasType).forEach((target: string) => graphClassTargets(target).forEach((resolved: string) => nodeNames.add(resolved)));
        return;
      }
      if (item.members.length === 0 && item.state !== 'union') { nodeNames.add(item.title); return; }
      nodeNames.delete(item.title);
      const full: shapes.standard.HeaderedRectangle = new shapes.standard.HeaderedRectangle();
      const entries: MemberDisplay[] = item.members.map((member: string) => formatClassMember(member, item.title));
      const rows: string[] = item.state === 'union' && item.unionPanels ? unionPanelRows(item.unionPanels) : entries.flatMap((entry: MemberDisplay) => [
        fitText(entry.text, 176, '13px monospace'),
        ...(entry.aliasExpansion ? [fitText(entry.aliasExpansion, 176, '13px monospace')] : []),
      ]);
      const annotations: {
        start: number;
        end: number;
        attrs: {
          'data-method-tooltip': string;
          'data-method-index': string;
          'data-member-change': string;
          fill: string;
          'text-decoration'?: string;
          'aria-describedby': string;
          tabindex: number } }[] = [];
      let offset: number = 0;
      entries.forEach((entry: MemberDisplay, entryIndex: number) => {
        const row: string = fitText(entry.text, 176, '13px monospace');
        annotations.push({
          start: offset,
          end: offset + row.length,
          attrs: {
            'data-method-tooltip': entry.tooltip,
            'data-method-index': String(memberOffset + entryIndex),
            'data-member-change': item.memberStatuses?.at(entryIndex) ?? 'normal',
            fill: item.memberStatuses?.at(entryIndex) === 'changed' ? '#2563eb' : '#24324b',
            'text-decoration': item.memberStatuses?.at(entryIndex) === 'deleted' ? 'line-through' : 'none',
            'aria-describedby': 'method-tooltip',
            tabindex: 0 } });
        offset += row.length + 1;
        if (entry.aliasExpansion) offset += fitText(entry.aliasExpansion, 176, '13px monospace').length + 1;
      });
      memberOffset += entries.length;
      full.position(400 + (index % 2) * 250, 145 + Math.floor(index / 2) * 200); full.resize(200, Math.max(70, 54 + rows.length * 18));
      full.attr({
        body: { fill: '#fff', stroke: '#b5c2d3', strokeWidth: 1.5 },
        header: { fill: '#e8efff', stroke: '#b5c2d3', height: 30 },
        headerText: {
          text: classHeaderText(item.title, 180, item.state),
          fill: '#233f73',
          fontFamily: 'Arial',
          fontSize: 17,
          fontWeight: 'bold',
          y: 15 },
        bodyText: {
          text: rows.join('\n'),
          annotations,
          fill: '#24324b',
          fontFamily: 'monospace',
          fontSize: 13,
          textAnchor: 'start',
          x: 12,
          y: 42,
          textVerticalAnchor: 'top' } });
      full.addTo(graph); nodes.set(item.title, full);
    });
    Array.from(nodeNames).forEach((name: string, index: number) => {
      const target: shapes.standard.Rectangle = new shapes.standard.Rectangle();
      target.position((diagram.classes?.length ?? 0) > 1 ? 50 : 400, 350 + index * 120); target.resize(150, 30);
      target.attr({
        body: { fill: '#e8efff', stroke: '#b5c2d3', strokeWidth: 1.5 },
        label: {
          text: classHeaderText(name, 130),
          fill: '#233f73',
          fontFamily: 'Arial',
          fontSize: 17,
          fontWeight: 'bold' } }); target.addTo(graph);
      nodes.set(name, target);
    });
    nodes.set(diagram.title, source);
    nodes.forEach((node: dia.Element, name: string) => {
      const element: SVGElement = paper.findViewByModel(node).el as SVGElement;
      element.setAttribute('data-class-name', name);
      if (!visible.includes(name)) return;
      const badge: SVGGElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      badge.setAttribute('data-eye-badge', '');
      badge.setAttribute('transform', 'translate(-10,-10)');
      const circle: SVGCircleElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '10'); circle.setAttribute('cy', '10'); circle.setAttribute('r', '10'); circle.setAttribute('fill', '#a7c7ff');
      const icon: SVGForeignObjectElement = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      icon.setAttribute('x', '1'); icon.setAttribute('y', '1'); icon.setAttribute('width', '18'); icon.setAttribute('height', '18');
      const label: HTMLDivElement = document.createElement('div'); label.textContent = '👁'; label.style.fontSize = '13px'; label.style.textAlign = 'center';
      icon.appendChild(label); badge.appendChild(circle); badge.appendChild(icon); element.appendChild(badge);
    });
    const classes: Diagram[] = [diagram, ...(diagram.classes ?? [])];
    classes.forEach((owner: Diagram) => { owner.targets.forEach((relation: Relation) => {
      const ownerNode: dia.Element | undefined = nodes.get(owner.title);
      if (!ownerNode) return;
      const targets: dia.Element[] = graphClassTargets(relation.target).flatMap((name: string) => {
        const target: dia.Element | undefined = nodes.get(name);
        return target ? [target] : [];
      });
      if (targets.length === 0) return;
      targets.forEach((target: dia.Element) => {
      const link: shapes.standard.Link = new shapes.standard.Link();
      link.router('rightAngle');
      link.source(ownerNode); link.target(target); link.attr({
        line: {
          stroke: '#7488a5',
          strokeWidth: 2,
          strokeDasharray: relation.kind === 'UNK' ? '5 4' : 'none',
          sourceMarker: {
            type: 'path',
            d: relation.kind === 'OWNS' ? 'M 0 0 L 10 -6 L 20 0 L 10 6 Z' : '',
            fill: relation.kind === 'OWNS' ? '#233f73' : 'none',
            stroke: '#233f73' },
          targetMarker: {
            type: 'path',
            d: relation.kind === 'REF' ? 'M 10 -5 0 0 10 5' : '',
            fill: 'none',
            stroke: '#233f73' } } });
      const labels: dia.Link.Label[] = [];
      if (relation.name) labels.push({
        position: { distance: 0.5, offset: -14 },
        attrs: {
          text: { text: relation.name, fontSize: 13, fill: '#233f73' } } });
      if (relation.multiplicity === 'many') labels.push({
        position: { distance: 0.88, offset: -12 },
        attrs: { text: { text: '*', fontSize: 20, fill: '#233f73' } } });
      link.labels(labels); link.addTo(graph); link.toBack();
      });
    }); });
    canvasHost.scrollLeft = graphScroll.current.left;
    canvasHost.scrollTop = graphScroll.current.top;
    if (focusRequest.revision > lastFocusedRevision.current) {
      lastFocusedRevision.current = focusRequest.revision;
      const target: Element | undefined = Array.from(canvasHost.querySelectorAll('[data-class-name]')).find((element: Element) => element.getAttribute('data-class-name') === focusRequest.className);
      if (target) {
        const hostBounds: DOMRect = canvasHost.getBoundingClientRect();
        const targetBounds: DOMRect = target.getBoundingClientRect();
        const maxLeft: number = Math.max(0, canvasHost.scrollWidth - canvasHost.clientWidth);
        const maxTop: number = Math.max(0, canvasHost.scrollHeight - canvasHost.clientHeight);
        const desiredLeft: number = canvasHost.scrollLeft + targetBounds.left - hostBounds.left + targetBounds.width / 2 - canvasHost.clientWidth / 2;
        const desiredTop: number = canvasHost.scrollTop + targetBounds.top - hostBounds.top + targetBounds.height / 2 - canvasHost.clientHeight / 2;
        canvasHost.scrollLeft = Math.max(0, Math.min(desiredLeft, maxLeft));
        canvasHost.scrollTop = Math.max(0, Math.min(desiredTop, maxTop));
      }
    }
    return () => {
      graphScroll.current = { left: canvasHost.scrollLeft, top: canvasHost.scrollTop };
      paper.remove();
      surface.remove();
    };
  }, [diagram, partialRetention, visible, focusRequest]);
  function showTooltip(target: EventTarget, container: HTMLElement): void {
    if (!(target instanceof Element)) return;
    // UNTRUST-ALLOW-NULLISH: Element.closest returns null for pointer events outside a class heading; only an existing heading can show class source information.
    const classNameElement: Element | null = target.closest('text[joint-selector="headerText"], text[joint-selector="label"]');
    if (classNameElement) {
      const name: string = classNameElement.closest('[data-class-name]')?.getAttribute('data-class-name') ?? '';
      const details: Result<ClassDetails, Error> = Model.current.tryGetModel(name);
      const sourceFile: string = details.isOk() ? details.value.sourceFile ?? '' : '';
      const modifiedAt: string = details.isOk() ? details.value.modifiedAt ?? '' : '';
      const bounds: DOMRect = classNameElement.getBoundingClientRect();
      const parent: DOMRect = container.getBoundingClientRect();
      const showCode: boolean = showActualCode;
      const cachedCode: string | undefined = actualCodeCache.get(name);
      setClassTooltip({
        visible: true,
        name,
        sourceFile,
        modifiedAt,
        sourceCodeState: showCode ? cachedCode ? 'loaded' : sourceFile ? 'loading' : 'unavailable' : 'not-requested',
        sourceCode: cachedCode ?? '',
        left: Math.max(8, Math.min(bounds.left - parent.left, parent.width - 288)),
        top: Math.max(8, bounds.bottom - parent.top + 6),
      });
      if (showCode && sourceFile && !cachedCode && !actualCodeRequests.current.has(name)) {
        actualCodeRequests.current.add(name);
        onGetActualCode(name, sourceFile).then((code: string) => {
          actualCodeRequests.current.delete(name);
          setActualCodeCache((current: ReadonlyMap<string, string>) => new Map<string, string>(current).set(name, code));
          setClassTooltip((current: ClassTooltipStateT) => current.visible && current.name === name ? {
            visible: true,
            name: current.name,
            sourceFile: current.sourceFile,
            modifiedAt: current.modifiedAt,
            sourceCodeState: 'loaded',
            sourceCode: code,
            left: current.left,
            top: current.top,
          } : current);
        }).catch((error: unknown) => {
          console.warn(`Could not retrieve source code for ${name}.`, error);
          actualCodeRequests.current.delete(name);
          setClassTooltip((current: ClassTooltipStateT) => current.visible && current.name === name ? {
            visible: true,
            name: current.name,
            sourceFile: current.sourceFile,
            modifiedAt: current.modifiedAt,
            sourceCodeState: 'unavailable',
            sourceCode: '',
            left: current.left,
            top: current.top,
          } : current);
        });
      }
      return;
    }
    // UNTRUST-ALLOW-NULLISH: The browser closest method returns null when the event did not originate from a method row; the next guard discards such events.
    const element: Element | null = target.closest('[data-method-index]');
    if (!element) return;
    const rawIndex: string = element.getAttribute('data-method-index') ?? '';
    if (!/^\d+$/.test(rawIndex)) return;
    const index: number = Number(rawIndex);
    const bounds: DOMRect = element.getBoundingClientRect();
    const parent: DOMRect = container.getBoundingClientRect();
    setTooltip({
      visible: true,
      index,
      left: Math.max(8, Math.min(bounds.right - parent.left + 14, parent.width - 288)),
      top: Math.max(8, bounds.bottom - parent.top + 6),
      anchorTop: bounds.top - parent.top });
  }
  const allMembers: string[] = [...diagram.members, ...(diagram.classes ?? []).flatMap((item: Diagram) => item.members)];
  const delegateTypes: string[] = Model.current.getClassNames().filter((className: string) => {
    const details: Result<ClassDetails, Error> = Model.current.tryGetModel(className);
    return details.isOk() && details.value.state === 'delegate';
  });
  const aliasTypes: Map<string, string> = new Map<string, string>();
  Model.current.getClassNames().forEach((className: string) => {
    const details: Result<ClassDetails, Error> = Model.current.tryGetModel(className);
    if (details.isOk() && details.value.state === 'alias' && details.value.aliasType !== undefined) aliasTypes.set(className, compositeTypeText(details.value.aliasType));
  });
  const member: MemberDisplay = tooltip.visible ? (allMembers.map((item: string) => formatMember(item, [], delegateTypes, aliasTypes)).at(tooltip.index) ?? { text: '', tooltip: '' }) : { text: '', tooltip: '' };
  const clickTimer: React.RefObject<number> = useRef<number>(0);
  const contextMenuElement: React.RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  const contextMenuIsOpen: React.RefObject<boolean> = useRef<boolean>(false);
  const suppressCanvasClick: React.RefObject<boolean> = useRef<boolean>(false);
  useEffect(() => () => window.clearTimeout(clickTimer.current), []);
  useEffect(() => {
    if (contextMenu.status !== 'open') return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        contextMenuIsOpen.current = false;
        setContextMenu({ status: 'closed' });
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [contextMenu.status]);
  useEffect(() => {
    if (contextMenu.status !== 'open') return;
    const closeOnOutsideClick = (event: MouseEvent): void => {
      const target: EventTarget | null = event.target;
      if (!contextMenuIsOpen.current || (target instanceof Node && contextMenuElement.current?.contains(target))) return;
      event.stopPropagation();
      suppressCanvasClick.current = true;
      contextMenuIsOpen.current = false;
      setContextMenu({ status: 'closed' });
    };
    window.addEventListener('click', closeOnOutsideClick, true);
    return () => window.removeEventListener('click', closeOnOutsideClick, true);
  }, [contextMenu.status]);
  function selectedClass(target: EventTarget): string {
    if (!(target instanceof Element)) return '';
    return target.closest('[data-class-name]')?.getAttribute('data-class-name') ?? '';
  }
  function handleCanvasClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (suppressCanvasClick.current) {
      suppressCanvasClick.current = false;
      return;
    }
    if (contextMenuIsOpen.current) {
      contextMenuIsOpen.current = false;
      setContextMenu({ status: 'closed' });
      return;
    }
    const name: string = selectedClass(event.target);
    if (!name) return;
    if (event.detail > 1) {
      window.clearTimeout(clickTimer.current);
      return;
    }
    window.clearTimeout(clickTimer.current);
    clickTimer.current = scheduleClick(() => onSelect(name, false));
  }
  function handleCanvasClickCapture(event: React.MouseEvent<HTMLDivElement>): void {
    if (!contextMenuIsOpen.current) return;
    if (event.target instanceof Node && contextMenuElement.current?.contains(event.target)) return;
    event.stopPropagation();
    suppressCanvasClick.current = true;
    contextMenuIsOpen.current = false;
    setContextMenu({ status: 'closed' });
  }
  function handleCanvasContextMenu(event: React.MouseEvent<HTMLDivElement>): void {
    const name: string = selectedClass(event.target);
    if (!name) return;
    event.preventDefault();
    contextMenuIsOpen.current = true;
    const target: Element | null = event.target instanceof Element ? event.target.closest('[data-method-index]') : null;
    const memberTooltip: string | undefined = target?.getAttribute('data-method-tooltip') ?? undefined;
    // UNTRUST-ALLOW-NULLISH: Event targets may be outside a rendered JointJS class element; a missing closest match means this click cannot select a class context action.
    const classBox: Element | null = event.target instanceof Element ? event.target.closest('[data-class-name]') : null;
    // UNTRUST-ALLOW-NULLISH: SVG text and header hit testing uses closest, which returns null for clicks that land elsewhere inside the canvas container.
    const nameBarTarget: Element | null = event.target instanceof Element ? event.target.closest('text[joint-selector="headerText"], text[joint-selector="label"], rect[joint-selector="header"]') : null;
    // UNTRUST-ALLOW-NULLISH: Plain rectangle classes use the body rectangle as their full name bar; missing SVG targets must not enable name-specific actions.
    const plainClassBodyTarget: Element | null = classBox?.classList.contains('joint-type-standard-rectangle') ? event.target instanceof Element ? event.target.closest('rect[joint-selector="body"]') : null : null;
    setContextMenu({
      status: 'open',
      className: name,
      x: event.clientX,
      y: event.clientY,
      ...(memberTooltip ? { memberTooltip } : {}),
      ...(nameBarTarget || plainClassBodyTarget ? { showActualCode: true } : {}),
    });
  }
  function handleCanvasDoubleClick(event: React.MouseEvent<HTMLDivElement>): void {
    window.clearTimeout(clickTimer.current);
    const name: string = selectedClass(event.target);
    if (name) onSelect(name, true);
  }
  return <div className="canvas-shell" onClickCapture={handleCanvasClickCapture} onClick={handleCanvasClick} onContextMenu={handleCanvasContextMenu} onDoubleClick={handleCanvasDoubleClick} onMouseOver={event => showTooltip(event.target, event.currentTarget)} onMouseOut={() => { setTooltip({ visible: false }); setClassTooltip({ visible: false }); }} onFocus={event => showTooltip(event.target, event.currentTarget)} onBlur={() => { setTooltip({ visible: false }); setClassTooltip({ visible: false }); }}>
    <div className="canvas" role="img" aria-label={`Diagram of ${diagram.title} with ${diagram.targets.map((relation: Relation) => relation.target).join(', ')}`} ref={host} />
    {tooltip.visible && member ? <MethodTooltip member={member} left={tooltip.left} top={tooltip.top} anchorTop={tooltip.anchorTop} /> : ''}
    {classTooltip.visible ? <div role="tooltip" className="method-tooltip" style={{ left: classTooltip.left, top: classTooltip.top }}><strong>{classTooltip.name}</strong>{classTooltip.sourceFile ? <div>File: {classTooltip.sourceFile}</div> : ''}{classTooltip.modifiedAt ? <div>Modified: <time dateTime={classTooltip.modifiedAt}>{classTooltip.modifiedAt}</time></div> : ''}{classTooltip.sourceCodeState !== 'not-requested' ? <><hr />{classTooltip.sourceCodeState === 'loaded' ? <pre className="actual-code-snippet">{actualCodeMarkup(classTooltip.sourceCode)}</pre> : classTooltip.sourceCodeState === 'unavailable' ? <div>Code unavailable</div> : <div>Loading code…</div>}</> : ''}</div> : ''}
    {contextMenu.status === 'open' ? <div ref={contextMenuElement} className="class-context-menu" role="menu" aria-label="Class actions" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation()}>
      {contextMenu.showActualCode ? <button type="button" role="menuitemcheckbox" aria-checked={showActualCode} onClick={() => setShowActualCode((current: boolean) => !current)}><span aria-hidden="true">{showActualCode ? '☑' : '☐'}</span> Show actual code</button> : ''}
      {contextMenu.memberTooltip ? <button type="button" role="menuitem" onClick={() => { contextMenuIsOpen.current = false; onAskAbout(contextMenu.className, contextMenu.memberTooltip?.split(/[(:]/)[0]?.trim() ?? ''); setContextMenu({ status: 'closed' }); }}>Ask about...</button> : ''}
      {contextMenu.showActualCode ? <button type="button" role="menuitem" onClick={() => { contextMenuIsOpen.current = false; onAskAbout(contextMenu.className, ''); setContextMenu({ status: 'closed' }); }}>Ask about...</button> : ''}
      <button type="button" role="menuitem" onClick={() => { contextMenuIsOpen.current = false; onSelect(contextMenu.className, false); setContextMenu({ status: 'closed' }); }}>Show class</button>
      <button type="button" role="menuitem" onClick={() => { contextMenuIsOpen.current = false; onEditChain(contextMenu.className); setContextMenu({ status: 'closed' }); }}>Edit chain</button>
    </div> : ''}
  </div>;
}

interface DocumentState {
  shown: string[];
  validity: 'valid' | 'invalid';
}

function classBlocks(text: string): string[] {
  return text.split(/\n[ \t]*\n(?=[A-Za-z_][A-Za-z0-9_]*[ \t]*(?:\n|$))/).map((block: string) => block.trim()).filter((block: string) => Boolean(block));
}

function referencesPartialClass(name: string, text: string): boolean {
  const pattern: RegExp = new RegExp(`(?:\\:\\s*|\\(\\s*|,\\s*|^OWNS\\s+)${name}(?=[^A-Za-z0-9_]|$)`);
  return text.split(/\r?\n/).some((line: string) => pattern.test(line));
}

function hiddenClassTexts(shown: readonly string[], replacing: readonly string[], referenceText: string): string[] {
  const hidden: string[] = [];
  Model.current.getClassNames().forEach((className: string) => {
    if (shown.includes(className) || replacing.includes(className)) return;
    const classModel: Result<ClassDetails, Error> = Model.current.tryGetModel(className);
    if (!classModel.isOk() || classModel.value.state === 'deleted') return;
    if (classModel.value.state === 'alias') return;
    if (classModel.value.state === 'partial' && !referencesPartialClass(className, referenceText)) return;
    hidden.push(Model.decompile(classModel.value));
  });
  return hidden;
}

function diagramWithModel(base: Diagram, referenceText: string): Diagram {
  const represented: Set<string> = new Set([base.title, ...(base.classes ?? []).map((item: Diagram) => item.title)]);
  const additional: Diagram[] = [];
  Model.current.getClassNames().forEach((className: string) => {
    if (represented.has(className)) return;
    const classModel: Result<ClassDetails, Error> = Model.current.tryGetModel(className);
    if (!classModel.isOk() || classModel.value.state === 'deleted') return;
    if (classModel.value.state === 'partial' && !referencesPartialClass(className, referenceText)) return;
    additional.push(classDetailsToDiagram(classModel.value));
  });
  const classes: Diagram[] = [...(base.classes ?? []), ...additional];
  return {
    title: base.title,
    members: base.members,
    targets: base.targets,
    classes,
  };
}

function diagramFromModel(preferredNames: readonly string[], referenceText: string): Diagram | undefined {
  const preferred: Set<string> = new Set(preferredNames);
  const orderedNames: string[] = [...preferredNames, ...Model.current.getClassNames().filter((name: string) => !preferred.has(name))];
  const details: ClassDetails[] = [];
  orderedNames.forEach((className: string) => {
    const classModel: Result<ClassDetails, Error> = Model.current.tryGetModel(className);
    if (!classModel.isOk() || classModel.value.state === 'deleted') return;
    if (classModel.value.state === 'alias') return;
    if (!preferred.has(className) && classModel.value.state === 'partial' && !referencesPartialClass(className, referenceText)) return;
    details.push(classModel.value);
  });
  return classDetailsToDiagramSet(details);
}

type WorkspacePropsT = { initialText: string; initial: Diagram | undefined; onAskAbout: (className: string, memberName: string) => void; onGetActualCode: (className: string, sourceFile: string) => Promise<string>; };
function Workspace({ initialText, initial, onAskAbout, onGetActualCode }: WorkspacePropsT) {
  const [diagram, setDiagram]: [Diagram | undefined, React.Dispatch<React.SetStateAction<Diagram | undefined>>] = useState<Diagram | undefined>(initial);
  const [partialRetention, setPartialRetention]: ['retain' | 'discard', React.Dispatch<React.SetStateAction<'retain' | 'discard'>>] = useState<'retain' | 'discard'>('discard');
  const [message, setMessage]: [string, React.Dispatch<React.SetStateAction<string>>] = useState('Diagram is up to date');
  const document: React.RefObject<DocumentState> = useRef<DocumentState>({ shown: initial ? [initial.title] : [], validity: 'valid' });
  const [visible, setVisible]: [string[], React.Dispatch<React.SetStateAction<string[]>>] = useState<string[]>(initial ? [initial.title] : []);
  const [diagramFullscreen, setDiagramFullscreen]: [boolean, React.Dispatch<React.SetStateAction<boolean>>] = useState<boolean>(false);
  const [editorPercent, setEditorPercent]: [number, React.Dispatch<React.SetStateAction<number>>] = useState<number>(loadEditorPercent);
  const [graphFocus, setGraphFocus]: [{ className: string; revision: number }, React.Dispatch<React.SetStateAction<{ className: string; revision: number }>>] = useState({ className: '', revision: 0 });
  const [selection, setSelection]: [{ revision: number; text: string }, React.Dispatch<React.SetStateAction<{ revision: number; text: string }>>] = useState({ revision: 0, text: initialText });
  // UNTRUST-ALLOW-NULLISH: React refs begin without a mounted element and return to that state after unmount; the resize handler checks the ref before reading its bounds.
  const workspaceElement: React.RefObject<HTMLElement | null> = useRef<HTMLElement>(null);
  const splitterDragging: React.RefObject<boolean> = useRef<boolean>(false);
  const renamedClasses: React.RefObject<Map<string, string>> = useRef<Map<string, string>>(new Map<string, string>());
  const hiddenNames: (text: string) => readonly string[] = useState(() => (text: string) => Model.current.getClassNames().filter((name: string) => {
    if (document.current.shown.includes(name)) return false;
    const classModel: Result<ClassDetails, Error> = Model.current.tryGetModel(name);
    return classModel.isOk() && classModel.value.state !== 'deleted' && !(classModel.value.state === 'partial' && referencesPartialClass(name, text));
  }))[0];
  function classText(className: string): string {
    const classModel: Result<ClassDetails, Error> = Model.current.tryGetModel(className);
    return classModel.isOk() ? Model.decompile(classModel.value) : className;
  }
  const change: (value: string) => void = useState(() => function update(value: string): void {
    const command: RegExpMatchArray | string[] = value.match(/^([A-Za-z_][A-Za-z0-9_]*)@[ \t]*$/m) ?? [];
    const requested: string = command.at(1) ?? '';
    if (requested && !document.current.shown.includes(requested)) {
      const requestedClass: Result<ClassDetails, Error> = Model.current.tryGetModel(requested);
      if (requestedClass.isOk()) {
        const expanded: string = value.replace(/^([A-Za-z_][A-Za-z0-9_]*)@[ \t]*$/m, Model.decompile(requestedClass.value));
        document.current.shown = [...document.current.shown, requested];
        update(expanded);
        setSelection((previous: { revision: number; text: string }) => ({ revision: previous.revision + 1, text: expanded }));
        return;
      }
    }
    if (!value.trim()) { document.current.validity = 'valid'; document.current.shown = []; setVisible([]); setMessage('Diagram is up to date'); return; }
    const result: ParseResultT = parseDiagram(value);
    if (!result.ok) {
      document.current.validity = 'invalid';
      if (result.diagram) {
        const projected: string[] = [...hiddenClassTexts(document.current.shown, [], value), value];
        const partial: ParseResultT = parseDiagram(projected.join('\n\n'));
        if (!partial.ok && partial.diagram) { setDiagram(diagramWithModel(partial.diagram, value)); setPartialRetention(partial.partialRetention ?? result.partialRetention ?? 'discard'); setMessage(partial.message); }
        else setMessage(`${result.message} Showing the last valid diagram.`);
      } else setMessage(`${result.message} Showing the last valid diagram.`);
      return;
    }
    const blocks: string[] = classBlocks(value);
    const names: string[] = [result.diagram.title, ...(result.diagram.classes ?? []).map((item: Diagram) => item.title)];
    const old: DocumentState = document.current;
    const existingNamesBeforeUpdate: ReadonlySet<string> = new Set<string>(Model.current.getClassNames());
    const nameConflicts: boolean = names.some((name: string) => {
      if (old.shown.includes(name)) return false;
      const isRenameBack: boolean = old.shown.some((previousName: string, index: number) => names.at(index) === name && renamedClasses.current.get(previousName) === name);
      if (isRenameBack) return false;
      const existing: Result<ClassDetails, Error> = Model.current.tryGetModel(name);
      return existing.isOk() && !(existing.value.state === 'partial' && referencesPartialClass(name, value));
    });
    if (nameConflicts) { document.current.validity = 'invalid'; setMessage('A hidden class already has that name. Showing the last valid diagram.'); return; }
    const modelUpdates: ClassDetails[] = blocks.map((block: string) => {
      const parsed: ClassDetails | Error = Model.parse(block);
      if (parsed instanceof Error) logAndThrow(parsed);
      return parsed;
    });
    Model.current.updateClasses(modelUpdates);
    old.shown.forEach((previousName: string, index: number) => {
      const nextName: string | undefined = names.at(index);
      if (!nextName || previousName === nextName) return;
      if (renamedClasses.current.get(previousName) === nextName) {
        Model.current.markDeleted(previousName);
        renamedClasses.current.delete(previousName);
      } else if (!existingNamesBeforeUpdate.has(nextName)) renamedClasses.current.set(nextName, previousName);
    });
    const fullText: string = [...hiddenClassTexts(old.shown, names, value), value].join('\n\n');
    const full: ParseResultT = parseDiagram(fullText);
    const updatedDiagram: Diagram | undefined = full.ok ? full.diagram : diagramFromModel(names, value);
    if (!updatedDiagram) { document.current.validity = 'invalid'; setMessage('The updated class model is empty. Showing the last valid diagram.'); return; }
    document.current = { shown: names, validity: 'valid' };
    setVisible(names); setDiagram(updatedDiagram); setPartialRetention('discard'); setMessage('Diagram is up to date');
  })[0];
  function select(name: string, exclusive: boolean): void {
    if (document.current.validity === 'invalid') { setMessage('Correct the current text before changing the visible classes.'); return; }
    const shown: string[] = exclusive ? [name] : document.current.shown.includes(name) ? document.current.shown.filter((item: string) => item !== name) : [...document.current.shown, name];
    document.current.shown = shown;
    setVisible(shown);
    setSelection((previous: { revision: number; text: string }) => ({
      revision: previous.revision + 1,
      text: exclusive ? classText(name) : shown.map(classText).join('\n\n') }));
  }
  function editChain(rootName: string): void {
    const ordered: readonly ClassDetails[] = Model.current.getClassChain(rootName);
    if (ordered.length === 0) return;
    const orderedNames: string[] = ordered.map((details: ClassDetails) => details.name);
    document.current = { shown: orderedNames, validity: 'valid' };
    setVisible(orderedNames);
    setMessage('Diagram is up to date');
    setSelection((previous: { revision: number; text: string }) => ({
      revision: previous.revision + 1,
      text: orderedNames.map(classText).join('\n\n'),
    }));
  }
  function updateEditorPercent(clientX: number): void {
    // UNTRUST-ALLOW-NULLISH: The workspace ref is empty until its section mounts and may clear during unmount; ignore pointer input outside that mounted lifetime.
    const bounds: DOMRect | undefined = workspaceElement.current?.getBoundingClientRect() ?? undefined;
    if (!bounds) return;
    const dividerWidth: number = 12;
    const horizontalPadding: number = 44;
    const availableWidth: number = bounds.width - horizontalPadding - dividerWidth;
    const ratio: number = ((clientX - bounds.left - horizontalPadding / 2 - dividerWidth / 2) / availableWidth) * 100;
    setEditorPercent(Math.max(20, Math.min(80, ratio)));
  }
  function beginPanelResize(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;
    splitterDragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function movePanelResize(event: React.PointerEvent<HTMLDivElement>): void {
    if (splitterDragging.current) updateEditorPercent(event.clientX);
  }
  function endPanelResize(): void {
    splitterDragging.current = false;
  }
  function resizeFromKeyboard(event: React.KeyboardEvent<HTMLDivElement>): void {
    const amount: number = event.shiftKey ? 5 : 2;
    if (event.key === 'ArrowLeft') setEditorPercent((previous: number) => Math.max(20, previous - amount));
    else if (event.key === 'ArrowRight') setEditorPercent((previous: number) => Math.min(80, previous + amount));
    else return;
    event.preventDefault();
  }
  const workspaceStyle: React.CSSProperties = {
    gridTemplateColumns: `minmax(0, ${editorPercent}fr) 12px minmax(0, ${100 - editorPercent}fr)`,
  };
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const selectClassHook: (name: string) => void = (name: string) => {
      if (Model.current.tryGetModel(name).isErr()) logAndThrow(new Error('Unknown class.'));
      select(name, true);
    };
    const getSelectionHook: () => readonly string[] = () => [...document.current.shown];
    const tryGetModelHook: (name: string) => Result<ClassDetails, Error> = (name: string) => Model.current.tryGetModel(name);
    const getClassChainHook: (name: string) => readonly ClassDetails[] = (name: string) => Model.current.getClassChain(name);
    if (window.__app) {
      window.__app.selectClass = selectClassHook;
      window.__app.getSelection = getSelectionHook;
      window.__app.tryGetModel = tryGetModelHook;
      window.__app.getClassChain = getClassChainHook;
    } else {
      window.__app = {
        selectClass: selectClassHook,
        getSelection: getSelectionHook,
        tryGetModel: tryGetModelHook,
        getClassChain: getClassChainHook,
      };
    }
    return () => {
      if (!window.__app) return;
      delete window.__app.selectClass;
      delete window.__app.getSelection;
      delete window.__app.tryGetModel;
      delete window.__app.getClassChain;
      if (Object.keys(window.__app).length === 0) delete window.__app;
    };
  });
  useEffect(() => saveEditorPercent(editorPercent), [editorPercent]);
  return (
    <section
      className="workspace workspace-resizable"
      ref={workspaceElement}
      style={workspaceStyle}
    >
      <section className="pane text-pane">
        <div className="pane-heading pane-heading-trimmed">
          <div className="pane-title-row">
            <h1>Text editor</h1>
            <p className="hint">Edit the DSL to update the diagram.</p>
          </div>
        </div>
        <Editor
          initialText={initialText}
          onChange={change}
          onGoToClass={(className: string) => setGraphFocus((previous: { className: string; revision: number }) => ({ className, revision: previous.revision + 1 }))}
          onAskAbout={onAskAbout}
          selection={selection}
          hiddenNames={hiddenNames}
        />
        <div className="status" aria-live="polite">
          <span className="dot" />{message}
        </div>
      </section>
      <div
        className="panel-splitter"
        role="separator"
        aria-label="Resize text editor and diagram panels"
        aria-orientation="vertical"
        aria-valuemin={20}
        aria-valuemax={80}
        aria-valuenow={Math.round(editorPercent)}
        tabIndex={0}
        onPointerDown={beginPanelResize}
        onPointerMove={movePanelResize}
        onPointerUp={endPanelResize}
        onPointerCancel={endPanelResize}
        onLostPointerCapture={endPanelResize}
        onKeyDown={resizeFromKeyboard}
      />
      <section className={diagramFullscreen ? 'pane graph-pane graph-pane-fullscreen' : 'pane graph-pane'}>
        <div className="pane-heading pane-heading-trimmed graph-pane-heading">
          <div className="pane-title-row">
            <h2>Diagram canvas</h2>
            <p className="hint">Updates as you edit.</p>
          </div>
          <button
            type="button"
            className="diagram-toggle"
            aria-label={diagramFullscreen ? 'Exit full screen diagram' : 'Expand diagram to full screen'}
            aria-pressed={diagramFullscreen}
            onClick={() => setDiagramFullscreen((previous: boolean) => !previous)}
          >
            [ ]
          </button>
        </div>
        {diagram ? <Canvas
          diagram={diagram}
          partialRetention={partialRetention}
          visible={visible}
          focusRequest={graphFocus}
          onSelect={select}
          onEditChain={editChain}
          onAskAbout={onAskAbout}
          onGetActualCode={onGetActualCode}
        /> : <div className="canvas-shell"><div className="canvas" role="img" aria-label="Empty diagram canvas" /></div>}
      </section>
    </section>
  );
}

type LoadedStateT = {
  status: 'ready';
  text: string;
  diagram: Diagram | undefined;
};
type LoadStateT = { status: 'loading' } | { status: 'error' } | LoadedStateT;
type TestsLoadStateT = { status: 'loading' } | { status: 'error' } | { status: 'ready'; tests: readonly TestCaseDetails[] };
type ModeT = 'classes' | 'tests' | 'semantics';

type TopbarPropsT = {
  mode: ModeT;
  onModeChange: (mode: ModeT) => void;
  chatState: ChatPanelStateT;
  onChatToggle: () => void;
  projectName: string;
  projects: readonly string[];
  onProjectChange: (projectName: string) => void;
  onNewProject: () => void;
  onProjectSettings: () => void;
};

function Topbar({ mode, onModeChange, chatState, onChatToggle, projectName, projects, onProjectChange, onNewProject, onProjectSettings }: TopbarPropsT) {
  return <header className="topbar">
    <div className="brand"><span className="mark">◇</span><strong>cod<span>AI</span>gram</strong></div>
    <div className="subtitle">Think in text. See the structure.</div>
    <nav className="mode-tabs" aria-label="Workspace mode">
      <button type="button" role="tab" aria-selected={mode === 'classes'} className={mode === 'classes' ? 'mode-tab selected' : 'mode-tab'} onClick={() => onModeChange('classes')}>Classes</button>
      <button type="button" role="tab" aria-selected={mode === 'tests'} className={mode === 'tests' ? 'mode-tab selected' : 'mode-tab'} onClick={() => onModeChange('tests')}>Tests</button>
      <button type="button" role="tab" aria-selected={mode === 'semantics'} className={mode === 'semantics' ? 'mode-tab selected' : 'mode-tab'} onClick={() => onModeChange('semantics')}>Semantics</button>
    </nav>
    <div className="badge">EARLY PREVIEW</div>
    <div className="project-switcher">
      <div className="project-selector-label">
        <select
          aria-label="Current project"
          className="project-selector"
          value={projects.length === 0 ? '' : projectName}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
            if (event.currentTarget.value === NEW_PROJECT_OPTION) onNewProject();
            else onProjectChange(event.currentTarget.value);
          }}
        >
          {projects.map((name: string) => <option key={name} value={name}>{name}</option>)}
          <option value={NEW_PROJECT_OPTION}>New project</option>
        </select>
        {projects.length === 0 ? <span className="project-no-project-label">NO PROJECT</span> : ''}
        <button type="button" className="project-settings-button" aria-label="Project settings" title="Project settings" onClick={onProjectSettings}>⚙️</button>
      </div>
      {projectName.length > 40 ? <span className="project-name-tooltip" role="tooltip">{projectName}</span> : ''}
    </div>
    <button type="button" className="chat-panel-toggle" aria-label="Toggle chat panel" aria-expanded={chatState === 'open'} onClick={onChatToggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M4 14h16v6H4z" />
        <path d="M4 14h16" />
      </svg>
    </button>
  </header>;
}

function ChatPanel({ onClose, bridgeConnectionStatus, onConnect, onSend, askAboutHeader }: {
  onClose: () => void;
  bridgeConnectionStatus: BridgeConnectionStatusT;
  onConnect: () => void;
  onSend: (prompt: string) => Promise<string>;
  askAboutHeader: React.ReactNode | undefined;
}) {
  const [draft, setDraft]: [string, React.Dispatch<React.SetStateAction<string>>] = useState<string>('');
  const [messages, setMessages]: [readonly ChatMessageT[], React.Dispatch<React.SetStateAction<readonly ChatMessageT[]>>] = useState<readonly ChatMessageT[]>([]);
  const [sending, setSending]: [boolean, React.Dispatch<React.SetStateAction<boolean>>] = useState<boolean>(false);
  const [sendError, setSendError]: [string, React.Dispatch<React.SetStateAction<string>>] = useState<string>('');

  async function sendPrompt(): Promise<void> {
    const prompt: string = draft.trim();
    if (bridgeConnectionStatus !== 'connected' || prompt.length === 0 || sending) return;
    setMessages((current: readonly ChatMessageT[]) => [...current, { role: 'user', text: prompt }]);
    setDraft('');
    setSendError('');
    setSending(true);
    try {
      const response: string = await onSend(prompt);
      setMessages((current: readonly ChatMessageT[]) => [...current, { role: 'assistant', text: response }]);
    } catch (error: unknown) {
      console.error(`[${new Date().toISOString()}] Chat prompt failed through the VS Code bridge.`, error);
      setSendError(error instanceof Error ? error.message : 'The VS Code bridge could not answer the prompt.');
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="chat-panel" aria-label="Chat panel">
      <div className="chat-panel-heading">
        <h2>{askAboutHeader ?? 'Chat'}</h2>
        <button type="button" aria-label="Close chat panel" onClick={onClose}>x</button>
      </div>
      <div className="chat-transcript" role="log" aria-live="polite">
        <p>Ask a question about the current diagram.</p>
        {messages.map((message: ChatMessageT, index: number) => <p key={`${message.role}-${index}`} data-chat-role={message.role}>{message.text}</p>)}
        {sendError ? <p role="alert">{sendError}</p> : ''}
      </div>
      <div className="chat-composer">
        <label className="visually-hidden" htmlFor="chat-message">Message</label>
        <textarea id="chat-message" aria-label="Message" placeholder="Write a message..." value={draft} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(event.currentTarget.value)} />
        <button type="button" disabled={bridgeConnectionStatus !== 'connected' || draft.trim().length === 0 || sending} onClick={() => { void sendPrompt(); }}>Send</button>
      </div>
      {bridgeConnectionStatus !== 'connected' ? <p className="chat-connect-required"><span>You must connect to vscode first</span> <button type="button" onClick={onConnect}>Connect</button></p> : ''}
    </aside>
  );
}

function NewProjectDialog({ onCancel, onCreate }: {
  onCancel: () => void;
  onCreate: (projectName: string) => Promise<void>;
}) {
  const [projectName, setProjectName]: [string, React.Dispatch<React.SetStateAction<string>>] = useState<string>('');
  const [errorMessage, setErrorMessage]: [string, React.Dispatch<React.SetStateAction<string>>] = useState<string>('');
  async function create(): Promise<void> {
    try {
      await onCreate(projectName.trim());
    } catch (error: unknown) {
      console.error('Project creation failed', error);
      setErrorMessage('Could not create project. Check the name and try again.');
    }
  }
  return <div className="project-dialog-backdrop">
    <section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="new-project-title" aria-describedby="new-project-help">
      <h2 id="new-project-title">New project</h2>
      <p id="new-project-help">Enter a name for the new project.</p>
      <label htmlFor="new-project-name">Project name</label>
      <input
        id="new-project-name"
        autoFocus
        value={projectName}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setProjectName(event.currentTarget.value)}
      />
      {errorMessage ? <p role="alert">{errorMessage}</p> : ''}
      <div className="project-dialog-actions">
        <button type="button" className="project-dialog-create" disabled={projectName.trim().length === 0} onClick={create}>Create</button>
        <button type="button" className="project-dialog-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  </div>;
}

function VscodeBridgeSettingsDialog({
  connectionStatus,
  requestStatus,
  connectionUrl,
  workspaces,
  selectedWorkspaceUris,
  selectedAgentUris,
  errorMessage,
  onCancel,
  onConnectionUrlChange,
  onWorkspaceToggle,
  onWorkspaceCycle,
  onConnect,
}: {
  connectionStatus: BridgeConnectionStatusT;
  requestStatus: BridgeRequestStatusT;
  connectionUrl: string;
  workspaces: readonly VscodeWorkspaceFolderT[];
  selectedWorkspaceUris: readonly string[];
  selectedAgentUris: readonly string[];
  errorMessage: string;
  onCancel: () => void;
  onConnectionUrlChange: (value: string) => void;
  onWorkspaceToggle: (uri: string) => void;
  onWorkspaceCycle: (uri: string) => void;
  onConnect: () => void;
}) {
  return <div className="project-dialog-backdrop">
    <section className="project-dialog vscode-bridge-dialog" role="dialog" aria-modal="true" aria-labelledby="vscode-bridge-title">
      <div className="vscode-bridge-heading">
        <h2 id="vscode-bridge-title">VS Code workspaces</h2>
        <button type="button" aria-label="Close VS Code bridge settings" onClick={onCancel}>×</button>
      </div>
      {connectionStatus === 'connected' ? <section aria-label="Available VS Code workspaces">
        {workspaces.length > 0 ? <ul className="vscode-workspace-list">{workspaces.map((workspace: VscodeWorkspaceFolderT) => {
          const mode: WorkspaceSelectionModeT = workspaceSelectionMode(workspace, selectedWorkspaceUris, selectedAgentUris);
          const selected: boolean = mode === 'folder';
          return <li key={`${workspace.index}:${workspace.uri}`}>
            <label><i className="workspace-selection-icon" aria-hidden="true">{workspaceSelectionIcon(mode)}</i><input
              type="checkbox"
              aria-label={workspace.name}
              checked={selected}
              disabled={selected && selectedWorkspaceUris.length === 1}
              onChange={() => onWorkspaceToggle(workspace.uri)}
            /><button type="button" className="workspace-selection-cycle" aria-label={`Cycle selection for ${workspace.name}`} onClick={() => onWorkspaceCycle(workspace.uri)}><strong>{workspace.name}</strong></button></label><span>{workspaceFolderDisplayPath(workspace.uri, workspace.name)}</span>
          </li>;
        })}</ul> : <p className="vscode-workspace-empty">No workspace folders are open in VS Code.</p>}
      </section> : <div className="vscode-bridge-connect-form">
        <label htmlFor="vscode-bridge-link">VS Code bridge link</label>
        <input
          id="vscode-bridge-link"
          aria-label="VS Code bridge link"
          autoFocus
          value={connectionUrl}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => onConnectionUrlChange(event.currentTarget.value)}
          placeholder="Paste the link copied from VS Code"
        />
        {errorMessage ? <p role="alert">{errorMessage}</p> : ''}
        <div className="project-dialog-actions">
          <button type="button" className="project-dialog-create" disabled={requestStatus === 'connecting' || connectionUrl.trim().length === 0} onClick={onConnect}>{requestStatus === 'connecting' ? 'Connecting…' : 'Connect'}</button>
          <button type="button" className="project-dialog-cancel" onClick={onCancel}>Close</button>
        </div>
      </div>}
    </section>
  </div>;
}

function TestsWorkspace({ tests }: { tests: readonly TestCaseDetails[] }) {
  const byGroup: Map<string, TestCaseDetails[]> = new Map<string, TestCaseDetails[]>();
  tests.forEach((test: TestCaseDetails) => {
    const group: TestCaseDetails[] = byGroup.get(test.group) ?? [];
    group.push(test);
    byGroup.set(test.group, group);
  });
  return <section className="workspace"><section className="pane tests-pane"><div className="pane-heading"><div><span className="eyebrow">INVENTORY</span><h1>Tests</h1></div><span className="file-badge">{tests.length} CASES</span></div><p className="hint">Tests discovered from the project server source.</p><nav className="tests-tree" aria-label="Tests inventory"><ul className="tests-tree-root">{Array.from(byGroup.entries(), ([groupName, groupTests]: [string, TestCaseDetails[]]) => <li key={groupName} className="test-group"><span className="tree-group-label">{groupName}</span><ul>{groupTests.map((test: TestCaseDetails) => <li key={`${test.group}.${test.name}`} className="test-case"><span>{test.name}</span><small>{test.description}</small></li>)}</ul></li>)}</ul></nav></section><section className="pane graph-pane tests-preview"><div className="pane-heading"><h2>Test flow</h2><span className="file-badge">COMING LATER</span></div><div className="tests-placeholder">A sequence-diagram view will appear here.</div></section></section>;
}

function SemanticsWorkspace() {
  return <section className="semantics-page" aria-labelledby="semantics-page-title">
    <h1 id="semantics-page-title" className="semantics-page-heading">Semantics</h1>
    <section className="workspace semantics-workspace" aria-label="Semantics panes">
      <section className="pane semantics-pane semantics-glossary-pane" aria-labelledby="semantics-glossary-title">
        <div className="pane-heading">
          <h2 id="semantics-glossary-title">Glossary</h2>
        </div>
        <div className="semantics-content">Glossary entries will appear here.</div>
      </section>
      <section className="pane semantics-pane semantics-references-pane" aria-labelledby="semantics-references-title">
        <div className="pane-heading">
          <h2 id="semantics-references-title">References</h2>
        </div>
        <div className="semantics-content">Semantic references will appear here.</div>
      </section>
    </section>
  </section>;
}

function App() {
  const [state, setState]: [LoadStateT, React.Dispatch<React.SetStateAction<LoadStateT>>] = useState<LoadStateT>({ status: 'loading' });
  const [testsState, setTestsState]: [TestsLoadStateT, React.Dispatch<React.SetStateAction<TestsLoadStateT>>] = useState<TestsLoadStateT>({ status: 'loading' });
  const [mode, setMode]: [ModeT, React.Dispatch<React.SetStateAction<ModeT>>] = useState<ModeT>('classes');
  const [chatState, setChatState]: [ChatPanelStateT, React.Dispatch<React.SetStateAction<ChatPanelStateT>>] = useState<ChatPanelStateT>('closed');
  const [askAboutHeader, setAskAboutHeader]: [React.ReactNode | undefined, React.Dispatch<React.SetStateAction<React.ReactNode | undefined>>] = useState<React.ReactNode | undefined>(undefined);
  const [askAboutContext, setAskAboutContext]: [RelatedPromptContextT, React.Dispatch<React.SetStateAction<RelatedPromptContextT>>] = useState<RelatedPromptContextT>(EMPTY_RELATED_PROMPT_CONTEXT);
  const [projectName, setProjectName]: [string, React.Dispatch<React.SetStateAction<string>>] = useState<string>('');
  const [projects, setProjects]: [string[], React.Dispatch<React.SetStateAction<string[]>>] = useState<string[]>([]);
  const [projectsReady, setProjectsReady]: [boolean, React.Dispatch<React.SetStateAction<boolean>>] = useState<boolean>(false);
  const [newProjectDialog, setNewProjectDialog]: [NewProjectDialogStatusT, React.Dispatch<React.SetStateAction<NewProjectDialogStatusT>>] = useState<NewProjectDialogStatusT>('closed');
  const [projectSettingsDialog, setProjectSettingsDialog]: [ProjectSettingsDialogStatusT, React.Dispatch<React.SetStateAction<ProjectSettingsDialogStatusT>>] = useState<ProjectSettingsDialogStatusT>('closed');
  const [bridgeSession, setBridgeSession]: [PersistedVscodeBridgeSessionT | undefined, React.Dispatch<React.SetStateAction<PersistedVscodeBridgeSessionT | undefined>>] = useState<PersistedVscodeBridgeSessionT | undefined>(loadPersistedVscodeBridgeSession);
  const [bridgeInput, setBridgeInput]: [string, React.Dispatch<React.SetStateAction<string>>] = useState<string>('');
  const [bridgeConfigured, setBridgeConfigured]: [boolean, React.Dispatch<React.SetStateAction<boolean>>] = useState<boolean>(Boolean(bridgeSession));
  const [bridgeConnectionStatus, setBridgeConnectionStatus]: [BridgeConnectionStatusT, React.Dispatch<React.SetStateAction<BridgeConnectionStatusT>>] = useState<BridgeConnectionStatusT>('disconnected');
  const [bridgeRequestStatus, setBridgeRequestStatus]: [BridgeRequestStatusT, React.Dispatch<React.SetStateAction<BridgeRequestStatusT>>] = useState<BridgeRequestStatusT>('idle');
  const [bridgeWorkspaces, setBridgeWorkspaces]: [readonly VscodeWorkspaceFolderT[], React.Dispatch<React.SetStateAction<readonly VscodeWorkspaceFolderT[]>>] = useState<readonly VscodeWorkspaceFolderT[]>([]);
  const [selectedWorkspaceUris, setSelectedWorkspaceUris]: [readonly string[], React.Dispatch<React.SetStateAction<readonly string[]>>] = useState<readonly string[]>(loadVscodeWorkspaceSelection);
  const [selectedAgentUris, setSelectedAgentUris]: [readonly string[], React.Dispatch<React.SetStateAction<readonly string[]>>] = useState<readonly string[]>([]);
  const [workspaceTimestamp, setWorkspaceTimestamp]: [number, React.Dispatch<React.SetStateAction<number>>] = useState<number>(0);
  const [bridgeError, setBridgeError]: [string, React.Dispatch<React.SetStateAction<string>>] = useState<string>('');
  // UNTRUST-ALLOW-NULLISH: The bridge client is absent before connecting and after disconnect; identity checks guard all client cleanup and state updates.
  const bridgeClient: React.RefObject<VscodeBridgeConnectionT['client'] | null> = useRef<VscodeBridgeConnectionT['client'] | null>(null);
  // UNTRUST-ALLOW-NULLISH: The disconnect subscription starts absent before connection and is cleared when the bridge client closes or the app unmounts, so null is its deliberate initial state.
  const bridgeDisconnectSubscription: React.RefObject<(() => void) | null> = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!bridgeSession) return;
    void connectBridge(bridgeSession.endpoint, bridgeSession.sessionId);
  }, []);
  useEffect(() => {
    const controller: AbortController = new AbortController();
    loadProjectNames(controller.signal).then((names: string[]) => {
      if (controller.signal.aborted) return;
      const sortedNames: string[] = Array.from(new Set(names)).sort((left: string, right: string) => left.localeCompare(right));
      const savedProjectName: string | undefined = loadSavedProjectName();
      const initialProjectName: string = savedProjectName && sortedNames.includes(savedProjectName)
        ? savedProjectName
        : sortedNames.includes(DEFAULT_PROJECT_NAME) ? DEFAULT_PROJECT_NAME : sortedNames.at(0) ?? '';
      setProjects(sortedNames);
      setProjectName(initialProjectName);
      setProjectsReady(true);
    }).catch((error: unknown) => {
      console.error('Project names request failed', error);
      if (!controller.signal.aborted) {
        setProjects([]);
        setProjectName('');
        setProjectsReady(true);
      }
    });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!projectsReady || !projectName) return;
    const controller: AbortController = new AbortController();
    loadClassDetails(controller.signal, projectName).then((inventory) => {
      const details: ClassDetails[] = inventory.classes;
      Model.current = new ClassWorkspaceModel();
      Model.current.initClasses(details);
      const graphDetails: ClassDetails[] = details.filter((item: ClassDetails) => item.state !== 'alias');
      if (graphDetails.length === 0) {
        // UNTRUST-ALLOW-NULLISH: An empty project inventory intentionally has no Diagram value, distinguishing its blank canvas from a graph projection while retaining the loaded-state object shape.
        setState({ status: 'ready', text: '', diagram: undefined });
        return;
      }
      // UNTRUST-ALLOW-NULLISH: The server can return an empty inventory, and Array.at returns undefined in that case; a non-empty inventory deliberately opens its first class without assuming a ClassDiagram declaration exists.
      const sourceClass: ClassDetails | undefined = graphDetails.at(0);
      const initial: Diagram | undefined = classDetailsToDiagramSet(graphDetails, inventory.memberChanges);
      if (!sourceClass || !initial) { setState({ status: 'error' }); return; }
      const text: string = Model.decompile(sourceClass);
      setState({ status: 'ready', text, diagram: initial });
    }).catch((error: unknown) => { console.error('Class details request failed', error); if (!controller.signal.aborted) setState({ status: 'error' }); });
    return () => controller.abort();
  }, [projectName, projectsReady]);
  useEffect(() => {
    return () => {
      if (bridgeDisconnectSubscription.current) bridgeDisconnectSubscription.current();
      // UNTRUST-ALLOW-NULLISH: Unmount cleanup clears the optional disconnect callback after invoking it, so later renders cannot treat the stale subscription as active.
      bridgeDisconnectSubscription.current = null;
      if (bridgeClient.current) void bridgeClient.current.close();
      // UNTRUST-ALLOW-NULLISH: Clearing the optional client reference after closing prevents an unmounted component or later cleanup pass from treating the old bridge connection as active.
      bridgeClient.current = null;
    };
  }, []);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const isConnectedHook: () => boolean = () => bridgeConnectionStatus === 'connected';
    const isConfiguredHook: () => boolean = () => bridgeConfigured;
    const lastFetchHook: () => number = () => workspaceTimestamp;
    const connectHook: (connectionLink: string) => Promise<void> = async (connectionLink: string) => connectBridge(connectionLink);
    const workspacesHook: () => readonly VscodeWorkspaceFolderT[] = () => bridgeWorkspaces;
    if (window.__app) {
      window.__app.isVscodeBridgeConnected = isConnectedHook;
      window.__app.isVscodeBridgeConfigured = isConfiguredHook;
      window.__app.workspacesLastFetchTimestamp = lastFetchHook;
      window.__app.connectToVscodeBridge = connectHook;
      window.__app.getVscodeWorkspaces = workspacesHook;
    } else {
      window.__app = {
        isVscodeBridgeConnected: isConnectedHook,
        isVscodeBridgeConfigured: isConfiguredHook,
        workspacesLastFetchTimestamp: lastFetchHook,
        connectToVscodeBridge: connectHook,
        getVscodeWorkspaces: workspacesHook,
      };
    }
    return () => {
      if (!window.__app) return;
      delete window.__app.isVscodeBridgeConnected;
      delete window.__app.isVscodeBridgeConfigured;
      delete window.__app.workspacesLastFetchTimestamp;
      delete window.__app.connectToVscodeBridge;
      delete window.__app.getVscodeWorkspaces;
      if (Object.keys(window.__app).length === 0) delete window.__app;
    };
  });
  useEffect(() => {
    if (!projectsReady || !projectName) return;
    const controller: AbortController = new AbortController();
    loadTestsInventory(controller.signal, projectName).then((tests: TestCaseDetails[]) => {
      if (!controller.signal.aborted) setTestsState({ status: 'ready', tests });
    }).catch((error: unknown) => { console.error('Tests inventory request failed', error); if (!controller.signal.aborted) setTestsState({ status: 'error' }); });
    return () => controller.abort();
  }, [projectName, projectsReady]);
  useEffect(() => saveVscodeWorkspaceSelection(selectedWorkspaceUris), [selectedWorkspaceUris]);
  useEffect(() => {
    if (projectsReady && projectName) saveSelectedProjectName(projectName);
  }, [projectName, projectsReady]);
  function changeProject(nextProjectName: string): void {
    setState({ status: 'loading' });
    setTestsState({ status: 'loading' });
    setProjectName(nextProjectName);
  }
  function promptForProjectName(): void {
    setNewProjectDialog('open');
  }
  function openProjectSettings(): void {
    setBridgeInput('');
    setBridgeError('');
    setProjectSettingsDialog('open');
    if (bridgeSession && bridgeConnectionStatus !== 'connected' && bridgeRequestStatus !== 'connecting') {
      void connectBridge(bridgeSession.endpoint, bridgeSession.sessionId);
    }
  }
  async function connectBridge(connectionLink: string, sessionId?: string): Promise<void> {
    setBridgeRequestStatus('connecting');
    if (!bridgeConfigured) setBridgeConnectionStatus('disconnected');
    setBridgeError('');
    try {
      const connection: VscodeBridgeConnectionT = await connectToVscodeBridge(connectionLink.trim(), sessionId);
      if (bridgeDisconnectSubscription.current) bridgeDisconnectSubscription.current();
      // UNTRUST-ALLOW-NULLISH: Replace the prior optional subscription before attaching the new client's disconnect callback, preventing stale cleanup from being invoked later.
      bridgeDisconnectSubscription.current = null;
      if (bridgeClient.current) void bridgeClient.current.close();
      bridgeClient.current = connection.client;
      bridgeDisconnectSubscription.current = connection.client.onDisconnect(() => {
        if (bridgeClient.current === connection.client) {
          // UNTRUST-ALLOW-NULLISH: The client reports disconnect, so clear its reference before updating state and prevent actions from using a stale connection.
          bridgeClient.current = null;
          if (bridgeDisconnectSubscription.current) bridgeDisconnectSubscription.current();
          // UNTRUST-ALLOW-NULLISH: The disconnect callback is one-shot for this client; clearing it prevents a later cleanup from treating the completed subscription as active.
          bridgeDisconnectSubscription.current = null;
          setBridgeConnectionStatus('disconnected');
        }
      });
      setBridgeInput(connectionLink.trim());
      setBridgeSession(connection.session);
      savePersistedVscodeBridgeSession(connection.session);
      setBridgeConfigured(true);
      setBridgeConnectionStatus('connected');
      setBridgeWorkspaces(connection.workspaces);
      setSelectedWorkspaceUris((current: readonly string[]) => {
        const stillAvailable: string[] = current.filter((uri: string) => connection.workspaces.some((workspace: VscodeWorkspaceFolderT) => workspace.uri === uri));
        return stillAvailable;
      });
      setSelectedAgentUris((current: readonly string[]) => current.filter((uri: string) => connection.workspaces.some((workspace: VscodeWorkspaceFolderT) => workspace.uri === uri)));
      setWorkspaceTimestamp(Date.now());
    } catch (error: unknown) {
      console.warn('VS Code bridge connection failed.', error);
      setBridgeError(bridgeConnectionFailureMessage(error));
      if (sessionId) {
        clearPersistedVscodeBridgeSession();
        // UNTRUST-ALLOW-NULLISH: A rejected reconnect invalidates the persisted session; clearing this state returns the settings dialog to manual bridge pairing with no stale endpoint.
        setBridgeSession(undefined);
        setBridgeConfigured(false);
      }
      setBridgeConnectionStatus('disconnected');
      if (sessionId || !bridgeConfigured) {
        setBridgeWorkspaces([]);
        setWorkspaceTimestamp(0);
      }
    } finally {
      setBridgeRequestStatus('idle');
    }
  }
  async function createNewProject(name: string): Promise<void> {
    await createProjectRequest(name);
    const projectNamesController: AbortController = new AbortController();
    const projectNames: string[] = await loadProjectNames(projectNamesController.signal);
    setProjects(Array.from(new Set(projectNames)).sort((left: string, right: string) => left.localeCompare(right)));
    setNewProjectDialog('closed');
    changeProject(name);
  }
  function toggleWorkspaceSelection(uri: string): void {
    setSelectedWorkspaceUris((current: readonly string[]) => {
      const isSelected: boolean = current.includes(uri);
      if (isSelected) return current.length > 1 ? current.filter((selectedUri: string) => selectedUri !== uri) : current;
      return [...current, uri];
    });
  }
  function cycleWorkspaceSelection(uri: string): void {
    const workspace: VscodeWorkspaceFolderT | undefined = bridgeWorkspaces.find((candidate: VscodeWorkspaceFolderT) => candidate.uri === uri);
    if (!workspace) return;
    const mode: WorkspaceSelectionModeT = workspaceSelectionMode(workspace, selectedWorkspaceUris, selectedAgentUris);
    if (mode === 'none') {
      if (workspace.configuredAgents.length > 0) {
        setSelectedAgentUris((current: readonly string[]) => current.includes(uri) ? current : [...current, uri]);
      } else {
        setSelectedWorkspaceUris((current: readonly string[]) => current.includes(uri) ? current : [...current, uri]);
      }
      return;
    }
    if (mode === 'agent') {
      setSelectedAgentUris((current: readonly string[]) => current.filter((selectedUri: string) => selectedUri !== uri));
      setSelectedWorkspaceUris((current: readonly string[]) => current.includes(uri) ? current : [...current, uri]);
      return;
    }
    setSelectedWorkspaceUris((current: readonly string[]) => current.filter((selectedUri: string) => selectedUri !== uri));
  }
  async function sendChatPrompt(prompt: string): Promise<string> {
    // UNTRUST-ALLOW-NULLISH: The bridge client is intentionally absent while disconnected; the following guard converts that transient UI state into a stable user-facing error.
    const client: VscodeBridgeConnectionT['client'] | null = bridgeClient.current;
    if (!client || bridgeConnectionStatus !== 'connected') logAndThrow(new Error('Connect to the VS Code bridge before sending a prompt.'));
    // UNTRUST-ALLOW-UNLOGGED-THROW: Rejections from the bridge are caught and logged by ChatPanel.sendPrompt, which presents the same failure to the user.
    const options: ReturnType<typeof buildChatPromptOptions> = buildChatPromptOptions(bridgeWorkspaces, selectedWorkspaceUris, selectedAgentUris, projectName);
    return client.promptAi(prompt, { ...options, ...askAboutContext });
  }
  async function getActualCodeForClass(className: string, sourceFile: string): Promise<string> {
    // UNTRUST-ALLOW-NULLISH: Raw source retrieval is delegated to the existing VS Code Bridge API and is unavailable until the user has paired a live bridge client.
    const client: VscodeBridgeConnectionT['client'] | null = bridgeClient.current;
    if (!client || bridgeConnectionStatus !== 'connected') logAndThrow(new Error('Connect to the VS Code bridge to retrieve source code.'));
    const options: ReturnType<typeof buildChatPromptOptions> = buildChatPromptOptions(bridgeWorkspaces, selectedWorkspaceUris, selectedAgentUris, projectName);
    const roots: readonly string[] = [options.cwd, ...options.workFolders];
    const code: GetCodeResult = await client.getCode(projectName, roots, sourceFile, className);
    return typeof code === 'string' ? code : code.join('\n\n');
  }
  function openAskAbout(className: string, memberName: string): void {
    setAskAboutContext({ relatedFile: '', relatedClass: className, relatedMember: memberName });
    setAskAboutHeader(memberName ? <>Ask about <em>{memberName}</em> in <em>{className}</em></> : <>Ask about <em>{className}</em></>);
    setChatState('open');
  }
  function closeChatPanel(): void {
    setChatState('closed');
    setAskAboutHeader(undefined);
    setAskAboutContext(EMPTY_RELATED_PROMPT_CONTEXT);
  }
  function toggleChatPanel(): void {
    if (chatState === 'open') {
      closeChatPanel();
      return;
    }
    setChatState('open');
  }
  return <main>
    <Topbar
      mode={mode}
      onModeChange={setMode}
      chatState={chatState}
      onChatToggle={toggleChatPanel}
      projectName={projectName}
      projects={projects}
      onProjectChange={changeProject}
      onNewProject={promptForProjectName}
      onProjectSettings={openProjectSettings}
    />
    {mode === 'classes' ? state.status === 'loading' ? <section className="mode-message" role="status">Loading class details…</section> : state.status === 'error' ? <section className="mode-message" role="alert">Could not load class details. Check that the server is running and reload.</section> : <Workspace key={projectName} initialText={state.text} initial={state.diagram} onAskAbout={openAskAbout} onGetActualCode={getActualCodeForClass} /> : mode === 'tests' ? testsState.status === 'loading' ? <section className="mode-message" role="status">Loading tests inventory…</section> : testsState.status === 'error' ? <section className="mode-message" role="alert">Could not load tests inventory. Check that the server is running and reload.</section> : <TestsWorkspace tests={testsState.tests} /> : <SemanticsWorkspace />}
    {chatState === 'open' ? <ChatPanel onClose={closeChatPanel} bridgeConnectionStatus={bridgeConnectionStatus} onConnect={openProjectSettings} onSend={sendChatPrompt} askAboutHeader={askAboutHeader} /> : ""}
    {newProjectDialog === 'open' ? <NewProjectDialog onCancel={() => setNewProjectDialog('closed')} onCreate={createNewProject} /> : ''}
    {projectSettingsDialog === 'open' ? <VscodeBridgeSettingsDialog
      connectionStatus={bridgeConnectionStatus}
      requestStatus={bridgeRequestStatus}
      connectionUrl={bridgeInput}
      workspaces={bridgeWorkspaces}
      selectedWorkspaceUris={selectedWorkspaceUris}
      selectedAgentUris={selectedAgentUris}
      errorMessage={bridgeError}
      onCancel={() => setProjectSettingsDialog('closed')}
      onConnectionUrlChange={setBridgeInput}
      onWorkspaceToggle={toggleWorkspaceSelection}
      onWorkspaceCycle={cycleWorkspaceSelection}
      onConnect={() => { void connectBridge(bridgeInput); }}
    /> : ''}
  </main>;
}

// UNTRUST-ALLOW-NULLISH: The browser DOM API returns null when the mount element is absent; the following guard prevents passing an absent element to React and does not expose that value outside this boundary.
const ROOT: HTMLElement | null = document.getElementById('root');
if (ROOT) createRoot(ROOT).render(<App />);
