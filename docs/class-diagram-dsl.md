# Class diagram DSL, version 0

The editor text describes selected classes, properties, methods and outgoing relationships. This is the current small language, not a TypeScript or Java parser. Valid editor changes update the in-memory document, from which the diagram is projected; classes hidden from the editor remain in the document.

```text
ClassDiagram
  addClass(name: string, publicMethods: string[])
  addPartialClass(name: string)
  connectClasses(
    from: string,
    to: string,
    connectionType: ConnectionType,
    arity: integer
    )
  recalcLayout()
OWNS classes: Class[]
```

## Syntax

The first nonblank line is a class name: an ASCII letter or underscore, followed by zero or more ASCII letters, digits, or underscores. Further class declarations start with an unindented name and must be separated from the preceding class by at least one blank line. Names must be unique. A class with just its name is partial. Blank lines within declarations remain allowed.

An unresolved partial class referenced by a visible class can be declared and completed directly. A declaration that conflicts with a hidden existing class is underlined in red; append `@` to that class name on its own line to replace the marker with the stored class definition and edit it. The `@` is an editor command, not part of the DSL or the class name. Unknown names do not invoke the command.

After the class name, each nonblank declaration is one of:

```text
method       = two-spaces, identifier, optional-space, "(", parameters, ")"
parameters   = empty | parameter, { ",", parameter }
parameter    = identifier, optional-space, ":", optional-space, type-text
             | capitalized-type-name
property     = two-spaces, identifier, optional-space, ":", optional-space, type-text
relationship = optional-space, relationship-kind, space,
               [ identifier, optional-space, ":", optional-space ],
               identifier, optional-space, [ "[", optional-space, "]" ]
relationship-kind = "OWNS" | "REF" | "UNK"
```

`identifier` follows the class-name character rules. Spaces and blank lines may be used between declarations and around punctuation. Each method starts with exactly two ASCII spaces. While its parentheses remain open, a method can continue on subsequent nonblank lines, each indented at least four ASCII spaces. Tabs do not count as indentation. Continuation lines and blank lines do not create additional methods.

Properties are read-only by default and must have a colon and a nonempty type. A method argument can omit its name when it is a capitalized type, as in `addModification(ModificationRecord)`. An inline enum may be written `[AI, Human, Scan]`; this is DSL-specific, not TypeScript syntax. A TypeScript-style alternative would be a string-literal union such as `"AI" | "Human" | "Scan"`. `type-text` is currently display text, not a type-checked expression or registry lookup. Commas separate parameters except inside balanced angle brackets, square brackets, or parentheses. Names are case-sensitive. Comments, return types, and modifiers are not defined by this version.

## Meaning and rendering

Each method is displayed as its name. Its tooltip shows the signature with parameter names and lists their types separately. `OWNS classes: Class[]` denotes a one-to-many ownership relationship: the `Class` target is connected by a filled diamond at the owner, with `classes` on the connector and `*` at the target. `REF` denotes a directed reference, while `UNK` denotes a dashed connection whose relationship semantics are explicitly unknown. Without `[]` the relationship is singular and has no `*`. Without the member name and colon (for example, `OWNS Class[]`), the connector has no member label. Relationship declarations are not displayed as methods.

Invalid method declarations, indentation, and incomplete signatures receive a red wavy underline, leave the editor text untouched, and retain the last valid diagram. A missing class name is indicated by a red wavy-underlined placeholder on the empty line; the placeholder is not part of the text. Relationship edits update the diagram even while incomplete: a missing or mangled relationship keyword removes its link and underlines the declaration in red; a missing target type shows `?` and removes an unreferenced partial target, while a non-partial target remains. Correcting the text restores the link. Highlighting is applied to the current text even during incomplete edits: the class line is bold, italic, and underlined; relationship keywords are black and bold; method names, parameters, types, and punctuation have distinct TypeScript-inspired colors, with argument names in italics. The editor does not visually wrap lines.

The startup API currently populates the document from class details, but subsequent edits are not persisted. Click a graph class to toggle its editor visibility; double-click to show only that class. Eye badges mark classes shown in the editor. Invalid drafts must be corrected before switching the selection. Stable IDs, fuller type parsing, and a formal incremental parser are future work.
