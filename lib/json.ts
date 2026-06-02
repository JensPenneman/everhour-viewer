/**
 * A value that round-trips through `JSON.stringify` / `JSON.parse` losslessly.
 *
 * Use this wherever data crosses a JSON boundary (request bodies, opaque
 * stored blobs) and we want a type that says "this is JSON" without claiming
 * a shape we haven't validated. It is stricter and more honest than
 * `unknown` (rejects `Date`, `Map`, `undefined` fields, functions) and looser
 * than a concrete interface.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
