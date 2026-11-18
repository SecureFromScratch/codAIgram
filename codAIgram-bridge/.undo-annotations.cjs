const fs = require("node:fs");
const path = require("node:path");
const root = process.cwd();
let total = 0;
function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const filePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (!["node_modules", "test-dist", ".vscode-test", ".test-ca"].includes(entry.name)) visit(filePath);
            continue;
        }
        if (!filePath.endsWith(".ts")) continue;
        let source = fs.readFileSync(filePath, "utf8");
        let edits = 0;
        const pattern = /\b(?:const|let)\s+([A-Za-z_$][\w$]*): /g;
        const replacements = [];
        for (const match of source.matchAll(pattern)) {
            const colon = match.index + match[0].lastIndexOf(":");
            const equals = source.indexOf(" = ", colon + 2);
            if (equals < 0) continue;
            let finalIdentifierIndex = equals - 1;
            while (finalIdentifierIndex > colon && /\s/.test(source[finalIdentifierIndex])) finalIdentifierIndex -= 1;
            if (!/[A-Za-z0-9_$]/.test(source[finalIdentifierIndex] ?? "")) continue;
            replacements.push({ start: colon, end: finalIdentifierIndex });
        }
        for (const replacement of replacements.reverse()) {
            source = `${source.slice(0, replacement.start)}${source.slice(replacement.end)}`;
            edits += 1;
        }
        if (edits > 0) {
            fs.writeFileSync(filePath, source);
            total += edits;
            console.log(`${filePath}: ${edits}`);
        }
    }
}
visit(path.join(root, "src"));
visit(path.join(root, "tests"));
console.log(`Recovered ${total} declarations.`);
