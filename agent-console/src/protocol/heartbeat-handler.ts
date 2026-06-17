// ─────────────────────────────────────────────────────────────
// Heartbeat Handler
//
// Manages PING/PONG protocol. Responds to server PINGs within
// the 3-second deadline. Handles corrupt PINGs (empty challenge)
// gracefully without crashing.
// ─────────────────────────────────────────────────────────────

import { PingMessage, PongPayload } from "./types";

export interface HeartbeatStats {
  totalPings: number;
  totalPongs: number;
  lastPingAt: number | null;
  lastPongAt: number | null;
  corruptPings: number;
}

export class HeartbeatHandler {
  private sendFn: ((msg: PongPayload) => void) | null = null;
  private stats: HeartbeatStats = {
    totalPings: 0,
    totalPongs: 0,
    lastPingAt: null,
    lastPongAt: null,
    corruptPings: 0,
  };

  /**
   * Set the function used to send messages over the WebSocket.
   */
  setSendFn(fn: (msg: PongPayload) => void): void {
    this.sendFn = fn;
  }

  /**
   * Handle an incoming PING message.
   * Immediately responds with PONG echoing the challenge.
   * Handles corrupt (empty) challenges without crashing.
   */
  handlePing(ping: PingMessage): void {
    this.stats.totalPings++;
    this.stats.lastPingAt = Date.now();

    // Track corrupt pings but still respond
    if (!ping.challenge && ping.challenge !== "") {
      this.stats.corruptPings++;
    } else if (ping.challenge === "") {
      this.stats.corruptPings++;
    }

    // Always respond — even with empty challenge
    const pong: PongPayload = {
      type: "PONG",
      echo: ping.challenge ?? "",
    };

    this.stats.totalPongs++;
    this.stats.lastPongAt = Date.now();

    if (this.sendFn) {
      this.sendFn(pong);
    }
  }

  /**
   * Get current heartbeat statistics.
   */
  getStats(): HeartbeatStats {
    return { ...this.stats };
  }

  /**
   * Reset stats (e.g., on reconnection).
   */
  reset(): void {
    this.stats = {
      totalPings: 0,
      totalPongs: 0,
      lastPingAt: null,
      lastPongAt: null,
      corruptPings: 0,
    };
  }
}
