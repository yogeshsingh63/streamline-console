// ─────────────────────────────────────────────────────────────
// Connection Store (Zustand)
//
// Tracks WebSocket connection state, retry info, and seq numbers.
// ─────────────────────────────────────────────────────────────

import { create } from "zustand";
import { ConnectionState } from "@/protocol/types";

interface ConnectionStoreState {
  state: ConnectionState;
  retryCount: number;
  processedSeq: number;
  lastConnectedAt: number | null;

  // Actions
  setState: (state: ConnectionState) => void;
  setRetryCount: (count: number) => void;
  setProcessedSeq: (seq: number) => void;
  setLastConnectedAt: (ts: number) => void;
  reset: () => void;
}

export const useConnectionStore = create<ConnectionStoreState>((set) => ({
  state: ConnectionState.DISCONNECTED,
  retryCount: 0,
  processedSeq: 0,
  lastConnectedAt: null,

  setState: (state) => set({ state }),
  setRetryCount: (retryCount) => set({ retryCount }),
  setProcessedSeq: (processedSeq) => set({ processedSeq }),
  setLastConnectedAt: (lastConnectedAt) => set({ lastConnectedAt }),
  reset: () =>
    set({
      state: ConnectionState.DISCONNECTED,
      retryCount: 0,
      processedSeq: 0,
      lastConnectedAt: null,
    }),
}));
