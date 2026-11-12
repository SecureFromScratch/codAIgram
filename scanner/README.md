# Scanner

Scanner is a command-line project inventory tool.

Build it with `npm run build`, then scan a project with:

```text
npm run start -- <project-name> <folder[,folder...]> --types <test|class|test,class> [--server-url <url>]
```

Each run truncates `scanner.log` in the current directory. Use `--logfile <path>` to select a separate log file for concurrent runs or to retain a previous run; the selected file is also truncated. The log records discovered cases and their metadata, scan and upload events, and errors. Logs can therefore contain prompts and paths; protect them accordingly. If the log cannot be opened, the scanner reports the failure on stderr and exits.

`--server-url` is optional. A `test` scan uploads discovered test cases to
`/api/updateTests`; a `class` scan uploads discovered declarations to
`/api/updateClasses`. Both uploads are logged.

List folders separated by commas to scan them together, for example
`npm run start -- codaigram-server ../server,../shared --types class`.
Repeated or nested folders are scanned once. Duplicate class names or test
case identities across different folders cause an error before uploading.

`test` recursively finds
`*.test.*` test-group files and `*.case.*` test-case files. A case belongs to
the nearest ancestor directory containing a group file. Output is sorted and
uses these records:

```text
TEST GROUP <group-name>
TEST CASE <group-name>.<case-name>
  DESCRIPTION <test description>
  PROMPT <generating prompt, or unavailable reason>
```

The required project name is validated and retained as scan identity for
future output formats; it is not emitted in the initial record format.

`class` recursively parses TypeScript/JavaScript source files and reports named
class and interface declarations:

```text
CLASS Task
INTERFACE TaskContract
```

Interfaces are included in the `class` scan. Only property types with a stable
named declaration target become `UNK` relationships. Direct references are
single; arrays and generic holding containers such as `Queue<T>` are multiple.
Inline structural types remain member/property `t` values as recursive
composites and never create a relationship.
