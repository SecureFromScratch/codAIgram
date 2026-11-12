/**
 * A Map that has an explicit, safe JSON-object representation.
 *
 * It keeps arbitrary keys in a Map while in memory. Its JSON representation is
 * a null-prototype object populated with defineProperty, so keys such as
 * "__proto__" remain ordinary data rather than changing an object's prototype.
 */
export class JsonMap<TKey extends string, TValue> extends Map<TKey, TValue> {
  static fromJson<TKey extends string, TValue>(
    input: unknown,
    parseKey: (key: string) => TKey,
    parseValue: (value: unknown) => TValue,
    onInvalidInput: (error: Error) => never): JsonMap<TKey, TValue> {
    // UNTRUST-ALLOW-NULLISH: This is the generic JSON boundary guard; JSON can legally contain null, which must be rejected before iterating entries because only a non-array object can safely be converted into a JsonMap.
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return onInvalidInput(new Error('A JSON map must be a non-array object.'));
    }
    const result: JsonMap<TKey, TValue> = new JsonMap<TKey, TValue>();
    const entries: readonly [string, unknown][] = Object.entries(input);
    for (let index: number = 0; index < entries.length; index += 1) {
      const entry: [string, unknown] = entries[index]!;
      result.set(parseKey(entry[0]), parseValue(entry[1]));
    }
    return result;
  }

  toJSON(): object {
    // UNTRUST-ALLOW-NULLISH: A null-prototype object is intentional: it has no inherited __proto__ setter, so arbitrary Map keys stay data properties during JSON serialization rather than becoming prototype mutations.
    const output: object = Object.create(null);
    const entries: readonly [TKey, TValue][] = Array.from(this.entries());
    for (let index: number = 0; index < entries.length; index += 1) {
      const entry: [TKey, TValue] = entries[index]!;
      Object.defineProperty(output, entry[0], {
        configurable: false,
        enumerable: true,
        value: entry[1],
        writable: false });
    }
    return output;
  }
}
