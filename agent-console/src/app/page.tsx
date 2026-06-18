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
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const isDraggingRef = useRef(false);

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

  const handleLogoClick = useCallback(() => {
    setShowTimeline(false);
    setShowContext(false);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const containerWidth = window.innerWidth;
      const newWidth = containerWidth - e.clientX;
      const minWidth = 250;
      const maxWidth = containerWidth * 0.7;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
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
        <div className={styles.logo} onClick={handleLogoClick} style={{ cursor: "pointer" }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
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
          <>
            <div
              className={styles.resizeDivider}
              onMouseDown={handleMouseDown}
            />
            <div className={styles.sidePanel} style={{ width: sidebarWidth }}>
              {rightPanel === "timeline" ? (
                <TraceTimeline />
              ) : (
                <ContextInspector />
              )}
            </div>
          </>
        )}
      </div>

      <StatusBar />
    </div>
  );
}
