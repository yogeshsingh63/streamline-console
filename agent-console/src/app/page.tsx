"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import ChatPanel from "@/components/chat/ChatPanel";
import TraceTimeline from "@/components/timeline/TraceTimeline";
import ContextInspector from "@/components/context/ContextInspector";
import { ConnectionIndicator, StatusBar } from "@/components/status/ConnectionStatus";
import { WebSocketManager } from "@/protocol/websocket-manager";
import { dispatchMessages, setSendToolAckFn } from "@/protocol/message-dispatcher";
import { useConnectionStore } from "@/stores/connection-store";
import { useChatStore } from "@/stores/chat-store";
import { ConnectionState } from "@/protocol/types";
import styles from "./page.module.css";

export default function Home() {
  const wsRef = useRef<WebSocketManager | null>(null);
  const connectionState = useConnectionStore((s) => s.state);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showContext, setShowContext] = useState(true);
  const [rightPanel, setRightPanel] = useState<"timeline" | "context">("timeline");

  // Initialize WebSocket manager once
  useEffect(() => {
    const ws = new WebSocketManager();
    wsRef.current = ws;

    // Wire message handler → dispatcher → stores
    ws.setMessageHandler((messages) => {
      dispatchMessages(messages);
    });

    // Wire state changes → connection store
    ws.setStateChangeHandler((state) => {
      useConnectionStore.getState().setState(state);
      if (state === ConnectionState.CONNECTED || state === ConnectionState.READY) {
        useConnectionStore.getState().setLastConnectedAt(Date.now());
      }
    });

    // Wire TOOL_ACK sending
    setSendToolAckFn((callId) => {
      ws.sendToolAck(callId);
    });

    // Connect
    ws.connect();

    return () => {
      ws.disconnect();
    };
  }, []);

  // Send user message
  const handleSendMessage = useCallback((content: string) => {
    if (!wsRef.current) return;
    useChatStore.getState().addUserMessage(content);
    wsRef.current.sendUserMessage(content);
  }, []);

  // Keyboard shortcut: Ctrl+T for timeline, Ctrl+I for context
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "t") {
        e.preventDefault();
        setRightPanel("timeline");
        setShowTimeline((v) => !v);
      }
      if (e.ctrlKey && e.key === "i") {
        e.preventDefault();
        setRightPanel("context");
        setShowContext((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const showRightPanel =
    (rightPanel === "timeline" && showTimeline) ||
    (rightPanel === "context" && showContext);

  return (
    <div className={styles.appContainer}>
      <ConnectionIndicator />

      {/* Top bar with panel toggles */}
      <div className={styles.topBar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⚡</span>
          <span className={styles.logoText}>Streamline Console</span>
        </div>
        <div className={styles.panelToggles}>
          <button
            className={`${styles.toggleBtn} ${
              rightPanel === "timeline" && showTimeline ? styles.toggleActive : ""
            }`}
            onClick={() => {
              setRightPanel("timeline");
              setShowTimeline(true);
              if (rightPanel === "timeline") setShowTimeline((v) => !v);
            }}
          >
            Trace
          </button>
          <button
            className={`${styles.toggleBtn} ${
              rightPanel === "context" && showContext ? styles.toggleActive : ""
            }`}
            onClick={() => {
              setRightPanel("context");
              setShowContext(true);
              if (rightPanel === "context") setShowContext((v) => !v);
            }}
          >
            Context
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className={styles.mainContent}>
        <div className={styles.chatArea}>
          <ChatPanel
            connectionState={connectionState}
            onSendMessage={handleSendMessage}
          />
        </div>
        {showRightPanel && (
          <div className={styles.sidePanel}>
            {rightPanel === "timeline" ? (
              <TraceTimeline />
            ) : (
              <ContextInspector />
            )}
          </div>
        )}
      </div>

      <StatusBar />
    </div>
  );
}
