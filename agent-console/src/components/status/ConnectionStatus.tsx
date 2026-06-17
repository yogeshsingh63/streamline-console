"use client";

import React from "react";
import { useConnectionStore } from "@/stores/connection-store";
import { ConnectionState } from "@/protocol/types";

const STATE_CONFIG: Record<
  ConnectionState,
  { label: string; color: string; icon: string; showBanner: boolean }
> = {
  [ConnectionState.DISCONNECTED]: {
    label: "Disconnected",
    color: "var(--accent-red)",
    icon: "⊘",
    showBanner: true,
  },
  [ConnectionState.CONNECTING]: {
    label: "Connecting...",
    color: "var(--accent-yellow)",
    icon: "◌",
    showBanner: false,
  },
  [ConnectionState.CONNECTED]: {
    label: "Connected",
    color: "var(--accent-green)",
    icon: "●",
    showBanner: false,
  },
  [ConnectionState.RESUMING]: {
    label: "Resuming session...",
    color: "var(--accent-yellow)",
    icon: "↻",
    showBanner: true,
  },
  [ConnectionState.READY]: {
    label: "Ready",
    color: "var(--accent-green)",
    icon: "●",
    showBanner: false,
  },
  [ConnectionState.STREAMING]: {
    label: "Streaming",
    color: "var(--accent-blue)",
    icon: "◉",
    showBanner: false,
  },
  [ConnectionState.TOOL_PENDING]: {
    label: "Tool executing",
    color: "var(--accent-purple)",
    icon: "⚙",
    showBanner: false,
  },
  [ConnectionState.RECONNECTING]: {
    label: "Reconnecting...",
    color: "var(--accent-orange)",
    icon: "↻",
    showBanner: true,
  },
};

export function ConnectionIndicator() {
  const state = useConnectionStore((s) => s.state);
  const config = STATE_CONFIG[state];

  if (!config.showBanner) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "6px 16px",
        background: "var(--bg-3)",
        borderBottom: `2px solid ${config.color}`,
        fontSize: "0.8rem",
        color: config.color,
        fontWeight: 500,
        animation: "slideDown 0.3s ease",
      }}
    >
      <span style={{ animation: state === ConnectionState.RECONNECTING ? "pulse 1s infinite" : undefined }}>
        {config.icon}
      </span>
      {config.label}
    </div>
  );
}

export function StatusBar() {
  const state = useConnectionStore((s) => s.state);
  const processedSeq = useConnectionStore((s) => s.processedSeq);
  const config = STATE_CONFIG[state];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "0 16px",
        height: "var(--status-bar-height)",
        background: "var(--bg-2)",
        borderTop: "1px solid var(--border-subtle)",
        fontSize: "0.7rem",
        fontFamily: "var(--font-mono)",
        color: "var(--text-muted)",
        flexShrink: 0,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ color: config.color, fontSize: "0.6rem" }}>{config.icon}</span>
        <span style={{ color: config.color }}>{config.label}</span>
      </span>
      <span>seq: {processedSeq}</span>
      <span style={{ marginLeft: "auto", opacity: 0.5 }}>
        Streamline Console
      </span>
    </div>
  );
}
