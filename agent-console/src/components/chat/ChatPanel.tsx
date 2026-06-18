"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useTraceStore } from "@/stores/trace-store";
import { ConnectionState } from "@/protocol/types";
import type { StreamState, ToolCallState, ChatMessage } from "@/protocol/types";
import styles from "./ChatPanel.module.css";

interface ChatPanelProps {
  connectionState: ConnectionState;
  onSendMessage: (content: string) => void;
}

export default function ChatPanel({
  connectionState,
  onSendMessage,
}: ChatPanelProps) {
  const messages = useChatStore((s) => s.messages);
  const streams = useChatStore((s) => s.streams);
  const [inputValue, setInputValue] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);

  // Auto-scroll to bottom during streaming (interpolated for smoothness)
  useEffect(() => {
    if (!isAutoScrollRef.current) return;
    const el = messageListRef.current;
    if (!el) return;

    let frameId: number;
    
    const smoothScroll = () => {
      const current = el.scrollTop;
      const target = el.scrollHeight - el.clientHeight;
      const remaining = target - current;
      
      if (remaining <= 1) {
        el.scrollTop = target;
      } else {
        // Glide smoothly by covering 20% of the remaining distance per frame
        el.scrollTop = current + Math.max(1, remaining * 0.2);
        frameId = requestAnimationFrame(smoothScroll);
      }
    };
    
    frameId = requestAnimationFrame(smoothScroll);
    return () => cancelAnimationFrame(frameId);
  }, [messages, streams]);

  // Pause auto-scroll if user scrolls up
  const handleScroll = useCallback(() => {
    const el = messageListRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    isAutoScrollRef.current = isAtBottom;
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;
      onSendMessage(trimmed);
      setInputValue("");
    },
    [inputValue, onSendMessage]
  );

  const canSend =
    connectionState === ConnectionState.READY ||
    connectionState === ConnectionState.CONNECTED ||
    connectionState === ConnectionState.STREAMING;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Chat</span>
        <span className={styles.headerBadge}>
          {connectionState}
        </span>
      </div>

      <div
        className={styles.messageList}
        ref={messageListRef}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>_</div>
            <div className={styles.emptyText}>
              Send a message to start the agent
            </div>
            <div className={styles.emptyHint}>
              Try: &quot;hello&quot;, &quot;summarize report&quot;, &quot;analyze&quot;, &quot;search&quot;, &quot;schema&quot;
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageRow
              key={idx}
              message={msg}
              streams={streams}
            />
          ))
        )}
      </div>

      <form className={styles.inputArea} onSubmit={handleSubmit}>
        <div className={styles.inputWrapper}>
          <input
            className={styles.input}
            type="text"
            placeholder={
              canSend
                ? "Type a message..."
                : "Connecting..."
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={!canSend}
            autoFocus
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!canSend || !inputValue.trim()}
            aria-label="Send message"
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Message Row ─────────────────────────────────────────────

function MessageRow({
  message,
  streams,
}: {
  message: ChatMessage;
  streams: Map<string, StreamState>;
}) {
  if (message.role === "user") {
    return (
      <div className={styles.userMessage}>{message.content}</div>
    );
  }

  const stream = streams.get(message.streamId);

  return (
    <div className={styles.agentMessageContainer}>
      <AgentMessageContent stream={stream} />
    </div>
  );
}

// ── Agent Message Content ───────────────────────────────────

function AgentMessageContent({ stream }: { stream?: StreamState }) {
  const setHighlightedEntry = useTraceStore((s) => s.setHighlightedEntry);

  if (!stream) {
    return (
      <div className={styles.agentMessageBubble}>
        <span className={styles.streamingCursor} />
      </div>
    );
  }

  // Split the rendered text by tool call insertion points
  const segments = buildSegments(stream);

  return (
    <>
      {segments.map((segment, idx) => {
        if (segment.type === "text") {
          return (
            <div key={idx} className={styles.agentMessageBubble}>
              {segment.text}
              {segment.showCursor && (
                <span className={styles.streamingCursor} />
              )}
            </div>
          );
        }

        if (segment.type === "toolCall") {
          return (
            <ToolCallCard
              key={segment.toolCall.callId}
              toolCall={segment.toolCall}
              onClick={() =>
                setHighlightedEntry(segment.toolCall.callId)
              }
            />
          );
        }

        return null;
      })}
    </>
  );
}

// ── Segment Builder ─────────────────────────────────────────

interface TextSegment {
  type: "text";
  text: string;
  showCursor: boolean;
}

interface ToolCallSegment {
  type: "toolCall";
  toolCall: ToolCallState;
}

type Segment = TextSegment | ToolCallSegment;

function buildSegments(stream: StreamState): Segment[] {
  const segments: Segment[] = [];
  const sortedToolCalls = [...stream.toolCalls].sort(
    (a, b) => a.insertionIndex - b.insertionIndex
  );

  let lastIndex = 0;

  for (const tc of sortedToolCalls) {
    // Text before this tool call
    const textBefore = stream.tokens.slice(lastIndex, tc.insertionIndex).join("");
    if (textBefore) {
      segments.push({ type: "text", text: textBefore, showCursor: false });
    }

    // The tool call itself
    segments.push({ type: "toolCall", toolCall: tc });

    lastIndex = tc.insertionIndex;
  }

  // Remaining text after all tool calls
  const remaining = stream.tokens.slice(lastIndex).join("");
  const isStreaming = stream.status === "streaming";

  if (remaining || isStreaming) {
    segments.push({
      type: "text",
      text: remaining,
      showCursor: isStreaming,
    });
  }

  // If no segments were created (e.g., tool call before tokens), show cursor
  if (segments.length === 0 && stream.status !== "complete") {
    segments.push({ type: "text", text: "", showCursor: true });
  }

  return segments;
}

// ── Tool Call Card ──────────────────────────────────────────

function ToolCallCard({
  toolCall,
  onClick,
}: {
  toolCall: ToolCallState;
  onClick: () => void;
}) {
  const isComplete = toolCall.status === "complete";
  const isPending =
    toolCall.status === "pending_ack" ||
    toolCall.status === "waiting_result";

  return (
    <div
      className={styles.toolCallCard}
      onClick={onClick}
      data-call-id={toolCall.callId}
    >
      <div className={styles.toolCallHeader}>
        <span className={styles.toolIcon}>🔧</span>
        <span className={styles.toolName}>{toolCall.toolName}</span>
        <span
          className={`${styles.toolStatus} ${
            isComplete ? styles.statusComplete : styles.statusPending
          }`}
        >
          {isComplete ? "✓ Done" : isPending ? "Running..." : "Pending"}
        </span>
      </div>
      <div className={styles.toolArgs}>
        {JSON.stringify(toolCall.args, null, 2)}
      </div>
      {isComplete && toolCall.result && (
        <div className={styles.toolResult}>
          {JSON.stringify(toolCall.result, null, 2)}
        </div>
      )}
    </div>
  );
}
