import { describe, it, expect, vi } from "vitest";
import { HeartbeatHandler } from "../protocol/heartbeat-handler";
import { PingMessage } from "../protocol/types";

describe("HeartbeatHandler", () => {
  it("should respond to a PING with a PONG echoing the challenge", () => {
    const handler = new HeartbeatHandler();
    const sendMock = vi.fn();
    handler.setSendFn(sendMock);

    const ping: PingMessage = {
      seq: 1,
      type: "PING",
      challenge: "test-challenge-123",
      timestamp: Date.now(),
    };

    handler.handlePing(ping);

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      type: "PONG",
      echo: "test-challenge-123",
    });

    const stats = handler.getStats();
    expect(stats.totalPings).toBe(1);
    expect(stats.totalPongs).toBe(1);
    expect(stats.corruptPings).toBe(0);
  });

  it("should handle empty or corrupt challenges gracefully and track them", () => {
    const handler = new HeartbeatHandler();
    const sendMock = vi.fn();
    handler.setSendFn(sendMock);

    // Corrupt empty challenge
    const ping: PingMessage = {
      seq: 2,
      type: "PING",
      challenge: "",
      timestamp: Date.now(),
    };

    handler.handlePing(ping);

    expect(sendMock).toHaveBeenCalledWith({
      type: "PONG",
      echo: "",
    });

    const stats = handler.getStats();
    expect(stats.totalPings).toBe(1);
    expect(stats.totalPongs).toBe(1);
    expect(stats.corruptPings).toBe(1);
  });

  it("should handle missing challenge gracefully", () => {
    const handler = new HeartbeatHandler();
    const sendMock = vi.fn();
    handler.setSendFn(sendMock);

    // Missing challenge property (simulate bad payload)
    const ping = {
      seq: 3,
      type: "PING",
      timestamp: Date.now(),
    } as unknown as PingMessage;

    handler.handlePing(ping);

    expect(sendMock).toHaveBeenCalledWith({
      type: "PONG",
      echo: "",
    });

    const stats = handler.getStats();
    expect(stats.corruptPings).toBe(1);
  });

  it("should reset stats on reset", () => {
    const handler = new HeartbeatHandler();
    const sendMock = vi.fn();
    handler.setSendFn(sendMock);

    handler.handlePing({
      seq: 1,
      type: "PING",
      challenge: "hello",
      timestamp: Date.now(),
    });

    handler.reset();
    const stats = handler.getStats();
    expect(stats.totalPings).toBe(0);
    expect(stats.totalPongs).toBe(0);
    expect(stats.corruptPings).toBe(0);
    expect(stats.lastPingAt).toBeNull();
    expect(stats.lastPongAt).toBeNull();
  });
});
