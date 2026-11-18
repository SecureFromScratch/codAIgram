const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");
const root = process.cwd().replaceAll("\\", "/").toLowerCase();
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const editsByFile = new Map();
for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.fileName.replaceAll("\\", "/").toLowerCase().startsWith(root) || sourceFile.isDeclarationFile) continue;
    const visit = (node) => {
        if (ts.isVariableDeclaration(node) && node.type === undefined && ts.isIdentifier(node.name) && node.initializer !== undefined) {
            const typeText = checker.typeToString(checker.getTypeAtLocation(node.name), node, ts.TypeFormatFlags.NoTruncation);
            if (typeText !== "any" && typeText !== "unknown") editsByFile.set(sourceFile.fileName, [...(editsByFile.get(sourceFile.fileName) ?? []), { position: node.name.end, text: `: ${typeText}` }]);
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
}
console.log(`Annotating ${[...editsByFile.values()].reduce((sum, edits) => sum + edits.length, 0)} locals.`);
for (const [fileName, edits] of editsByFile) {
    let source = fs.readFileSync(fileName, "utf8");
    edits.sort((left, right) => right.position - left.position);
    for (const edit of edits) source = `${source.slice(0, edit.position)}${edit.text}${source.slice(edit.position)}`;
    fs.writeFileSync(fileName, source);
}
