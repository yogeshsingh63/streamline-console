// ─────────────────────────────────────────────────────────────
// Protocol type definitions for the Agent Console client.
// Mirrors the agent-server protocol types exactly.
// ─────────────────────────────────────────────────────────────

// ── Server → Client Messages ──────────────────────────────────

export interface TokenMessage {
  type: "TOKEN";
  seq: number;
  text: string;
  stream_id: string;
}

export interface ToolCallMessage {
  type: "TOOL_CALL";
  seq: number;
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  stream_id: string;
}

export interface ToolResultMessage {
  type: "TOOL_RESULT";
  seq: number;
  call_id: string;
  result: Record<string, unknown>;
  stream_id: string;
}

export interface ContextSnapshotMessage {
  type: "CONTEXT_SNAPSHOT";
  seq: number;
  context_id: string;
  data: Record<string, unknown>;
}

export interface PingMessage {
  type: "PING";
  seq: number;
  challenge: string;
}

export interface StreamEndMessage {
  type: "STREAM_END";
  seq: number;
  stream_id: string;
}

export interface ErrorMessage {
  type: "ERROR";
  seq: number;
  code: string;
  message: string;
}

export type ServerMessage =
  | TokenMessage
  | ToolCallMessage
  | ToolResultMessage
  | ContextSnapshotMessage
  | PingMessage
  | StreamEndMessage
  | ErrorMessage;

// ── Client → Server Messages ──────────────────────────────────

export interface UserMessagePayload {
  type: "USER_MESSAGE";
  content: string;
}

export interface PongPayload {
  type: "PONG";
  echo: string;
}

export interface ResumePayload {
  type: "RESUME";
  last_seq: number;
}

export interface ToolAckPayload {
  type: "TOOL_ACK";
  call_id: string;
}

export type ClientMessage =
  | UserMessagePayload
  | PongPayload
  | ResumePayload
  | ToolAckPayload;

// ── Connection State Machine ──────────────────────────────────

export enum ConnectionState {
  /** No connection established */
  DISCONNECTED = "DISCONNECTED",
  /** WebSocket is opening */
  CONNECTING = "CONNECTING",
  /** WebSocket is open, waiting for RESUME or first interaction */
  CONNECTED = "CONNECTED",
  /** Sent RESUME, waiting for replay to complete */
  RESUMING = "RESUMING",
  /** Ready for user interaction */
  READY = "READY",
  /** Agent is streaming a response */
  STREAMING = "STREAMING",
  /** Stream paused, waiting for TOOL_RESULT */
  TOOL_PENDING = "TOOL_PENDING",
  /** Connection lost, attempting reconnection with backoff */
  RECONNECTING = "RECONNECTING",
}

// ── Stream & Tool Call State ──────────────────────────────────

export type ToolCallStatus = "pending_ack" | "waiting_result" | "complete";

export interface ToolCallState {
  callId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  result?: Record<string, unknown>;
  /** Token index where the tool call interrupted the stream */
  insertionIndex: number;
  seq: number;
}

export type StreamStatus = "streaming" | "paused_tool" | "complete";

export interface StreamState {
  streamId: string;
  tokens: string[];
  renderedText: string;
  status: StreamStatus;
  toolCalls: ToolCallState[];
}

// ── Chat Message Types ────────────────────────────────────────

export interface UserChatMessage {
  role: "user";
  content: string;
  timestamp: number;
}

export interface AgentChatMessage {
  role: "agent";
  streamId: string;
  timestamp: number;
}

export type ChatMessage = UserChatMessage | AgentChatMessage;

// ── Trace Timeline Types ──────────────────────────────────────

export interface TraceEntry {
  id: string;
  type: ServerMessage["type"];
  seq: number;
  timestamp: number;
  data: Record<string, unknown>;
  /** For TOKEN batch groups */
  batchCount?: number;
  batchText?: string;
  batchDurationMs?: number;
  /** For linking to DOM elements */
  streamId?: string;
  callId?: string;
}

// ── Context Inspector Types ───────────────────────────────────

export interface DiffEntry {
  path: string[];
  type: "added" | "removed" | "changed";
  oldValue?: unknown;
  newValue?: unknown;
}

export interface ContextSnapshot {
  seq: number;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface ContextHistory {
  contextId: string;
  snapshots: ContextSnapshot[];
  currentIndex: number;
  currentDiff: DiffEntry[] | null;
}
