import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

describe('signature formatter source', () => {
  it('has valid TypeScript syntax before Vite transforms it', () => {
    const sourcePath: string = fileURLToPath(new URL('../src/signatures.ts', import.meta.url));
    const source: string = readFileSync(sourcePath, 'utf8');
    const parsedSource: ts.SourceFile = ts.createSourceFile(
      sourcePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const syntaxErrors: readonly ts.Diagnostic[] = parsedSource.parseDiagnostics;

    expect(syntaxErrors.map((diagnostic: ts.Diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([]);
  });
});
