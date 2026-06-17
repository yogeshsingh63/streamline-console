import { describe, it, expect } from "vitest";
import { computeDiff } from "../lib/json-diff";

describe("JSON Diff Engine", () => {
  it("should return empty diff when objects are equal", () => {
    const obj = { a: 1, b: "hello", c: [1, 2] };
    const diffs = computeDiff(obj, obj);
    expect(diffs).toEqual([]);
  });

  it("should handle null oldObj by marking all keys as added", () => {
    const newObj = { a: 1, b: "hello" };
    const diffs = computeDiff(null, newObj);
    expect(diffs).toEqual([
      { path: ["a"], type: "added", newValue: 1 },
      { path: ["b"], type: "added", newValue: "hello" },
    ]);
  });

  it("should detect added keys", () => {
    const oldObj = { a: 1 };
    const newObj = { a: 1, b: "added" };
    const diffs = computeDiff(oldObj, newObj);
    expect(diffs).toEqual([
      { path: ["b"], type: "added", newValue: "added" },
    ]);
  });

  it("should detect removed keys", () => {
    const oldObj = { a: 1, b: "removed" };
    const newObj = { a: 1 };
    const diffs = computeDiff(oldObj, newObj);
    expect(diffs).toEqual([
      { path: ["b"], type: "removed", oldValue: "removed" },
    ]);
  });

  it("should detect changed primitives", () => {
    const oldObj = { a: 1, b: "old" };
    const newObj = { a: 2, b: "new" };
    const diffs = computeDiff(oldObj, newObj);
    expect(diffs).toContainEqual({ path: ["a"], type: "changed", oldValue: 1, newValue: 2 });
    expect(diffs).toContainEqual({ path: ["b"], type: "changed", oldValue: "old", newValue: "new" });
  });

  it("should diff nested objects", () => {
    const oldObj = { nested: { a: 1, b: 2 } };
    const newObj = { nested: { a: 1, b: 3, c: 4 } };
    const diffs = computeDiff(oldObj, newObj);
    expect(diffs).toContainEqual({ path: ["nested", "b"], type: "changed", oldValue: 2, newValue: 3 });
    expect(diffs).toContainEqual({ path: ["nested", "c"], type: "added", newValue: 4 });
  });

  it("should diff arrays by indices", () => {
    const oldObj = { arr: [1, 2] };
    const newObj = { arr: [1, 3, 4] };
    const diffs = computeDiff(oldObj, newObj);
    expect(diffs).toContainEqual({ path: ["arr", "1"], type: "changed", oldValue: 2, newValue: 3 });
    expect(diffs).toContainEqual({ path: ["arr", "2"], type: "added", newValue: 4 });
  });
});
