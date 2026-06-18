// ─────────────────────────────────────────────────────────────
// WebSocket Manager
//
// Manages the WebSocket connection lifecycle:
// - Connect / disconnect
// - Exponential backoff reconnection
// - RESUME on reconnect
// - Routes raw messages to the reorder buffer
// - Sends client messages (USER_MESSAGE, PONG, TOOL_ACK, RESUME)
// ─────────────────────────────────────────────────────────────

import {
  ServerMessage,
  ClientMessage,
  ConnectionState,
} from "./types";
import { ReorderBuffer } from "./reorder-buffer";
import { HeartbeatHandler } from "./heartbeat-handler";
import {
  WS_URL,
  RECONNECT_INITIAL_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  RECONNECT_BACKOFF_MULTIPLIER,
  RECONNECT_MAX_ATTEMPTS,
} from "@/lib/constants";

export type MessageHandler = (messages: ServerMessage[]) => void;
export type StateChangeHandler = (state: ConnectionState) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private retryCount: number = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private reorderBuffer: ReorderBuffer;
  private heartbeatHandler: HeartbeatHandler;

  private onMessages: MessageHandler | null = null;
  private onStateChange: StateChangeHandler | null = null;

  /** Whether we had a previous session (for RESUME logic) */
  private hadPreviousSession: boolean = false;
  private wasStreamingBeforeDisconnect: boolean = false;

  constructor() {
    this.reorderBuffer = new ReorderBuffer();
    this.heartbeatHandler = new HeartbeatHandler();

    // Wire heartbeat to send via our WebSocket
    this.heartbeatHandler.setSendFn((pong) => {
      this.send(pong);
    });
  }

  // ── Public API ────────────────────────────────────────────

  /**
   * Set the handler for processed (reordered, deduped) messages.
   */
  setMessageHandler(handler: MessageHandler): void {
    this.onMessages = handler;
  }

  /**
   * Set the handler for connection state changes.
   */
  setStateChangeHandler(handler: StateChangeHandler): void {
    this.onStateChange = handler;
  }

  /**
   * Connect to the WebSocket server.
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.setState(ConnectionState.CONNECTING);
    this.createWebSocket();
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect(): void {
    this.clearRetryTimer();
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnection
      this.ws.close(1000, "client_disconnect");
      this.ws = null;
    }
    this.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * Send a client message over the WebSocket.
   */
  send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send a user message and transition to STREAMING state.
   */
  sendUserMessage(content: string): void {
    // Reset reorder buffer for new conversation turn
    // (server resets seq to 0 on new USER_MESSAGE)
    this.reorderBuffer.reset(1);

    this.send({ type: "USER_MESSAGE", content });
    this.setState(ConnectionState.STREAMING);
  }

  /**
   * Send a TOOL_ACK for a tool call.
   */
  sendToolAck(callId: string): void {
    this.send({ type: "TOOL_ACK", call_id: callId });
  }

  /**
   * Get the current connection state.
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get the last fully processed sequence number.
   */
  getProcessedSeq(): number {
    return this.reorderBuffer.getProcessedSeq();
  }

  /**
   * Get heartbeat stats.
   */
  getHeartbeatStats() {
    return this.heartbeatHandler.getStats();
  }

  // ── Private Methods ───────────────────────────────────────

  private createWebSocket(): void {
    try {
      this.ws = new WebSocket(WS_URL);
    } catch {
      this.handleConnectionFailure();
      return;
    }

    this.ws.onopen = () => {
      this.retryCount = 0;
      this.setState(ConnectionState.CONNECTED);

      // If we had a previous session and were actively streaming, send RESUME
      if (this.hadPreviousSession && this.wasStreamingBeforeDisconnect) {
        const lastSeq = this.reorderBuffer.getProcessedSeq();
        this.send({ type: "RESUME", last_seq: lastSeq });
        this.setState(ConnectionState.RESUMING);
      } else {
        this.setState(ConnectionState.READY);
      }

      this.hadPreviousSession = true;
      this.wasStreamingBeforeDisconnect = false;
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleRawMessage(event.data as string);
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror, which handles reconnection
    };
  }

  private handleRawMessage(data: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(data) as ServerMessage;
    } catch {
      console.error("[ws-manager] Failed to parse message:", data.slice(0, 200));
      return;
    }

    // Handle PING immediately (before reorder buffer — timing critical)
    if (message.type === "PING") {
      this.heartbeatHandler.handlePing(message);
      // Still pass through reorder buffer for trace timeline
    }

    // Feed into reorder buffer
    const ready = this.reorderBuffer.insert(message);

    if (ready.length > 0) {
      // Update connection state based on message types
      this.updateStateFromMessages(ready);

      // Dispatch to handler
      if (this.onMessages) {
        this.onMessages(ready);
      }
    }
  }

  private updateStateFromMessages(messages: ServerMessage[]): void {
    for (const msg of messages) {
      switch (msg.type) {
        case "TOKEN":
          if (this.state === ConnectionState.RESUMING) {
            this.setState(ConnectionState.STREAMING);
          } else if (this.state === ConnectionState.READY || this.state === ConnectionState.CONNECTED) {
            this.setState(ConnectionState.STREAMING);
          }
          break;

        case "TOOL_CALL":
          this.setState(ConnectionState.TOOL_PENDING);
          break;

        case "TOOL_RESULT":
          this.setState(ConnectionState.STREAMING);
          break;

        case "STREAM_END":
          this.setState(ConnectionState.READY);
          break;
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.retryCount >= RECONNECT_MAX_ATTEMPTS) {
      this.setState(ConnectionState.DISCONNECTED);
      return;
    }

    // Record if we were actively streaming/resuming before we transition to RECONNECTING
    if (this.state === ConnectionState.STREAMING || this.state === ConnectionState.TOOL_PENDING || this.state === ConnectionState.RESUMING) {
      this.wasStreamingBeforeDisconnect = true;
    } else {
      this.wasStreamingBeforeDisconnect = false;
    }

    this.setState(ConnectionState.RECONNECTING);

    const delay = Math.min(
      RECONNECT_INITIAL_DELAY_MS * Math.pow(RECONNECT_BACKOFF_MULTIPLIER, this.retryCount),
      RECONNECT_MAX_DELAY_MS
    );

    this.retryTimer = setTimeout(() => {
      this.retryCount++;
      this.createWebSocket();
    }, delay);
  }

  private handleConnectionFailure(): void {
    this.scheduleReconnect();
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private setState(newState: ConnectionState): void {
    if (this.state === newState) return;
    const prev = this.state;
    this.state = newState;
    console.log(`[ws-manager] ${prev} → ${newState}`);
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }
}
