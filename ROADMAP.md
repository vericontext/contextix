# Contextix Roadmap (OSS)

Goal: `npx contextix` becomes the default way indie devs and AI agents turn their own sources into a queryable knowledge graph. North-star metric: GitHub stars + weekly active npm installs.

## Phase 0: Pivot cleanup `IN PROGRESS`

Strip the old "cross-domain signal graph" product framing. Re-anchor on CLI-first + ingest-first.

- [x] Rewrite README / CLAUDE.md / ROADMAP for CLI-first positioning (2026-04-19)
- [x] Rewrite `CONTRIBUTING.md` (remove monorepo refs, update asks) (2026-04-19)
- [x] Remove `agents/*.md` (platform-specific subagent prompts, duplicate of `contextix-platform/.claude/agents/`) (2026-04-19)
- [x] `package.json` keywords cleaned up — added `cli`, `ingest`, `agentic`, `typescript`, `rss`, `markdown`, `obsidian` (2026-04-19)
- [x] `package.json` description: "CLI toolkit for agentic AI. Ingest any source..." (2026-04-19)

## Phase 1: Ingest connectors `IN PROGRESS`

Ship the core wedge: point at a source, get a graph. This is what everything hinges on.

### MCP skills `COMPLETED`

The primary wedge — turn any MCP server into graph nodes via a single
`.mjs` skill file. 10,000+ MCP servers become potential sources.

- [x] `src/ingest/mcp.ts` — launches MCP server via `@modelcontextprotocol/sdk` stdio, runs skill, collects emits (2026-04-19)
- [x] `src/skill/types.ts` + `defineSkill` helper + `contextix/skill` subpath export (2026-04-19)
- [x] Env interpolation (`${VAR}` in mcpServer.env) + `requiredEnv` validation (2026-04-19)
- [x] Deterministic entity/event/relation IDs, cross-run dedup (2026-04-19)
- [x] `examples/skills/hackernews-top.mjs` (keyless) — 20 stories + author entities per run (2026-04-19)
- [x] `examples/skills/coingecko-markets.mjs` (env gated) — top 20 coins + global snapshot (2026-04-19)
- [x] `examples/skills/arxiv-ai.mjs` (keyless) — recent papers + author entities (2026-04-19)
- [x] `examples/skills/README.md` — full skill-authoring guide (2026-04-19)
- [ ] `contextix skills list` / `install` — skill discovery + package registry (v0.4)
- [ ] `@contextix/skills-crypto` / `-ai` / `-dev` — official reference packs published to npm

### RSS / Atom `COMPLETED`
- [x] `src/ingest/rss.ts` — fetch + parse RSS 2.0 / Atom / RDF (2026-04-19)
- [x] `contextix ingest rss <url>` CLI command (2026-04-19)
- [x] `fast-xml-parser` dep; handles CDATA, HTML entities, relative URLs (2026-04-19)
- [x] Item → event mapping with pubDate → detectedAt, guid/link → source url (2026-04-19)

### Markdown vault `COMPLETED`
- [x] `src/ingest/markdown.ts` — recursive walk, YAML frontmatter, wikilinks (2026-04-19)
- [x] `contextix ingest markdown <dir>` CLI command (2026-04-19)
- [x] Wikilinks `[[X]]` → `concept` entities + `related_to` edges (2026-04-19)
- [x] Frontmatter: `date`, `domain`, `tags`; flat key/value + inline/block lists (2026-04-19)
- [x] Added `concept` to `EntityType` schema for wikilink targets (2026-04-19)
- [ ] `contextix watch markdown <dir>` — incremental re-ingest on changes

### URL fetch `COMPLETED`
- [x] `src/ingest/url.ts` — fetch + heuristic main-content extraction (2026-04-19)
- [x] `contextix ingest url <url>` — single page (2026-04-19)
- [x] OG / Twitter / standard meta tags → title, description, pubDate, siteName (2026-04-19)
- [x] Main content detection: `<article>` → `<main>` → `<body>`; strip script/style/nav/header/footer/aside/form (2026-04-19)
- [ ] `contextix ingest url --file urls.txt` — batch mode (shell alternative: `xargs -I{} contextix ingest url {}`)
- [ ] Cache fetches in `~/.contextix/cache/<hash>` to avoid re-downloading
- [ ] Upgrade to `@mozilla/readability` + `jsdom` if regex quality is limiting

### OpenAPI / JSON API `PLANNED`
- [ ] `src/ingest/api.ts` — OpenAPI spec → schema entities
- [ ] Useful for agents that need to understand an API surface

## Phase 2: Extraction `IN PROGRESS`

Replace the regex stub with real entity / relation extraction.

