---
date: 2026-04-15
tags: [agents, reading-notes]
---

# Agent builder landscape — personal notes

Rough mental map after a week of reading:

## Research lineage

[[ReAct]] → [[Toolformer]] → tool-use APIs → [[MCP]] → [[Managed Agents]].
Each step: less burden on prompt engineering, more on the runtime.

## Production stacks (as of 2026)

- **Claude Code** — bash + file ops + web tools, tight feedback loop
- **Cursor** — agentic editor with code-centric tools
- **Devin** / **SWE-agent** — longer-horizon coding agents
- **Perplexity** — agentic search, short-horizon
- **Replit Agents** — full-stack code generation

## Open research threads

- Memory: [[Graphiti]] (temporal), [[Cognee]] (remember/recall), [[LightRAG]]
- Tool selection: [[tool search]] for large tool sets
- Agent identity: do sub-agents need their own system prompt? (see
  [[spawn]] patterns in Claude Code)
- Verification: [[constitutional AI]] applied to agent outputs

## My open questions

- Is [[MCP]] the right abstraction, or will it collapse into "agents
  as HTTP services" over time?
- What's the compute shape of a 2027 agent — 10 small turns or 1 huge
  one?
- Where does the [[graph database]] fit? (motivating contextix.)
