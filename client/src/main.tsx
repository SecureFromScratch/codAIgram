import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorState, Transaction } from '@codemirror/state';
import { history, historyKeymap } from '@codemirror/commands';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { dia, shapes } from '@joint/core';
import { parseDiagram, type Diagram, type ParseResultT, type Relation } from './model';
import { classDetailsToText, loadClassDetails, type ClassDetails } from './class-details';
import { formatMember, type MemberDisplay, type Parameter } from './signatures';
import { dslErrorsFor, dslErrorTooltip, dslHighlighting } from './dsl-highlighting';
import { scheduleClick } from './click-timer';
import './style.css';

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

function Editor({ initialText, onChange, selection, hiddenNames }: {
  initialText: string;
  onChange: (value: string) => void;
  selection: { revision: number; text: string };
  hiddenNames: (text: string) => readonly string[] }) {
  // UNTRUST-ALLOW-NULLISH: React initializes DOM refs as null before mounting and clears them on unmount; this boundary is checked before any DOM access.
  const host: React.RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  // UNTRUST-ALLOW-NULLISH: The editor view does not exist until React mounts it and is destroyed during cleanup; callers check this reference before use.
  const editor: React.RefObject<EditorView | null> = useRef<EditorView>(null);
  const selecting: React.RefObject<boolean> = useRef<boolean>(false);
  useEffect(() => {
    if (!host.current) return;
    const view: EditorView = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialText,
        extensions: [lineNumbers(), history(), keymap.of(historyKeymap), dslHighlighting, dslErrorsFor(hiddenNames), dslErrorTooltip, EditorView.contentAttributes.of({ 'aria-label': 'Diagram text' }), EditorView.updateListener.of(update => { if (update.docChanged && !selecting.current) onChange(update.state.doc.toString()); })] }) });
    editor.current = view;
    return () => {
      // UNTRUST-ALLOW-NULLISH: React editor refs use null as their unmounted state; clear the reference before destroying the view so later effects cannot use a stale instance.
      editor.current = null;
      view.destroy();
    };
  }, [initialText, onChange, hiddenNames]);
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
  return <div className="editor" ref={host} />;
}

type TooltipStateT = { visible: false } | {
  visible: true;
  index: number;
  left: number;
  top: number;
  anchorTop: number };

function argumentColor(index: number): string { return `hsl(${(index * 137.508) % 360} 85% 78%)`; }

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
    {member.parameters ? <><div className="tooltip-signature"><strong>{member.text}</strong><span className="tooltip-paren">(</span>{parameters.map((parameter: Parameter, index: number) => <span key={`${index}-${parameter.name}`}><span className={`argument-color-${index}`} style={{ color: argumentColor(index) }}>{parameter.name}</span>{index + 1 < parameters.length ? <span className="tooltip-punctuation">, </span> : ''}</span>)}<span className="tooltip-paren">)</span></div>{parameters.length > 0 ? <div className="tooltip-parameters">{parameters.map((parameter: Parameter, index: number) => <div className="tooltip-parameter" key={`${index}-${parameter.name}`}><span className="tooltip-dash">—</span><span className={`argument-color-${index}`} style={{ color: argumentColor(index) }}>{parameter.name}</span><span className="tooltip-punctuation">: </span><span className="tooltip-type">{parameter.type}</span></div>)}</div> : ''}</> : <div className="tooltip-signature">{member.tooltip}</div>}
  </div>;
}

