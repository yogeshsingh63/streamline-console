// ─────────────────────────────────────────────────────────────
// Message Dispatcher
//
// Routes processed (reordered, deduplicated) messages from
// the WebSocket manager to the appropriate Zustand stores.
// This is the bridge between the protocol layer and the UI.
// ─────────────────────────────────────────────────────────────

import { ServerMessage } from "./types";
import { useChatStore } from "@/stores/chat-store";
import { useTraceStore } from "@/stores/trace-store";
import { useContextStore } from "@/stores/context-store";
import { useConnectionStore } from "@/stores/connection-store";

/** Callback for sending messages back via WebSocket */
type SendToolAckFn = (callId: string) => void;

let sendToolAckFn: SendToolAckFn | null = null;

/**
 * Set the function used to send TOOL_ACK messages.
 * Called once during WebSocket manager initialization.
 */
export function setSendToolAckFn(fn: SendToolAckFn): void {
  sendToolAckFn = fn;
}

/**
 * Dispatch an array of processed messages to the stores.
 * Called by the WebSocket manager after reorder + dedup.
 */
export function dispatchMessages(messages: ServerMessage[]): void {
  const chatStore = useChatStore.getState();
  const traceStore = useTraceStore.getState();
  const contextStore = useContextStore.getState();
  const connectionStore = useConnectionStore.getState();

  for (const msg of messages) {
    // Always add to trace timeline
    traceStore.addEvent(msg);

    // Update processed seq
    connectionStore.setProcessedSeq(msg.seq);

    // Route by type
    switch (msg.type) {
      case "TOKEN":
        chatStore.handleToken(msg);
        break;

      case "TOOL_CALL":
        chatStore.handleToolCall(msg);
        // Send TOOL_ACK within deadline
        if (sendToolAckFn) {
          const callId = msg.call_id;
          // Send immediately (well within 2s deadline)
          setTimeout(() => {
            if (sendToolAckFn) {
              sendToolAckFn(callId);
            }
          }, 50);
        }
        break;

      case "TOOL_RESULT":
        chatStore.handleToolResult(msg);
        break;

      case "CONTEXT_SNAPSHOT":
        contextStore.handleContextSnapshot(msg);
        break;

      case "STREAM_END":
        chatStore.handleStreamEnd(msg);
        break;

      case "ERROR":
        console.error("[dispatcher] Server error:", msg.code, msg.message);
        break;

      case "PING":
        // Already handled by HeartbeatHandler in websocket-manager
        // Just logged in trace store above
        break;
    }
  }
}
