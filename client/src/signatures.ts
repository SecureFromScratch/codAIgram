export interface Parameter {
  name: string;
  type: string;
}
export interface MemberDisplay {
  text: string;
  tooltip: string;
  parameters?: readonly Parameter[];
}

/** Formats the preview's simple method syntax; unrecognized text remains unchanged. */
export function formatMember(member: string): MemberDisplay {
  const method: RegExpMatchArray | string[] = member.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/) ?? [];
  const name: string = method.at(1) ?? '';
  const argumentText: string = method.at(2) ?? '';
  if (!name) return { text: member, tooltip: member };
  if (!argumentText.trim()) return {
    text: name,
    tooltip: `${name}()`,
    parameters: [] };
  const argumentsList: string[] = [];
  let depth: number = 0;
  let start: number = 0;
  for (let position: number = 0; position < argumentText.length; position++) {
    const character: string = argumentText.charAt(position);
    if (character === '<' || character === '[' || character === '(') depth++;
    if (character === '>' || character === ']' || character === ')') depth--;
    if (depth < 0) return { text: name, tooltip: member };
    if (character === ',' && depth === 0) { argumentsList.push(argumentText.slice(start, position)); start = position + 1; }
  }
  if (depth !== 0) return { text: name, tooltip: member };
  argumentsList.push(argumentText.slice(start));
  const names: string[] = [];
  const parameters: Parameter[] = [];
  for (let index: number = 0; index < argumentsList.length; index++) {
    const argument: string = argumentsList.at(index) ?? '';
    const match: RegExpMatchArray | string[] = argument.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?)\s*$/) ?? [];
    const parameterName: string = match.at(1) ?? '';
    const type: string = match.at(2) ?? '';
    if (!parameterName && /^[A-Z][A-Za-z0-9_]*(?:\[\])?$/.test(argument.trim())) {
      names.push(argument.trim());
      continue;
    }
    if (!parameterName || !type) return { text: name, tooltip: member };
    names.push(parameterName);
    parameters.push({ name: parameterName, type });
  }
  const tooltip: string = [`${name}(${names.join(', ')})`, ...parameters.map((parameter: Parameter) => `-${parameter.name}: ${parameter.type}`)].join('\n');
  return { text: name, tooltip, parameters };
}
