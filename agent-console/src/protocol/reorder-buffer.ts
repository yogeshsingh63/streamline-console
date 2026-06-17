// ─────────────────────────────────────────────────────────────
// Reorder Buffer
//
// Handles out-of-order and duplicate messages from chaos mode.
// Uses a sorted insertion approach (messages arrive roughly in
// order, so insertion sort is faster than a full heap for this
// workload). Deduplicates by seq.
// ─────────────────────────────────────────────────────────────

import { ServerMessage } from "./types";

export class ReorderBuffer {
  /** Buffer for out-of-order messages, sorted by seq ascending */
  private buffer: ServerMessage[] = [];

  /** Set of already-processed seq values for deduplication */
  private processedSeqs: Set<number> = new Set();

  /** The next seq we expect to process */
  private expectedSeq: number = 1;

  /**
   * Insert a message into the buffer.
   * Returns an array of messages that are now ready for processing
   * (contiguous from expectedSeq), in correct order.
   *
   * Returns empty array if the message was buffered (gap exists)
   * or was a duplicate.
   */
  insert(message: ServerMessage): ServerMessage[] {
    const seq = message.seq;

    // Duplicate check: already processed this seq
    if (this.processedSeqs.has(seq)) {
      return [];
    }

    // Already past this seq (stale message after reconnect)
    if (seq < this.expectedSeq) {
      return [];
    }

    // Check if already in buffer (duplicate in-flight)
    if (this.buffer.some((m) => m.seq === seq)) {
      return [];
    }

    // Insert into buffer maintaining sorted order (insertion sort)
    let insertIdx = this.buffer.length;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].seq <= seq) {
        insertIdx = i + 1;
        break;
      }
      if (i === 0) {
        insertIdx = 0;
      }
    }
    this.buffer.splice(insertIdx, 0, message);

    // Drain contiguous messages starting from expectedSeq
    return this.drain();
  }

  /**
   * Drain all contiguous messages from the front of the buffer
   * starting at expectedSeq.
   */
  private drain(): ServerMessage[] {
    const ready: ServerMessage[] = [];

    while (this.buffer.length > 0 && this.buffer[0].seq === this.expectedSeq) {
      const msg = this.buffer.shift()!;
      this.processedSeqs.add(msg.seq);
      this.expectedSeq++;
      ready.push(msg);
    }

    return ready;
  }

  /**
   * Get the last fully processed seq number.
   * This is what we send in RESUME after reconnection.
   */
  getProcessedSeq(): number {
    return this.expectedSeq - 1;
  }

  /**
   * Reset the buffer state (e.g., when starting a new conversation turn).
   * Optionally reset to a specific expected seq.
   */
  reset(fromSeq: number = 1): void {
    this.buffer = [];
    this.processedSeqs.clear();
    this.expectedSeq = fromSeq;
  }

  /**
   * Get the number of messages currently buffered (waiting for gaps to fill).
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Get the expected next seq number.
   */
  getExpectedSeq(): number {
    return this.expectedSeq;
  }
}
