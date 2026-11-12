# Shared infrastructure

Reserved for infrastructure shared by Codaigram projects.
# Shared infrastructure

This project holds infrastructure used by the client, server, and scanner.

## `JsonMap<TKey, TValue>`

`JsonMap` is the shared representation for keyed values that must remain a
`Map` in application code but cross JSON boundaries as JSON objects.

- Use `JsonMap.fromJson(value, parseKey, parseValue, logAndThrow)` after
  validating an untrusted JSON object. The owning application supplies its
  logger through `logAndThrow`, so malformed boundary data is logged in that
  application rather than silently thrown by shared infrastructure.
- `JSON.stringify` calls `toJSON()` automatically and produces a keyed JSON
  object, including recursively when values are themselves `JsonMap`s.
- Serialization creates a null-prototype object and uses `Object.defineProperty`
  for every key. Consequently `__proto__`, `constructor`, and similar strings
  remain ordinary data keys; no dynamic assignment or object merge is used.

The root TypeScript solution builds `shared` before the client, server, and
scanner. Consumers import it as `@codaigram/shared/json-map`. Run `npm install`
at the project root to link the workspace package, and build the TypeScript
solution before running a consumer so the package's `dist` files exist.
