# Scanner

Scanner is a command-line project inventory tool.

Build it with `npm run build`, then scan a project with:

```text
npm run start -- <folder> <project-name> --types test
```

`test` is the only supported file type currently. The scanner recursively finds
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
