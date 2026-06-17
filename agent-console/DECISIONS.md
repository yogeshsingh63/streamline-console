# Architectural Decisions & Analysis — Agent Console

## 1. Sequence-based Ordering and Deduplication
To handle chaos mode (where packets can be duplicated, delayed, or arrive out of order), we implemented a dedicated `ReorderBuffer` class.
- **Deduplication:** We maintain a `processedSeqs` set of sequence numbers that have already been emitted to the UI, plus a check against the expected sequence. If a duplicate packet arrives, it is discarded immediately.
- **Reordering:** We use a sorted buffer list for out-of-order messages. When a message arrives with `seq > expectedSeq`, we insert it into the buffer using insertion sort (maintaining ascending `seq` order).
- **Data Structure Choice:** An insertion-sorted array was selected over a full binary min-heap. Because WebSockets deliver messages mostly in order with occasional local drops/delays, the insertion index is almost always at the end of the array. The average insertion complexity is $O(1)$ with a worst-case of $O(n)$ where $n$ (the size of the buffer gap) remains extremely small (rarely exceeding 5-10 messages). This avoids heap pointer/rebalancing overhead and keeps the memory footprint minimal.
- **Draining:** Once the gap is filled and the message with `expectedSeq` arrives, we drain all contiguous messages from the buffer, update the processed status, and dispatch them sequentially.

## 2. Preventing Layout Shift During Tool Interruptions
A critical user-experience requirement is that the token stream must freeze smoothly when a `TOOL_CALL` is received, without content jumping or page reflows.
- **Segmented Rendering:** The `ChatPanel` does not render a single concatenated string. Instead, it breaks the stream's tokens into an array of segments based on the `insertionIndex` of the tool calls.
- **CSS Layout Flow:** Each segment is either a `text` block or a `toolCall` card. Tool call cards are rendered inline as `block` elements between the text blocks. Since they use natural DOM flow rather than absolute positioning, the browser allocates vertical space dynamically without causing layout shifts or overlapping text.
- **Cursor Stability:** The cursor is only shown on the active text block that is currently streaming. When a tool call is active, the cursor is hidden on previous blocks and only shown if a new segment resumes streaming.

## 3. Reconnection State Recovery (Received vs. Processed Sequences)
Distributed systems reconnecting real-time streams require strict tracking of what state has been committed.
- **Two Sequence Numbers:**
  - `receivedSeq`: The highest sequence number received by the network layers.
  - `processedSeq` (or `last_processed_seq`): The highest sequence number that has been successfully dispatched to the Zustand stores and committed to the React render tree.
- **Reconnection Resume:** When a WebSocket drop occurs, we perform an exponential backoff reconnect. Upon connection, the very first message sent is `RESUME { last_seq: processedSeq }`. The server then replays all messages starting from `processedSeq + 1`. Because we resume from the *processed* sequence rather than the *received* sequence, any packets that were in-flight or buffered but not yet dispatched to the UI stores are re-requested, ensuring zero state loss.

## 4. Scaling to 50 Concurrent Agent Streams (Operations Dashboard)
To scale this application to support 50 active, concurrent streams on a single screen without UI freezing, we would make the following architectural adjustments:
1. **Shared WebSocket Worker:** Move WebSocket connection and protocol management (including reordering and heartbeat handling) out of the main thread and into a `SharedWorker`. This centralizes network throughput and keeps the main thread free from message parsing.
2. **Debounced/Batched Store Updates:** Instead of triggering a React state update on every single token (which would result in thousands of renders per second across 50 streams), we would batch token updates. The worker would buffer tokens for 50-100ms and dispatch them in chunks.
3. **Virtualized Grid Layout:** Implement virtualization (e.g., using `react-window` or custom intersection observer logic) so that only the 10-15 streams currently visible on the screen are actively rendering to the DOM. Hidden streams would continue updating their stores in the background without incurring DOM reflow costs.
4. **CSS Containment:** Add `contain: content` or `contain: layout style` to each of the 50 stream panel containers to isolate browser reflows, preventing a layout change in one panel from recalculating the layout of the entire page.

## 5. Scaling for 100x Longer Responses (Document Generation)
If responses were 100x longer (e.g., generating a 50-page report inline), a standard chat view would crash the browser due to DOM node explosion (thousands of individual paragraph nodes and text elements).
1. **Paginated or Virtualized Text List:** We would virtualize the text box itself, dividing the long text document into paragraphs or pages, and only rendering the visible portion in the DOM.
2. **Dynamic DOM Appends:** Instead of re-building the React DOM tree with a massive array of tokens, we would use a low-level mutable reference to append text directly to the active block's `textContent` or `innerText`. This bypasses React's diffing algorithm for the raw text stream.
3. **Incremental Markdown Parser:** A standard markdown parser parses the entire string from scratch on every change. For a 100k token document, this is extremely expensive. We would use an *incremental* or *windowed* markdown parser that only parses and updates the modified block/paragraph.

## 6. Protocol Race Condition: TOOL_ACK vs. Reconnection
We identified a critical race condition within the documented protocol:
- **The Issue:** The server expects the client to respond with a `TOOL_ACK` within 5 seconds of a `TOOL_CALL`. If the connection drops right as the `TOOL_CALL` is sent, the client enters backoff reconnection mode. If the reconnection takes longer than 5 seconds, the server will log a protocol violation and send the `TOOL_RESULT` anyway.
- **Client Mitigation:** When the client reconnects and issues a `RESUME` message, the server replays the events. If the server already sent the `TOOL_RESULT` (due to the timeout), the client receives the replayed `TOOL_CALL` followed immediately by the `TOOL_RESULT`. Our client state management is designed to handle this: the dispatch of `TOOL_RESULT` is fully independent of whether the `TOOL_ACK` was successfully sent or acknowledged by the server. This prevents the UI from locking up in a permanent "waiting" state.