- [x] `src/extract/regex.ts` — schema-conformant regex extractor (`SignalEvent`/`Entity`/`Relation` with ids, confidence, evidence) (2026-04-19)
- [x] `src/extract/agentic.ts` — Haiku 4.5 + strict tool_use + prompt caching + SDK 5× retry + regex fallback (2026-04-19)
- [x] Auto-select: `ANTHROPIC_API_KEY` present → agentic, else regex (2026-04-19)
- [x] `--extractor agentic|regex|auto` CLI flag + `CONTEXTIX_EXTRACTOR` env override (2026-04-19)
- [x] Token usage summary at end of ingest (calls, input, output, cache hit%) (2026-04-19)
- [ ] Bring-your-own-model: `CONTEXTIX_MODEL=openai:gpt-4o-mini` / `ollama:llama3` support
- [ ] Cache extracted results (hash source content) — re-ingest skips unchanged items

## Phase 3: Query depth `PLANNED`

Make `why` and `connect` feel magical, not just BFS.

- [ ] Confidence propagation — chain confidence = product of edge confidences (not just shortest path)
- [ ] Temporal decay — old edges weight down by default, `--as-of <date>` time-travels the graph
- [ ] PageRank-style entity importance for disambiguation
- [ ] Contradiction detection — surface `contradicts` edges in `why` output
- [ ] `contextix graph-stats` — node count, edge count, domain breakdown, orphan nodes

## Phase 4: Output formats `PLANNED`

- [ ] `contextix export --format mermaid` — Mermaid diagram subgraph
- [ ] `contextix export --format cypher` — Neo4j import script
- [ ] `contextix export --format d2` — D2 diagram
- [ ] `--json` on every query command for piping

## Phase 5: Dev experience `PLANNED`

- [ ] `contextix init` — write starter `.contextix/config.yml` with ingest schedule
- [ ] `contextix doctor` — diagnose common issues (perms, API key, graph integrity)
- [ ] `contextix serve --http` — HTTP transport for MCP (not just stdio)
- [ ] GIF demo in README — 20s `npx contextix ingest rss ... && contextix why ...` loop
- [ ] Example connectors in `examples/` — RSS → graph → Claude Desktop walkthrough
- [ ] VS Code extension (later) — visualize graph inline

## Phase 6: Hosted mode (optional, platform-side)

Users who don't want to run their own pipeline can pull the curated crypto/AI graph.

- [ ] `contextix serve --hosted` — read-only mode, pulls from contextix.io
- [ ] `CONTEXTIX_API_KEY` env var auth
- [ ] Free tier: 1k queries / day. Pro: $9/mo unlimited. Enterprise: private graphs.
- [ ] (Hosted side lives in `contextix-platform`, not here.)

## Phase 7: Ecosystem

- [ ] LangChain tool wrapper (`@contextix/langchain`)
- [ ] Vercel AI SDK tool definition
- [ ] Python bindings (`pip install contextix-client` — thin client over CLI/HTTP)
- [ ] Community connectors — Notion, Linear, GitHub, Slack, Gmail (contributed)

---

## Decision Log

### 2026-04-19: Pivot from "cross-domain signal graph" to "agentic CLI for any source"
- **Context**: Cross-domain crypto+AI graph has no clear buyer persona. AI agent builders work in narrow verticals. Meanwhile LightRAG (34k⭐), Graphiti (25k⭐), Cognee (16k⭐) own graph-RAG, temporal memory, and AI memory respectively. Official mcp-memory has no ingest — clear wedge.
- **Decision**: Re-anchor OSS on "point contextix at your sources → agentic extraction → queryable graph". CLI-first (MCP is one consumption mode). TS/Node (peers are all Python). Domain-agnostic (crypto/AI become dogfood at contextix.io, not product pitch).
- **Consequence**: (1) Deprecate "cross-domain" as headline (2) Rewrite README / CLAUDE / ROADMAP (3) Build out `src/ingest/` connector pattern (4) Replace regex parse with agentic Haiku extraction (5) contextix.io becomes showcase + hosted graph CTA, not the product.

### 2026-04-19: CLI-first over MCP-first
- **Context**: Initial framing was "MCP-native graph server". But modern agents (Claude Code, Cursor, Codex, Aider) shell out to CLIs directly, and "MCP server for X" is a crowded GitHub topic. Successful peers (Graphiti, Cognee, LightRAG) all lead with a programmatic surface; MCP is a consumption mode.
- **Decision**: Lead positioning with CLI (`contextix ingest`, `contextix why`). Keep `contextix serve` as the MCP mode but never frame it as the identity. Ship CLI handlers first; MCP tools wrap them.
- **Consequence**: (1) Every feature must work in shell first (2) `--json` flag on every query command for piping (3) Docs show bash examples before MCP config (4) Agents that can't run MCP (Claude Code bash, cron scripts) still work.

### 2026-04-19: TypeScript / Node.js only
- **Context**: All serious graph-RAG tools are Python (LightRAG, GraphRAG, Graphiti, Cognee). But MCP clients live in TS/Node (Claude Desktop, Cursor, Codex), and `npx` is the default MCP install pattern.
- **Decision**: Stay TS-only. No Python bindings in-repo. Future Python interop via HTTP/CLI client.
- **Consequence**: (1) Clean install (npm only) (2) First-class `npx` experience (3) Lose some ML library access — offset by using Claude/OpenAI for extraction instead of local NLP libs.
