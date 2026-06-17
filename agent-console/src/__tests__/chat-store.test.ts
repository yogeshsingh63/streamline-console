import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../stores/chat-store";
import { TokenMessage, ToolCallMessage, ToolResultMessage } from "../protocol/types";

describe("ChatStore", () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  it("should add a user message", () => {
    useChatStore.getState().addUserMessage("Hello agent");
    const state = useChatStore.getState();
    expect(state.messages.length).toBe(1);
    expect(state.messages[0]).toEqual(
      expect.objectContaining({
        role: "user",
        content: "Hello agent",
      })
    );
  });

  it("should handle streaming tokens and create agent message dynamically", () => {
    const token1: TokenMessage = {
      seq: 1,
      type: "TOKEN",
      stream_id: "stream-1",
      text: "Hello",
      timestamp: Date.now(),
    };

    useChatStore.getState().handleToken(token1);
    let state = useChatStore.getState();
    expect(state.messages.length).toBe(1);
    expect(state.messages[0]).toEqual(
      expect.objectContaining({
        role: "agent",
        streamId: "stream-1",
      })
    );
    expect(state.streams.get("stream-1")).toEqual(
      expect.objectContaining({
        streamId: "stream-1",
        tokens: ["Hello"],
        renderedText: "Hello",
        status: "streaming",
      })
    );

    const token2: TokenMessage = {
      seq: 2,
      type: "TOKEN",
      stream_id: "stream-1",
      text: " world",
      timestamp: Date.now(),
    };

    useChatStore.getState().handleToken(token2);
    state = useChatStore.getState();
    expect(state.streams.get("stream-1")?.renderedText).toBe("Hello world");
  });

  it("should handle tool call interruptions and results", () => {
    // Initial tokens
    useChatStore.getState().handleToken({
      seq: 1,
      type: "TOKEN",
      stream_id: "stream-1",
      text: "Run",
      timestamp: Date.now(),
    });

    const toolCall: ToolCallMessage = {
      seq: 2,
      type: "TOOL_CALL",
      stream_id: "stream-1",
      call_id: "call-1",
      tool_name: "calculator",
      args: { expr: "2+2" },
      timestamp: Date.now(),
    };

    useChatStore.getState().handleToolCall(toolCall);
    let state = useChatStore.getState();
    let stream = state.streams.get("stream-1")!;
    expect(stream.status).toBe("paused_tool");
    expect(stream.toolCalls.length).toBe(1);
    expect(stream.toolCalls[0]).toEqual(
      expect.objectContaining({
        callId: "call-1",
        toolName: "calculator",
        args: { expr: "2+2" },
        status: "pending_ack",
        insertionIndex: 1,
      })
    );

    const toolResult: ToolResultMessage = {
      seq: 3,
      type: "TOOL_RESULT",
      stream_id: "stream-1",
      call_id: "call-1",
      result: { output: 4 },
      timestamp: Date.now(),
    };

    useChatStore.getState().handleToolResult(toolResult);
    state = useChatStore.getState();
    stream = state.streams.get("stream-1")!;
    expect(stream.status).toBe("streaming");
    expect(stream.toolCalls[0].status).toBe("complete");
    expect(stream.toolCalls[0].result).toEqual({ output: 4 });
  });
});
