---
date: 2026-04-12
tags: [react, reasoning, agents]
---

# ReAct

[[ReAct]] (2022) is the reasoning-and-acting framework for LLM agents.
The model alternates "thought" and "action" steps — thought is
free-form reasoning, action is a tool call. Results come back as
observations; the loop continues.

Practical impact: ReAct is the ancestor of almost every modern agent
loop. Claude Code, Cursor, AutoGPT, LangChain agents all descend from
it. The tool-use API on [[Claude]] and [[GPT]] is essentially ReAct
with the tool schema made explicit.

Limitations:
- Depends on the LLM's ability to decompose tasks — small models
  struggle.
- No native parallelism (sequential by design).
- Error recovery is ad-hoc.

See also: [[Toolformer]] (learned tool invocation), [[AutoGPT]]
(popular ReAct wrapper, historical).
