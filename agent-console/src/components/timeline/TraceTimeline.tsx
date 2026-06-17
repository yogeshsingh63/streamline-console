"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useTraceStore } from "@/stores/trace-store";
import type { TraceEntry } from "@/protocol/types";
import styles from "./TraceTimeline.module.css";

const EVENT_TYPES = [
  "TOKEN",
  "TOOL_CALL",
  "TOOL_RESULT",
  "CONTEXT_SNAPSHOT",
  "PING",
  "ERROR",
  "STREAM_END",
] as const;

const BADGE_CLASSES: Record<string, string> = {
  TOKEN: styles.badgeToken,
  TOOL_CALL: styles.badgeToolCall,
  TOOL_RESULT: styles.badgeToolResult,
  CONTEXT_SNAPSHOT: styles.badgeContext,
  PING: styles.badgePing,
  ERROR: styles.badgeError,
  STREAM_END: styles.badgeStreamEnd,
};

export default function TraceTimeline() {
  const entries = useTraceStore((s) => s.entries);
  const activeFilters = useTraceStore((s) => s.activeFilters);
  const searchText = useTraceStore((s) => s.searchText);
  const highlightedEntryId = useTraceStore((s) => s.highlightedEntryId);
  const setFilters = useTraceStore((s) => s.setFilters);
  const setSearchText = useTraceStore((s) => s.setSearchText);
  const setHighlightedEntry = useTraceStore((s) => s.setHighlightedEntry);

  const listRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(
    new Set()
  );

  // Filter entries
  const filteredEntries = useMemo(() => {
    let result = entries;

    if (activeFilters.size > 0) {
      result = result.filter((e) => activeFilters.has(e.type));
    }

    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter((e) => {
        const content = getEventContent(e).toLowerCase();
        return content.includes(lower);
      });
    }

    return result;
  }, [entries, activeFilters, searchText]);

  // Auto-scroll
  useEffect(() => {
    if (isAutoScrollRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [filteredEntries]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    isAutoScrollRef.current = isAtBottom;
  }, []);

  const toggleFilter = useCallback(
    (type: string) => {
      const next = new Set(activeFilters);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      setFilters(next);
    },
    [activeFilters, setFilters]
  );

  const toggleBatch = useCallback((id: string) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Trace</span>
        <span className={styles.headerCount}>
          {filteredEntries.length} events
        </span>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        {EVENT_TYPES.map((type) => (
          <button
            key={type}
            className={`${styles.filterChip} ${
              activeFilters.has(type) ? styles.filterChipActive : ""
            }`}
            onClick={() => toggleFilter(type)}
          >
            {type.replace("_", " ")}
          </button>
        ))}
        <input
          className={styles.searchInput}
          placeholder="Search..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      {/* Event list */}
      <div
        className={styles.eventList}
        ref={listRef}
        onScroll={handleScroll}
      >
        {filteredEntries.length === 0 ? (
          <div className={styles.emptyState}>
            No events yet
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <React.Fragment key={entry.id}>
              <EventRow
                entry={entry}
                isHighlighted={
                  highlightedEntryId === entry.id ||
                  highlightedEntryId === entry.callId
                }
                isBatchExpanded={expandedBatches.has(entry.id)}
                onToggleBatch={() => toggleBatch(entry.id)}
                onHighlight={() => setHighlightedEntry(entry.id)}
              />
              {entry.type === "TOKEN" &&
                entry.batchText &&
                expandedBatches.has(entry.id) && (
                  <div className={styles.batchExpanded}>
                    {entry.batchText}
                  </div>
                )}
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
}

// ── Event Row ───────────────────────────────────────────────

function EventRow({
  entry,
  isHighlighted,
  isBatchExpanded,
  onToggleBatch,
  onHighlight,
}: {
  entry: TraceEntry;
  isHighlighted: boolean;
  isBatchExpanded: boolean;
  onToggleBatch: () => void;
  onHighlight: () => void;
}) {
  const handleClick = () => {
    if (entry.type === "TOKEN" && entry.batchCount) {
      onToggleBatch();
    } else {
      onHighlight();
    }
  };

  const content = getEventContent(entry);
  const badgeClass = BADGE_CLASSES[entry.type] ?? "";

  return (
    <div
      className={`${styles.eventRow} ${
        isHighlighted ? styles.eventRowHighlighted : ""
      }`}
      onClick={handleClick}
    >
      <span className={styles.eventSeq}>{entry.seq}</span>
      <span className={`${styles.eventBadge} ${badgeClass}`}>
        {entry.type === "TOKEN" ? (isBatchExpanded ? "▼ TOKEN" : "▶ TOKEN") : entry.type.replace("_", " ")}
      </span>
      <span className={styles.eventContent}>{content}</span>
      <span className={styles.eventTime}>
        {formatTime(entry.timestamp)}
      </span>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function getEventContent(entry: TraceEntry): string {
  switch (entry.type) {
    case "TOKEN":
      if (entry.batchCount && entry.batchCount > 1) {
        const dur = entry.batchDurationMs
          ? `${(entry.batchDurationMs / 1000).toFixed(1)}s`
          : "";
        return `Streamed ${entry.batchCount} tokens ${dur ? `(${dur})` : ""}`;
      }
      return entry.batchText ?? (entry.data?.text as string) ?? "";

    case "TOOL_CALL":
      return `${(entry.data as Record<string, unknown>)?.tool_name ?? "tool"} → ${JSON.stringify((entry.data as Record<string, unknown>)?.args ?? {})}`;

    case "TOOL_RESULT":
      return `${(entry.data as Record<string, unknown>)?.call_id ?? ""}: ${JSON.stringify((entry.data as Record<string, unknown>)?.result ?? {})}`.slice(0, 120);

    case "CONTEXT_SNAPSHOT":
      return `ctx: ${(entry.data as Record<string, unknown>)?.context_id ?? ""}`;

    case "PING":
      return `challenge: ${(entry.data as Record<string, unknown>)?.challenge ?? "(empty)"}`;

    case "ERROR":
      return `${(entry.data as Record<string, unknown>)?.code}: ${(entry.data as Record<string, unknown>)?.message}`;

    case "STREAM_END":
      return `stream ${entry.streamId ?? ""} ended`;

    default:
      return JSON.stringify(entry.data).slice(0, 80);
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
