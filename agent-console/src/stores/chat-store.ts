// ─────────────────────────────────────────────────────────────
// Chat Store (Zustand)
//
// Manages chat messages, active streams, and tool call state.
// This is the core state for Task 1 (Streaming Chat with
// Tool Call Interruptions).
// ─────────────────────────────────────────────────────────────

import { create } from "zustand";
import {
  ChatMessage,
  StreamState,
  ToolCallState,
  TokenMessage,
  ToolCallMessage,
  ToolResultMessage,
  StreamEndMessage,
} from "@/protocol/types";

interface ChatStoreState {
  messages: ChatMessage[];
  streams: Map<string, StreamState>;

  // Actions
  addUserMessage: (content: string) => void;
  handleToken: (msg: TokenMessage) => void;
  handleToolCall: (msg: ToolCallMessage) => void;
  handleToolResult: (msg: ToolResultMessage) => void;
  handleStreamEnd: (msg: StreamEndMessage) => void;
  reset: () => void;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  messages: [],
  streams: new Map(),

  addUserMessage: (content) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          role: "user" as const,
          content,
          timestamp: Date.now(),
        },
      ],
    }));
  },

  handleToken: (msg) => {
    set((state) => {
      const streams = new Map(state.streams);
      let stream = streams.get(msg.stream_id);

      if (!stream) {
        // First token for this stream — create agent message
        stream = {
          streamId: msg.stream_id,
          tokens: [msg.text],
          renderedText: msg.text,
          status: "streaming",
          toolCalls: [],
        };
        streams.set(msg.stream_id, stream);

        return {
          streams,
          messages: [
            ...state.messages,
            {
              role: "agent" as const,
              streamId: msg.stream_id,
              timestamp: Date.now(),
            },
          ],
        };
      }

      // Append token to existing stream
      const updatedStream: StreamState = {
        ...stream,
        tokens: [...stream.tokens, msg.text],
        renderedText: stream.renderedText + msg.text,
        status: "streaming",
      };
      streams.set(msg.stream_id, updatedStream);

      return { streams };
    });
  },

  handleToolCall: (msg) => {
    set((state) => {
      const streams = new Map(state.streams);
      let stream = streams.get(msg.stream_id);

      if (!stream) {
        // Tool call before any tokens (e.g., lookup script)
        stream = {
          streamId: msg.stream_id,
          tokens: [],
          renderedText: "",
          status: "paused_tool",
          toolCalls: [],
        };
        // Also add agent message entry
        const messages = [
          ...state.messages,
          {
            role: "agent" as const,
            streamId: msg.stream_id,
            timestamp: Date.now(),
          },
        ];

        const toolCall: ToolCallState = {
          callId: msg.call_id,
          toolName: msg.tool_name,
          args: msg.args,
          status: "pending_ack",
          insertionIndex: 0,
          seq: msg.seq,
        };

        streams.set(msg.stream_id, {
          ...stream,
          toolCalls: [toolCall],
        });

        return { streams, messages };
      }

      // Freeze stream at current position
      const toolCall: ToolCallState = {
        callId: msg.call_id,
        toolName: msg.tool_name,
        args: msg.args,
        status: "pending_ack",
        insertionIndex: stream.tokens.length,
        seq: msg.seq,
      };

      const updatedStream: StreamState = {
        ...stream,
        status: "paused_tool",
        toolCalls: [...stream.toolCalls, toolCall],
      };
      streams.set(msg.stream_id, updatedStream);

      return { streams };
    });
  },

  handleToolResult: (msg) => {
    set((state) => {
      const streams = new Map(state.streams);
      const stream = streams.get(msg.stream_id);

      if (!stream) return state;

      const updatedToolCalls = stream.toolCalls.map((tc) =>
        tc.callId === msg.call_id
          ? { ...tc, status: "complete" as const, result: msg.result }
          : tc
      );

      const updatedStream: StreamState = {
        ...stream,
        status: "streaming",
        toolCalls: updatedToolCalls,
      };
      streams.set(msg.stream_id, updatedStream);

      return { streams };
    });
  },

  handleStreamEnd: (msg) => {
    set((state) => {
      const streams = new Map(state.streams);
      const stream = streams.get(msg.stream_id);

      if (!stream) return state;

      const updatedStream: StreamState = {
        ...stream,
        status: "complete",
      };
      streams.set(msg.stream_id, updatedStream);

      return { streams };
    });
  },

  reset: () => {
    set({ messages: [], streams: new Map() });
  },
}));
