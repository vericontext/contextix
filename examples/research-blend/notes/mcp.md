---
date: 2026-04-10
tags: [mcp, tool-use, agents]
---

# Model Context Protocol

[[MCP]] is a protocol Anthropic introduced in late 2024 to standardize
how LLM agents call tools and read external context. Client (e.g.
[[Claude Desktop]], [[Cursor]]) launches one or more servers; servers
expose tools over stdio or HTTP.

Why it matters:
- Decouples tool *authors* from agent *runtimes*. Before MCP, every
  agent framework had its own tool format.
- Bundles three primitives: tools, resources, prompts. Most servers
  only ship tools.
- Transport is JSON-RPC over stdio by default — simple enough that a
  single file can be an MCP server (e.g. [[contextix]] `serve`).

Failure modes:
- Servers that advertise too many tools overflow the context window.
  Solution: [[tool search]] or dynamic discovery.
- Permission model is per-tool, not per-call — which makes gating
  side-effectful tools awkward.

See also: [[JSON-RPC]], [[agent frameworks]].
