import { describe, it, expect, beforeEach } from "vitest";
import { ReorderBuffer } from "../protocol/reorder-buffer";
import { ServerMessage } from "../protocol/types";

describe("ReorderBuffer", () => {
  let buffer: ReorderBuffer;

  beforeEach(() => {
    buffer = new ReorderBuffer();
  });

  const makeMsg = (seq: number, content: string = ""): ServerMessage => ({
    seq,
    type: "TOKEN",
    content,
    timestamp: Date.now(),
  });

  it("should return message immediately if it is the expected sequence", () => {
    const msg = makeMsg(1, "hello");
    const result = buffer.insert(msg);
    expect(result).toEqual([msg]);
    expect(buffer.getExpectedSeq()).toBe(2);
    expect(buffer.getProcessedSeq()).toBe(1);
    expect(buffer.getBufferSize()).toBe(0);
  });

  it("should buffer out-of-order messages and drain them when the gap is filled", () => {
    // Insert 3 (out of order)
    const msg3 = makeMsg(3, "world");
    expect(buffer.insert(msg3)).toEqual([]);
    expect(buffer.getBufferSize()).toBe(1);
    expect(buffer.getExpectedSeq()).toBe(1);

    // Insert 2 (still out of order)
    const msg2 = makeMsg(2, " ");
    expect(buffer.insert(msg2)).toEqual([]);
    expect(buffer.getBufferSize()).toBe(2);
    expect(buffer.getExpectedSeq()).toBe(1);

    // Insert 1 (completes sequence)
    const msg1 = makeMsg(1, "hello");
    const result = buffer.insert(msg1);

    expect(result).toEqual([msg1, msg2, msg3]);
    expect(buffer.getBufferSize()).toBe(0);
    expect(buffer.getExpectedSeq()).toBe(4);
    expect(buffer.getProcessedSeq()).toBe(3);
  });

  it("should discard duplicate messages that have already been processed", () => {
    const msg1 = makeMsg(1, "hello");
    expect(buffer.insert(msg1)).toEqual([msg1]);

    // Insert same message again
    expect(buffer.insert(msg1)).toEqual([]);
    expect(buffer.getProcessedSeq()).toBe(1);
  });

  it("should discard duplicate messages that are already in the buffer", () => {
    const msg3 = makeMsg(3, "world");
    expect(buffer.insert(msg3)).toEqual([]);
    expect(buffer.getBufferSize()).toBe(1);

    // Insert duplicate of msg3
    expect(buffer.insert(msg3)).toEqual([]);
    expect(buffer.getBufferSize()).toBe(1);
  });

  it("should discard stale messages with seq lower than expectedSeq", () => {
    const msg1 = makeMsg(1, "hello");
    buffer.insert(msg1);

    const staleMsg = makeMsg(0, "stale");
    expect(buffer.insert(staleMsg)).toEqual([]);
  });

  it("should handle resets properly", () => {
    buffer.insert(makeMsg(3, "three"));
    buffer.reset(10);
    expect(buffer.getBufferSize()).toBe(0);
    expect(buffer.getExpectedSeq()).toBe(10);
    expect(buffer.getProcessedSeq()).toBe(9);
  });
});