function Canvas({ diagram, knownClasses, partialRetention, visible, onSelect }: {
  diagram: Diagram;
  knownClasses: readonly ClassDetails[];
  partialRetention: 'retain' | 'discard';
  visible: readonly string[];
  onSelect: (name: string, exclusive: boolean) => void }) {
  const [tooltip, setTooltip]: [TooltipStateT, React.Dispatch<React.SetStateAction<TooltipStateT>>] = useState<TooltipStateT>({ visible: false });
  // UNTRUST-ALLOW-NULLISH: React initializes DOM refs as null before mounting and clears them on unmount; this boundary is checked before any DOM access.
  const host: React.RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const graph: dia.Graph = new dia.Graph({}, { cellNamespace: shapes });
    const surface: HTMLDivElement = document.createElement('div');
    host.current.appendChild(surface);
    const paper: dia.Paper = new dia.Paper({
      el: surface,
      model: graph,
      width: 1100,
      height: 700,
      gridSize: 20,
      drawGrid: true,
      interactive: false,
      cellViewNamespace: shapes,
      background: { color: '#f8fafc' } });
    const members: MemberDisplay[] = diagram.members.map(formatMember);
    const rows: string[] = members.map((member: MemberDisplay): string => fitText(member.text, 176, '13px monospace'));
    const annotations: {
      start: number;
      end: number;
      attrs: {
        'data-method-tooltip': string;
        'data-method-index': string;
        'aria-describedby': string;
        tabindex: number } }[] = [];
    let offset: number = 0;
    members.forEach((member: MemberDisplay, index: number): void => {
      const row: string = rows.at(index) ?? '';
      annotations.push({
        start: offset,
        end: offset + row.length,
        attrs: {
          'data-method-tooltip': member.tooltip,
          'data-method-index': String(index),
          'aria-describedby': 'method-tooltip',
          tabindex: 0 } });
      offset += row.length + 1;
    });
    const height: number = Math.max(70, 54 + rows.length * 18);
    const source: shapes.standard.HeaderedRectangle = new shapes.standard.HeaderedRectangle();
    source.position(50, 140); source.resize(200, height);
    source.attr({
      body: { fill: '#fff', stroke: '#b5c2d3', strokeWidth: 1.5 },
      header: { fill: '#e8efff', stroke: '#b5c2d3', height: 30 },
      headerText: {
        text: fitText(diagram.title, 180, 'bold 17px Arial'),
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
    const nodeNames: Set<string> = new Set(diagram.targets.map((relation: Relation): string => relation.target));
    (diagram.classes ?? []).forEach((item: Diagram): void => { item.targets.forEach((relation: Relation): void => { nodeNames.add(relation.target); }); });
    nodeNames.delete(diagram.title);
    knownClasses.forEach((item: ClassDetails): void => { if (!item.isPartial || partialRetention === 'retain') nodeNames.add(item.name); });
    const nodes: Map<string, dia.Element> = new Map<string, dia.Element>();
    let memberOffset: number = diagram.members.length;
    (diagram.classes ?? []).forEach((item: Diagram, index: number): void => {
      if (item.members.length === 0 && item.targets.length === 0) { nodeNames.add(item.title); return; }
      nodeNames.delete(item.title);
      const full: shapes.standard.HeaderedRectangle = new shapes.standard.HeaderedRectangle();
      const entries: MemberDisplay[] = item.members.map(formatMember);
      const rows: string[] = entries.map((entry: MemberDisplay): string => fitText(entry.text, 176, '13px monospace'));
      const annotations: {
        start: number;
        end: number;
        attrs: {
          'data-method-tooltip': string;
          'data-method-index': string;
          'aria-describedby': string;
          tabindex: number } }[] = [];
      let offset: number = 0;
      entries.forEach((entry: MemberDisplay, entryIndex: number): void => {
        const row: string = rows.at(entryIndex) ?? '';
        annotations.push({
          start: offset,
          end: offset + row.length,
          attrs: {
            'data-method-tooltip': entry.tooltip,
            'data-method-index': String(memberOffset + entryIndex),
            'aria-describedby': 'method-tooltip',
            tabindex: 0 } });
        offset += row.length + 1;
      });
      memberOffset += entries.length;
      full.position(400 + (index % 2) * 250, 145 + Math.floor(index / 2) * 200); full.resize(200, Math.max(70, 54 + rows.length * 18));
      full.attr({
        body: { fill: '#fff', stroke: '#b5c2d3', strokeWidth: 1.5 },
        header: { fill: '#e8efff', stroke: '#b5c2d3', height: 30 },
        headerText: {
          text: fitText(item.title, 180, 'bold 17px Arial'),
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
    Array.from(nodeNames).forEach((name: string, index: number): void => {
      const target: shapes.standard.Rectangle = new shapes.standard.Rectangle();
      target.position(400, 350 + index * 120); target.resize(150, 30);
      target.attr({
        body: { fill: '#e8efff', stroke: '#b5c2d3', strokeWidth: 1.5 },
        label: {
          text: fitText(name, 130, 'bold 17px Arial'),
          fill: '#233f73',
          fontFamily: 'Arial',
          fontSize: 17,
          fontWeight: 'bold' } }); target.addTo(graph);
      nodes.set(name, target);
    });
    nodes.set(diagram.title, source);
    nodes.forEach((node: dia.Element, name: string): void => {
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
    classes.forEach((owner: Diagram): void => { owner.targets.forEach((relation: Relation): void => {
      const ownerNode: dia.Element | undefined = nodes.get(owner.title);
      if (!ownerNode) return;
      // UNTRUST-ALLOW-NULLISH: Map lookup returns undefined for absent keys; guard the renderer against any inconsistent projection before creating a link.
      const target: dia.Element | undefined = nodes.get(relation.target);
      if (!target) return;
      const link: shapes.standard.Link = new shapes.standard.Link();
      link.source(ownerNode); link.target(target); link.attr({
        line: {
          stroke: '#7488a5',
          strokeWidth: 2,
          sourceMarker: {
            type: 'path',
            d: 'M 0 0 L 10 -6 L 20 0 L 10 6 Z',
            fill: '#233f73',
            stroke: '#233f73' },
          targetMarker: { type: 'path', d: '' } } });
      const labels: dia.Link.Label[] = [];
      if (relation.name) labels.push({
        position: { distance: 0.5, offset: -14 },
        attrs: {
          text: { text: relation.name, fontSize: 13, fill: '#233f73' } } });
      if (relation.multiplicity === 'many') labels.push({
        position: { distance: 0.88, offset: -12 },
        attrs: { text: { text: '*', fontSize: 20, fill: '#233f73' } } });
      link.labels(labels); link.addTo(graph); link.toBack();
    }); });
    return () => { paper.remove(); };
  }, [diagram, knownClasses, partialRetention, visible]);
  function showTooltip(target: EventTarget, container: HTMLElement): void {
    if (!(target instanceof Element)) return;
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
  const allMembers: string[] = [...diagram.members, ...(diagram.classes ?? []).flatMap((item: Diagram): string[] => item.members)];
  const member: MemberDisplay = tooltip.visible ? (allMembers.map(formatMember).at(tooltip.index) ?? { text: '', tooltip: '' }) : { text: '', tooltip: '' };
  const clickTimer: React.RefObject<number> = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(clickTimer.current), []);
  function selectedClass(target: EventTarget): string {
    if (!(target instanceof Element)) return '';
    return target.closest('[data-class-name]')?.getAttribute('data-class-name') ?? '';
  }
  return <div className="canvas-shell" onClick={event => { const name: string = selectedClass(event.target); if (!name) return; if (event.detail > 1) { window.clearTimeout(clickTimer.current); return; } window.clearTimeout(clickTimer.current); clickTimer.current = scheduleClick(() => onSelect(name, false)); }} onDoubleClick={event => { window.clearTimeout(clickTimer.current); const name: string = selectedClass(event.target); if (name) onSelect(name, true); }} onMouseOver={event => showTooltip(event.target, event.currentTarget)} onMouseOut={() => setTooltip({ visible: false })} onFocus={event => showTooltip(event.target, event.currentTarget)} onBlur={() => setTooltip({ visible: false })}>
    <div className="canvas" role="img" aria-label={`Diagram of ${diagram.title} with ${diagram.targets.map((relation: Relation): string => relation.target).join(', ')}`} ref={host} />
    {tooltip.visible && member ? <MethodTooltip member={member} left={tooltip.left} top={tooltip.top} anchorTop={tooltip.anchorTop} /> : ''}
  </div>;
}

interface DocumentState {
  sources: Map<string, string>;
  shown: string[];
  validity: 'valid' | 'invalid';
}

function classBlocks(text: string): string[] {
  return text.split(/\n[ \t]*\n(?=[A-Za-z_][A-Za-z0-9_]*[ \t]*(?:\n|$))/).map((block: string): string => block.trim()).filter((block: string): boolean => Boolean(block));
}

function canCompletePartial(source: string, name: string, text: string): boolean {
    const partial: ParseResultT = parseDiagram(source);
  if (!partial.ok || partial.diagram.members.length > 0 || partial.diagram.targets.length > 0) return false;
  const pattern: RegExp = new RegExp(`(?:\\:\\s*|\\(\\s*|,\\s*|^OWNS\\s+)${name}(?=[^A-Za-z0-9_]|$)`);
  return text.split(/\r?\n/).some((line: string): boolean => pattern.test(line));
}

function Workspace({ initialText, initial, knownClasses }: {
  initialText: string;
  initial: Diagram;
  knownClasses: readonly ClassDetails[] }) {
  const [diagram, setDiagram]: [Diagram, React.Dispatch<React.SetStateAction<Diagram>>] = useState(initial);
  const [partialRetention, setPartialRetention]: ['retain' | 'discard', React.Dispatch<React.SetStateAction<'retain' | 'discard'>>] = useState<'retain' | 'discard'>('discard');
  const [message, setMessage]: [string, React.Dispatch<React.SetStateAction<string>>] = useState('Diagram is up to date');
  const document: React.RefObject<DocumentState> = useRef<DocumentState>({
    sources: new Map([[initial.title, initialText]]),
    shown: [initial.title],
    validity: 'valid' });
  const [visible, setVisible]: [string[], React.Dispatch<React.SetStateAction<string[]>>] = useState<string[]>([initial.title]);
  const [selection, setSelection]: [{ revision: number; text: string }, React.Dispatch<React.SetStateAction<{ revision: number; text: string }>>] = useState({ revision: 0, text: initialText });
  const hiddenNames: (text: string) => readonly string[] = useState(() => (text: string): string[] => Array.from(document.current.sources.keys()).filter((name: string): boolean => !document.current.shown.includes(name) && !canCompletePartial(document.current.sources.get(name) ?? '', name, text)))[0];
  const change: (value: string) => void = useState(() => function update(value: string): void {
    const command: RegExpMatchArray | string[] = value.match(/^([A-Za-z_][A-Za-z0-9_]*)@[ \t]*$/m) ?? [];
    const requested: string = command.at(1) ?? '';
    const stored: string = document.current.sources.get(requested) ?? '';
    if (requested && stored && !document.current.shown.includes(requested)) {
      const expanded: string = value.replace(/^([A-Za-z_][A-Za-z0-9_]*)@[ \t]*$/m, stored);
      document.current.shown = [...document.current.shown, requested];
      update(expanded);
      setSelection((previous: { revision: number; text: string }): { revision: number; text: string } => ({ revision: previous.revision + 1, text: expanded }));
      return;
    }
    if (!value.trim()) { document.current.validity = 'valid'; document.current.shown = []; setVisible([]); setMessage('Diagram is up to date'); return; }
    const result: ParseResultT = parseDiagram(value);
    if (!result.ok) {
      document.current.validity = 'invalid';
      if (result.diagram) {
        const projected: string[] = [];
        let inserted: boolean = false;
        document.current.sources.forEach((source: string, name: string): void => {
          if (!document.current.shown.includes(name)) projected.push(source);
          else if (!inserted) { projected.push(value); inserted = true; }
        });
        if (!inserted) projected.push(value);
        const partial: ParseResultT = parseDiagram(projected.join('\n\n'));
        if (!partial.ok && partial.diagram) { setDiagram(partial.diagram); setPartialRetention(partial.partialRetention ?? 'discard'); setMessage(partial.message); }
        else setMessage(`${result.message} Showing the last valid diagram.`);
      } else setMessage(`${result.message} Showing the last valid diagram.`);
      return;
    }
    const blocks: string[] = classBlocks(value);
    const names: string[] = [result.diagram.title, ...(result.diagram.classes ?? []).map((item: Diagram): string => item.title)];
    const old: DocumentState = document.current;
    if (names.some((name: string): boolean => old.sources.has(name) && !old.shown.includes(name) && !canCompletePartial(old.sources.get(name) ?? '', name, value))) { document.current.validity = 'invalid'; setMessage('A hidden class already has that name. Showing the last valid diagram.'); return; }
    const updated: Map<string, string> = new Map<string, string>();
    let next: number = 0;
    old.sources.forEach((source: string, name: string): void => {
      if (!old.shown.includes(name)) { updated.set(name, source); return; }
      const newName: string = names.at(next) ?? '';
      const block: string = blocks.at(next) ?? '';
      if (newName && block) updated.set(newName, block);
      next++;
    });
    while (next < names.length) { const name: string = names.at(next) ?? ''; const block: string = blocks.at(next) ?? ''; if (name && block) updated.set(name, block); next++; }
    const full: ParseResultT = parseDiagram(Array.from(updated.values()).join('\n\n'));
    if (!full.ok) { document.current.validity = 'invalid'; setMessage(`${full.message} Showing the last valid diagram.`); return; }
    document.current = { sources: updated, shown: names, validity: 'valid' };
    setVisible(names); setDiagram(full.diagram); setPartialRetention('discard'); setMessage('Diagram is up to date');
  })[0];
  function select(name: string, exclusive: boolean): void {
    if (document.current.validity === 'invalid') { setMessage('Correct the current text before changing the visible classes.'); return; }
    let source: string = document.current.sources.get(name) ?? '';
    if (!source) { const known: ClassDetails | undefined = knownClasses.find((item: ClassDetails): boolean => item.name === name); source = known ? classDetailsToText(known) : name; document.current.sources.set(name, source); }
    const shown: string[] = exclusive ? [name] : document.current.shown.includes(name) ? document.current.shown.filter((item: string): boolean => item !== name) : [...document.current.shown, name];
    document.current.shown = shown;
    setVisible(shown);
    setSelection((previous: { revision: number; text: string }): { revision: number; text: string } => ({
      revision: previous.revision + 1,
      text: shown.map((item: string): string => document.current.sources.get(item) ?? '').join('\n\n') }));
  }
  return <main><header className="topbar"><div className="brand"><span className="mark">◇</span><strong>cod<span>AI</span>gram</strong></div><div className="subtitle">Think in text. See the structure.</div><div className="badge">EARLY PREVIEW</div></header><section className="workspace"><section className="pane text-pane"><div className="pane-heading"><div><span className="eyebrow">SOURCE</span><h1>Text editor</h1></div><span className="file-badge">CLASS DIAGRAM</span></div><p className="hint">Describe your diagram here. Your canvas updates as you type.</p><Editor initialText={initialText} onChange={change} selection={selection} hiddenNames={hiddenNames} /><div className="status" aria-live="polite"><span className="dot" />{message}</div></section><section className="pane graph-pane"><div className="pane-heading"><div><span className="eyebrow">PREVIEW</span><h2>Diagram canvas</h2></div><span className="file-badge">LIVE VIEW</span></div><p className="hint">A visual projection of your text.</p><Canvas diagram={diagram} knownClasses={knownClasses} partialRetention={partialRetention} visible={visible} onSelect={select} /></section></section></main>;
}

type LoadStateT = { status: 'loading' } | { status: 'error' } | {
  status: 'ready';
  text: string;
  diagram: Diagram;
  classes: readonly ClassDetails[] };
function App() {
  const [state, setState]: [LoadStateT, React.Dispatch<React.SetStateAction<LoadStateT>>] = useState<LoadStateT>({ status: 'loading' });
  useEffect(() => {
    const controller: AbortController = new AbortController();
    loadClassDetails(controller.signal).then((details: ClassDetails[]): void => {
      // UNTRUST-ALLOW-NULLISH: A server response can omit the requested class and Array.find returns undefined in that case; the guard produces a visible loading error.
      const found: ClassDetails | undefined = details.find((item: ClassDetails): boolean => item.name === 'ClassDiagram');
      if (!found) { setState({ status: 'error' }); return; }
      const text: string = classDetailsToText(found);
      const parsed: ParseResultT = parseDiagram(text);
      setState(parsed.ok ? {
        status: 'ready',
        text,
        diagram: parsed.diagram,
        classes: details.filter((item: ClassDetails): boolean => item.name !== found.name) } : { status: 'error' });
    }).catch((): void => { if (!controller.signal.aborted) setState({ status: 'error' }); });
    return () => controller.abort();
  }, []);
  if (state.status === 'loading') return <main role="status">Loading class details…</main>;
  if (state.status === 'error') return <main role="alert">Could not load class details. Check that the server is running and reload.</main>;
  return <Workspace initialText={state.text} initial={state.diagram} knownClasses={state.classes} />;
}

// UNTRUST-ALLOW-NULLISH: The browser DOM API returns null when the mount element is absent; the following guard prevents passing an absent element to React and does not expose that value outside this boundary.
const ROOT: HTMLElement | null = document.getElementById('root');
if (ROOT) createRoot(ROOT).render(<App />);
