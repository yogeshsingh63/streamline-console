// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** WebSocket server URL */
export const WS_URL = "ws://localhost:4747/ws";

/** Health check endpoint */
export const HEALTH_URL = "http://localhost:4747/health";

/** Server log endpoint */
export const LOG_URL = "http://localhost:4747/log";

// ── Reconnection ────────────────────────────────────────────

/** Initial reconnection delay in ms */
export const RECONNECT_INITIAL_DELAY_MS = 500;

/** Maximum reconnection delay in ms */
export const RECONNECT_MAX_DELAY_MS = 10_000;

/** Backoff multiplier */
export const RECONNECT_BACKOFF_MULTIPLIER = 2;

/** Maximum reconnection attempts before giving up */
export const RECONNECT_MAX_ATTEMPTS = 20;

// ── Protocol Timeouts ───────────────────────────────────────

/** Max time to send TOOL_ACK after receiving TOOL_CALL (ms) */
export const TOOL_ACK_DEADLINE_MS = 2_000;

/** Time to show reconnection indicator after drop (ms) */
export const RECONNECT_INDICATOR_DELAY_MS = 500;

// ── Timeline ────────────────────────────────────────────────

/** Debounce time for batching consecutive TOKEN events in trace (ms) */
export const TOKEN_BATCH_DEBOUNCE_MS = 200;

/** Maximum timeline entries before pruning oldest */
export const MAX_TIMELINE_ENTRIES = 5_000;
