// ─────────────────────────────────────────────────────────────
// JSON Diff Engine
//
// Computes deep diffs between two arbitrary JSON objects.
// Returns an array of DiffEntry describing what changed.
// Handles nested objects, arrays, and primitives.
// ─────────────────────────────────────────────────────────────

import { DiffEntry } from "@/protocol/types";

/**
 * Compute the diff between two JSON objects.
 * Returns an array of changes (added, removed, changed keys).
 */
export function computeDiff(
  oldObj: Record<string, unknown> | null,
  newObj: Record<string, unknown>
): DiffEntry[] {
  const diffs: DiffEntry[] = [];

  if (!oldObj) {
    // Everything in newObj is "added"
    collectAll(newObj, [], "added", diffs);
    return diffs;
  }

  diffRecursive(oldObj, newObj, [], diffs, 0);
  return diffs;
}

const MAX_DEPTH = 50;

function diffRecursive(
  oldVal: unknown,
  newVal: unknown,
  path: string[],
  diffs: DiffEntry[],
  depth: number
): void {
  // Cycle protection
  if (depth > MAX_DEPTH) return;

  // Same reference or strictly equal
  if (oldVal === newVal) return;

  // Handle nulls/undefined
  if (oldVal === null || oldVal === undefined) {
    if (newVal !== null && newVal !== undefined) {
      diffs.push({ path: [...path], type: "added", newValue: newVal });
    }
    return;
  }

  if (newVal === null || newVal === undefined) {
    diffs.push({ path: [...path], type: "removed", oldValue: oldVal });
    return;
  }

  // Different types
  if (typeof oldVal !== typeof newVal) {
    diffs.push({
      path: [...path],
      type: "changed",
      oldValue: oldVal,
      newValue: newVal,
    });
    return;
  }

  // Both are arrays
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    diffArrays(oldVal, newVal, path, diffs, depth);
    return;
  }

  // Both are objects
  if (typeof oldVal === "object" && typeof newVal === "object") {
    const oldRecord = oldVal as Record<string, unknown>;
    const newRecord = newVal as Record<string, unknown>;
    const allKeys = new Set([
      ...Object.keys(oldRecord),
      ...Object.keys(newRecord),
    ]);

    for (const key of allKeys) {
      const keyPath = [...path, key];
      if (!(key in oldRecord)) {
        diffs.push({ path: keyPath, type: "added", newValue: newRecord[key] });
      } else if (!(key in newRecord)) {
        diffs.push({
          path: keyPath,
          type: "removed",
          oldValue: oldRecord[key],
        });
      } else {
        diffRecursive(
          oldRecord[key],
          newRecord[key],
          keyPath,
          diffs,
          depth + 1
        );
      }
    }
    return;
  }

  // Primitives (string, number, boolean)
  if (oldVal !== newVal) {
    diffs.push({
      path: [...path],
      type: "changed",
      oldValue: oldVal,
      newValue: newVal,
    });
  }
}

function diffArrays(
  oldArr: unknown[],
  newArr: unknown[],
  path: string[],
  diffs: DiffEntry[],
  depth: number
): void {
  const maxLen = Math.max(oldArr.length, newArr.length);

  for (let i = 0; i < maxLen; i++) {
    const indexPath = [...path, String(i)];
    if (i >= oldArr.length) {
      diffs.push({ path: indexPath, type: "added", newValue: newArr[i] });
    } else if (i >= newArr.length) {
      diffs.push({ path: indexPath, type: "removed", oldValue: oldArr[i] });
    } else {
      diffRecursive(oldArr[i], newArr[i], indexPath, diffs, depth + 1);
    }
  }
}

function collectAll(
  obj: unknown,
  path: string[],
  type: "added" | "removed",
  diffs: DiffEntry[]
): void {
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      diffs.push({
        path: [...path, key],
        type,
        newValue: type === "added" ? (obj as Record<string, unknown>)[key] : undefined,
        oldValue: type === "removed" ? (obj as Record<string, unknown>)[key] : undefined,
      });
    }
  } else {
    diffs.push({
      path,
      type,
      newValue: type === "added" ? obj : undefined,
      oldValue: type === "removed" ? obj : undefined,
    });
  }
}
