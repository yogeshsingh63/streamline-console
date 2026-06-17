// ─────────────────────────────────────────────────────────────
// Context Store (Zustand)
//
// Manages context snapshots, computes diffs between versions,
// and supports the history scrubber.
// ─────────────────────────────────────────────────────────────

import { create } from "zustand";
import {
  ContextHistory,
  ContextSnapshot,
  ContextSnapshotMessage,
  DiffEntry,
} from "@/protocol/types";
import { computeDiff } from "@/lib/json-diff";

interface ContextStoreState {
  contexts: Map<string, ContextHistory>;
  /** Which context_id tab is currently active */
  activeContextId: string | null;

  // Actions
  handleContextSnapshot: (msg: ContextSnapshotMessage) => void;
  setActiveContext: (contextId: string) => void;
  scrubTo: (contextId: string, index: number) => void;
  reset: () => void;
}

export const useContextStore = create<ContextStoreState>((set, get) => ({
  contexts: new Map(),
  activeContextId: null,

  handleContextSnapshot: (msg) => {
    set((state) => {
      const contexts = new Map(state.contexts);
      const existing = contexts.get(msg.context_id);

      const snapshot: ContextSnapshot = {
        seq: msg.seq,
        timestamp: Date.now(),
        data: msg.data,
      };

      if (!existing) {
        // First snapshot for this context_id
        const history: ContextHistory = {
          contextId: msg.context_id,
          snapshots: [snapshot],
          currentIndex: 0,
          currentDiff: null,
        };
        contexts.set(msg.context_id, history);

        return {
          contexts,
          activeContextId: state.activeContextId ?? msg.context_id,
        };
      }

      // Compute diff against previous snapshot
      const prevSnapshot = existing.snapshots[existing.snapshots.length - 1];
      let diff: DiffEntry[] | null = null;
      try {
        diff = computeDiff(prevSnapshot.data, msg.data);
      } catch (e) {
        console.error("[context-store] Diff computation failed:", e);
      }

      const updatedHistory: ContextHistory = {
        ...existing,
        snapshots: [...existing.snapshots, snapshot],
        currentIndex: existing.snapshots.length, // Point to new snapshot
        currentDiff: diff,
      };
      contexts.set(msg.context_id, updatedHistory);

      return { contexts };
    });
  },

  setActiveContext: (contextId) => {
    set({ activeContextId: contextId });
  },

  scrubTo: (contextId, index) => {
    set((state) => {
      const contexts = new Map(state.contexts);
      const history = contexts.get(contextId);

      if (!history || index < 0 || index >= history.snapshots.length) {
        return state;
      }

      let diff: DiffEntry[] | null = null;
      if (index > 0) {
        try {
          diff = computeDiff(
            history.snapshots[index - 1].data,
            history.snapshots[index].data
          );
        } catch (e) {
          console.error("[context-store] Scrub diff failed:", e);
        }
      }

      contexts.set(contextId, {
        ...history,
        currentIndex: index,
        currentDiff: diff,
      });

      return { contexts };
    });
  },

  reset: () => {
    set({ contexts: new Map(), activeContextId: null });
  },
}));
