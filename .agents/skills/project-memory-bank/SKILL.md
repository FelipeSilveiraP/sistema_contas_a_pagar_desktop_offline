---
name: project-memory-bank
description: >
  Protocol for token-efficient session continuity using the local Memory Bank.
  Directs the AI agent to consult and update .memory-bank/ files (activeContext.md,
  systemPatterns.md, progress.md) instead of rereading the entire codebase,
  saving up to 70% of tokens per session.
---

# Project Memory Bank Protocol

Maintain project memory across agent turns and conversations with minimal token footprint.

## Core Rules

1. **Start of Task:**
   - Read `.memory-bank/activeContext.md` and `.memory-bank/progress.md` before performing broad workspace scans.
   - Respect architectural decisions already recorded in `.memory-bank/systemPatterns.md`.

2. **End of Task / Milestone:**
   - Whenever an important decision is finalized, a component is completed, or a bug is resolved:
     - Update `.memory-bank/activeContext.md` (what changed, what is next).
     - Check off completed items in `.memory-bank/progress.md`.
     - Update `.memory-bank/systemPatterns.md` only if a new architectural pattern was introduced.

3. **Keep Files Compact:**
   - Never paste raw source code into Memory Bank files.
   - Use bullet points, concise summaries, and markdown tables.
