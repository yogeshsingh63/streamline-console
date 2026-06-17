// ─────────────────────────────────────────────────────────────
// Trace Store (Zustand)
//
// Stores all protocol events for the trace timeline.
// Batches consecutive TOKEN events into grouped entries.
// ─────────────────────────────────────────────────────────────

import { create } from "zustand";
import { TraceEntry, ServerMessage } from "@/protocol/types";
import { TOKEN_BATCH_DEBOUNCE_MS, MAX_TIMELINE_ENTRIES } from "@/lib/constants";

interface TraceStoreState {
  entries: TraceEntry[];
  /** Active token batch being accumulated */
  activeBatch: TraceEntry | null;
  /** Filter by event types */
  activeFilters: Set<string>;
  /** Search text filter */
  searchText: string;
  /** Highlighted entry ID (for bidirectional linking) */
  highlightedEntryId: string | null;

  // Actions
  addEvent: (msg: ServerMessage) => void;
  flushBatch: () => void;
  setFilters: (filters: Set<string>) => void;
  setSearchText: (text: string) => void;
  setHighlightedEntry: (id: string | null) => void;
  reset: () => void;
}

let batchTimeout: ReturnType<typeof setTimeout> | null = null;
let entryCounter = 0;

function makeEntryId(): string {
  return `trace_${++entryCounter}_${Date.now()}`;
}

export const useTraceStore = create<TraceStoreState>((set, get) => ({
  entries: [],
  activeBatch: null,
  activeFilters: new Set(),
  searchText: "",
  highlightedEntryId: null,

  addEvent: (msg) => {
    const state = get();

    // For TOKEN events, batch them
    if (msg.type === "TOKEN") {
      if (batchTimeout) {
        clearTimeout(batchTimeout);
      }

      const existing = state.activeBatch;
      if (existing && existing.streamId === msg.stream_id) {
        // Extend existing batch
        const updated: TraceEntry = {
          ...existing,
          batchCount: (existing.batchCount ?? 1) + 1,
          batchText: (existing.batchText ?? "") + msg.text,
          batchDurationMs: Date.now() - existing.timestamp,
          data: { ...existing.data, lastSeq: msg.seq },
        };
        set({ activeBatch: updated });
      } else {
        // Flush previous batch if exists, start new one
        if (existing) {
          get().flushBatch();
        }
        const newBatch: TraceEntry = {
          id: makeEntryId(),
          type: "TOKEN",
          seq: msg.seq,
          timestamp: Date.now(),
          data: { text: msg.text, firstSeq: msg.seq },
          batchCount: 1,
          batchText: msg.text,
          batchDurationMs: 0,
          streamId: msg.stream_id,
        };
        set({ activeBatch: newBatch });
      }

      // Auto-flush after debounce
      batchTimeout = setTimeout(() => {
        get().flushBatch();
      }, TOKEN_BATCH_DEBOUNCE_MS);

      return;
    }

    // Flush any pending token batch before adding non-token event
    if (state.activeBatch) {
      get().flushBatch();
    }

    // Create entry for non-TOKEN events
    const entry: TraceEntry = {
      id: makeEntryId(),
      type: msg.type,
      seq: msg.seq,
      timestamp: Date.now(),
      data: msg as unknown as Record<string, unknown>,
      streamId: "stream_id" in msg ? (msg.stream_id as string) : undefined,
      callId: "call_id" in msg ? (msg.call_id as string) : undefined,
    };

    set((state) => {
      let entries = [...state.entries, entry];
      // Prune if over limit
      if (entries.length > MAX_TIMELINE_ENTRIES) {
        entries = entries.slice(entries.length - MAX_TIMELINE_ENTRIES);
      }
      return { entries };
    });
  },

  flushBatch: () => {
    const batch = get().activeBatch;
    if (!batch) return;

    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }

    set((state) => {
      let entries = [...state.entries, batch];
      if (entries.length > MAX_TIMELINE_ENTRIES) {
        entries = entries.slice(entries.length - MAX_TIMELINE_ENTRIES);
      }
      return { entries, activeBatch: null };
    });
  },

  setFilters: (activeFilters) => set({ activeFilters }),
  setSearchText: (searchText) => set({ searchText }),
  setHighlightedEntry: (highlightedEntryId) => set({ highlightedEntryId }),

  reset: () => {
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }
    entryCounter = 0;
    set({
      entries: [],
      activeBatch: null,
      activeFilters: new Set(),
      searchText: "",
      highlightedEntryId: null,
    });
  },
}));
