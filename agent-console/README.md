# Streamline Console — Agent Console

Streamline Console is a premium Next.js 16 (App Router) client application designed to interface with the Alchemyst Agent Server. It features smooth incremental token rendering, mid-stream tool call freezing, a live trace timeline, and a recursive JSON diff inspector. It is built to survive network latency, packet drops, duplicate messages, and connection disruptions without state corruption.

## Architectural Approach
The application is structured using a strict protocol-first architecture. A central `WebSocketManager` handles the connection lifecycle and pipes incoming packets to a sequence-based `ReorderBuffer` that reorders out-of-order messages and filters out duplicate frames. The dispatcher then routes these validated events to globally managed Zustand stores, decoupling network ingestion from the React render loop to avoid UI thread blocking.

## Chaos Mode Demonstration
Watch the screen recording of the application surviving and recovering in Chaos Mode on Loom:
👉 **[Loom Video Demonstration](https://www.loom.com/share/67e507462fdf4320a946325abe58df4e)**

---

## WebSocket Connection State Machine

```mermaid
flowchart TD
    DISCONNECTED([DISCONNECTED])
    CONNECTING([CONNECTING])
    CONNECTED([CONNECTED])
    RESUMING([RESUMING])
    READY([READY])
    STREAMING([STREAMING])
    TOOL_PENDING([TOOL_PENDING])
    RECONNECTING([RECONNECTING])

    DISCONNECTED -->|connect| CONNECTING
    CONNECTING -->|onOpen| CONNECTED
    
    CONNECTED -->|session exists| RESUMING
    CONNECTED -->|no session| READY
    
    RESUMING -->|recv TOKEN| STREAMING
    READY -->|send message| STREAMING
    
    STREAMING -->|recv TOOL_CALL| TOOL_PENDING
    STREAMING -->|recv STREAM_END| READY
    
    TOOL_PENDING -->|recv TOOL_RESULT| STREAMING
    
    STREAMING -->|connection drop| RECONNECTING
    TOOL_PENDING -->|connection drop| RECONNECTING
    READY -->|connection drop| RECONNECTING
    CONNECTING -->|timeout / error| RECONNECTING
    
    RECONNECTING -->|retry timer| CONNECTING
    RECONNECTING -->|max retries exceeded| DISCONNECTED

    classDef default fill:#18181b,stroke:#3f3f46,color:#fafafa,stroke-width:1.5px;
    classDef highlight fill:#fafafa,stroke:#fafafa,color:#000000,stroke-width:1.5px;
    class DISCONNECTED,RECONNECTING highlight;
```

---

## Quick Start Guide

### 1. Run the Agent Server
Navigate to the `agent-server` directory and start it (default is port 4747):
```bash
cd ../agent-server
npm install
npm start
```
*To test under network stress, run it in Chaos Mode:*
```bash
npm start -- --mode chaos
```

### 2. Run the Console Frontend
Navigate to the `agent-console` directory, install dependencies, and start the Next.js dev server:
```bash
cd ../agent-console
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run the Unit Tests
We have implemented extensive test suites covering the reordering buffer, diff engine, state store, and heartbeat handler:
```bash
npm run test  # Runs Vitest
```

---

## Application Screenshots

### A. Streamed Response with Tool Call Interrupt
![Tool Call Interrupt](./public/screenshots/screenshot_tool_call.png)

### B. Trace Timeline with Event Filters
![Trace Timeline](./public/screenshots/screenshot_trace.png)

### C. Context Inspector with Diff Highlights
![Context Inspector Diff](./public/screenshots/screenshot_context_diff.png)
