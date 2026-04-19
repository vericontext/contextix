---
date: 2026-04-18
domain: ai
tags: [ai, agents, mcp]
---

# Building agents

The practical stack for agent builders in 2026:

- **LLM**: [[Claude]] (Opus 4.7 for hard tasks, Haiku 4.5 for batch),
  [[GPT]], [[Llama]]
- **Tool interface**: [[MCP]] is winning (Claude Desktop, Cursor, Codex
  native). Alternative: direct tool_use on the API.
- **Memory / context**: [[Graphiti]], [[Cognee]], [[LightRAG]],
  [[contextix]] — each with different tradeoffs.
- **Orchestration**: [[LangChain]], [[CrewAI]], or just a `while` loop.

The big open question: how much should an agent "think" vs how much
should it call tools? [[Claude Code]]'s answer is mostly tools —
`bash`/`read`/`edit` do 80%+ of the work, the model reasons at
boundaries.

See also: [[ReAct]], [[Toolformer]], [[AutoGPT]] (historical).
