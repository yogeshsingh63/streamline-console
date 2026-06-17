"use client";

import React, { useState, useMemo } from "react";
import { useContextStore } from "@/stores/context-store";
import type { DiffEntry, ContextHistory } from "@/protocol/types";
import styles from "./ContextInspector.module.css";

export default function ContextInspector() {
  const contexts = useContextStore((s) => s.contexts);
  const activeContextId = useContextStore((s) => s.activeContextId);
  const setActiveContext = useContextStore((s) => s.setActiveContext);
  const scrubTo = useContextStore((s) => s.scrubTo);

  const contextIds = useMemo(() => Array.from(contexts.keys()), [contexts]);
  const activeHistory = activeContextId
    ? contexts.get(activeContextId)
    : undefined;

  if (contextIds.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>Context</span>
        </div>
        <div className={styles.emptyState}>No context snapshots yet</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Context</span>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {contextIds.map((id) => (
          <button
            key={id}
            className={`${styles.tab} ${
              id === activeContextId ? styles.tabActive : ""
            }`}
            onClick={() => setActiveContext(id)}
          >
            {id}
          </button>
        ))}
      </div>

      {activeHistory && (
        <ContextView
          history={activeHistory}
          onScrub={(index) => scrubTo(activeHistory.contextId, index)}
        />
      )}
    </div>
  );
}

// ── Context View with Scrubber + Tree ───────────────────────

function ContextView({
  history,
  onScrub,
}: {
  history: ContextHistory;
  onScrub: (index: number) => void;
}) {
  const currentSnapshot = history.snapshots[history.currentIndex];
  const diff = history.currentDiff;

  // Build diff lookup for tree highlighting
  const diffMap = useMemo(() => {
    const map = new Map<string, DiffEntry>();
    if (diff) {
      for (const d of diff) {
        map.set(d.path.join("."), d);
      }
    }
    return map;
  }, [diff]);

  // Diff summary stats
  const diffStats = useMemo(() => {
    if (!diff) return null;
    const added = diff.filter((d) => d.type === "added").length;
    const removed = diff.filter((d) => d.type === "removed").length;
    const changed = diff.filter((d) => d.type === "changed").length;
    return { added, removed, changed };
  }, [diff]);

  return (
    <>
      {/* Scrubber */}
      {history.snapshots.length > 1 && (
        <div className={styles.scrubber}>
          <span className={styles.scrubberLabel}>
            {history.currentIndex + 1} / {history.snapshots.length}
          </span>
          <input
            type="range"
            className={styles.scrubberSlider}
            min={0}
            max={history.snapshots.length - 1}
            value={history.currentIndex}
            onChange={(e) => onScrub(parseInt(e.target.value, 10))}
          />
        </div>
      )}

      {/* Diff summary */}
      {diffStats && (diffStats.added > 0 || diffStats.removed > 0 || diffStats.changed > 0) && (
        <div className={styles.diffSummary}>
          {diffStats.added > 0 && (
            <span className={`${styles.diffStat} ${styles.diffAdded}`}>
              +{diffStats.added} added
            </span>
          )}
          {diffStats.removed > 0 && (
            <span className={`${styles.diffStat} ${styles.diffRemoved}`}>
              −{diffStats.removed} removed
            </span>
          )}
          {diffStats.changed > 0 && (
            <span className={`${styles.diffStat} ${styles.diffChanged}`}>
              ~{diffStats.changed} changed
            </span>
          )}
        </div>
      )}

      {/* JSON Tree */}
      <div className={styles.treeContainer}>
        {currentSnapshot && (
          <JsonTreeNode
            data={currentSnapshot.data}
            path={[]}
            diffMap={diffMap}
            depth={0}
          />
        )}
      </div>
    </>
  );
}

// ── JSON Tree Node (Recursive) ──────────────────────────────

function JsonTreeNode({
  data,
  path,
  diffMap,
  depth,
}: {
  data: unknown;
  path: string[];
  diffMap: Map<string, DiffEntry>;
  depth: number;
}) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  if (data === null || data === undefined) {
    return <span className={styles.treeNull}>null</span>;
  }

  if (typeof data === "string") {
    return (
      <span className={styles.treeString}>
        &quot;{data.length > 200 ? data.slice(0, 200) + "…" : data}&quot;
      </span>
    );
  }

  if (typeof data === "number") {
    return <span className={styles.treeNumber}>{data}</span>;
  }

  if (typeof data === "boolean") {
    return (
      <span className={styles.treeBoolean}>{data ? "true" : "false"}</span>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className={styles.treeBracket}>[]</span>;
    }

    return (
      <div className={styles.treeNode}>
        <span
          className={styles.treeBracket}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? `[…${data.length}]` : "["}
        </span>
        {!collapsed && (
          <>
            {data.map((item, i) => {
              const itemPath = [...path, String(i)];
              const pathKey = itemPath.join(".");
              const diffEntry = diffMap.get(pathKey);
              const rowClass = diffEntry
                ? diffEntry.type === "added"
                  ? styles.treeRowAdded
                  : diffEntry.type === "removed"
                  ? styles.treeRowRemoved
                  : styles.treeRowChanged
                : "";

              return (
                <div
                  key={i}
                  className={`${styles.treeRow} ${rowClass}`}
                  style={{ paddingLeft: (depth + 1) * 16 }}
                >
                  <span className={styles.treeKey}>{i}</span>
                  <span className={styles.treeColon}>:</span>
                  <JsonTreeNode
                    data={item}
                    path={itemPath}
                    diffMap={diffMap}
                    depth={depth + 1}
                  />
                </div>
              );
            })}
            <div style={{ paddingLeft: depth * 16 }}>
              <span className={styles.treeBracket}>]</span>
            </div>
          </>
        )}
      </div>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className={styles.treeBracket}>{"{}"}</span>;
    }

    return (
      <div className={styles.treeNode}>
        <span
          className={styles.treeBracket}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? `{…${entries.length}}` : "{"}
        </span>
        {!collapsed && (
          <>
            {entries.map(([key, value]) => {
              const itemPath = [...path, key];
              const pathKey = itemPath.join(".");
              const diffEntry = diffMap.get(pathKey);
              const rowClass = diffEntry
                ? diffEntry.type === "added"
                  ? styles.treeRowAdded
                  : diffEntry.type === "removed"
                  ? styles.treeRowRemoved
                  : styles.treeRowChanged
                : "";

              return (
                <div
                  key={key}
                  className={`${styles.treeRow} ${rowClass}`}
                  style={{ paddingLeft: (depth + 1) * 16 }}
                >
                  <span className={styles.treeKey}>&quot;{key}&quot;</span>
                  <span className={styles.treeColon}>:</span>
                  <JsonTreeNode
                    data={value}
                    path={itemPath}
                    diffMap={diffMap}
                    depth={depth + 1}
                  />
                </div>
              );
            })}
            <div style={{ paddingLeft: depth * 16 }}>
              <span className={styles.treeBracket}>{"}"}</span>
            </div>
          </>
        )}
      </div>
    );
  }

  return <span>{String(data)}</span>;
}
