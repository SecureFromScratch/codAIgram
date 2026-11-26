export interface Parameter {
  name: string;
  type: string;
  aliasExpansion?: string;
}
export interface MemberDisplay {
  text: string;
  tooltip: string;
  parameters?: readonly Parameter[];
  aliasExpansion?: string;
}

function displayType(type: string): string {
  let result: string = type.replace(/\breadonly\s+/g, '');
  let previous: string = '';
  while (result !== previous) {
    previous = result;
    result = result.replace(/\bReadonly\s*<([^<>]*)>/g, '$1');
  }
  return result;
}

/** Formats the preview's simple method syntax; unrecognized text remains unchanged. */
export function formatMember(member: string, writableFields: readonly string[] = [], delegateTypes: readonly string[] = [], aliasTypes: ReadonlyMap<string, string> = new Map<string, string>()): MemberDisplay {
  const method: RegExpMatchArray | string[] = member.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*$/) ?? [];
  const name: string = method.at(1) ?? '';
  const argumentText: string = method.at(2) ?? '';
  const methodLabel: string = `${name}()`;
  if (!name) {
    const field: RegExpMatchArray | string[] = member.match(/^(\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*)(.*)$/) ?? [];
    const fieldName: string = (field.at(1) ?? '').trim().replace(/\s*:\s*$/, '');
    const prefix: string = writableFields.includes(fieldName) ? '\u{270F}\u{FE0F}' : '';
    const rawType: string = field.at(2) ?? '';
    const delegateType: boolean = delegateTypes.some((delegate: string) => rawType.trim() === delegate);
    const functionType: boolean = rawType.includes('=>') || delegateType;
    const text: string = field.length ? `${functionType ? '\u{26A1}' : ''}${prefix}${(field.at(1) ?? '').trimStart()}${displayType(rawType)}` : member;
    return { text, tooltip: text };
  }
  if (!argumentText.trim()) return {
    text: methodLabel,
    tooltip: `${name}()`,
    parameters: [] };
  const argumentsList: string[] = [];
  let depth: number = 0;
  let start: number = 0;
  for (let position: number = 0; position < argumentText.length; position++) {
    const character: string = argumentText.charAt(position);
    if (character === '<' || character === '[' || character === '(') depth++;
    if ((character === '>' && argumentText.charAt(position - 1) !== '=') || character === ']' || character === ')') depth--;
    if (depth < 0) return { text: methodLabel, tooltip: member };
    if (character === ',' && depth === 0) { argumentsList.push(argumentText.slice(start, position)); start = position + 1; }
  }
  if (depth !== 0) return { text: methodLabel, tooltip: member };
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
    if (!parameterName || !type) return { text: methodLabel, tooltip: member };
    names.push(parameterName);
    const functionType: boolean = type.includes('=>') || delegateTypes.some((delegate: string) => type.trim() === delegate);
    const mutable: boolean = !functionType && !/^(?:readonly\b|Readonly\s*<|ReadonlyArray\s*<)/.test(type) && !/^(?:string|number|boolean|bigint|symbol|undefined|null|void|never|unknown|any|integer|positive|datetime)(?:\s*\|\s*(?:string|number|boolean))*$/.test(type);
    const parameter: Parameter = {
      name: parameterName,
      type: `${mutable ? '\u{270F}\u{FE0F}' : ''}${displayType(type)}`,
    };
    if (functionType) parameter.type = `\u{26A1}${parameter.type}`;
    const aliasType: string | undefined = aliasTypes.get(type.trim());
    if (aliasType) parameter.aliasExpansion = `         (\u{1F3AD}${aliasType})`;
    parameters.push(parameter);
  }
  const tooltipLines: string[] = [`${name}(${names.join(', ')})`];
  parameters.forEach((parameter: Parameter) => {
    tooltipLines.push(`-${parameter.name}: ${parameter.type}`);
    if (parameter.aliasExpansion) tooltipLines.push(parameter.aliasExpansion);
  });
  const tooltip: string = tooltipLines.join('\n');
  return { text: methodLabel, tooltip, parameters };
}
