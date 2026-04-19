# Changelog

## 0.3.0 — 2026-04-19

Major repositioning: **CLI toolkit for agentic AI**. Primary wedge is
`ingest mcp` — turn any MCP server into graph nodes via a single
skill file. File-based connectors (RSS / markdown / URL) remain.

### Added

- **MCP ingest + skill format** — `contextix ingest mcp <skill-file>`
  launches any MCP server via `@modelcontextprotocol/sdk` stdio,
  runs a skill's imperative `run({mcp, emit, log})` function, and
  collects emitted entities / events / relations into a GraphFragment.
  Skills are `.mjs` / `.js` files exporting `defineSkill({...})` from
  `contextix/skill` subpath. Env interpolation (`${VAR}`), eager
  `requiredEnv` validation, deterministic IDs with cross-run dedup.
  Reference skills in `examples/skills/` for HackerNews (keyless),
  CoinGecko (env-gated), arXiv (keyless).
- **Ingest connectors** — `contextix ingest <kind> <source>` now supports:
  - `mcp` — any MCP server via a skill file **(primary wedge)**
  - `rss` — RSS 2.0 / Atom / RDF feeds via `fast-xml-parser`
  - `markdown` — recursive walk with YAML frontmatter, wikilink → `concept` entities
  - `url` — single-page fetch with OG / Twitter meta + heuristic main-content extraction
  - `json` — pre-formatted graph fragments (legacy path preserved)
- **Agentic extraction** — `src/extract/agentic.ts` uses Claude Haiku 4.5 with
  strict `tool_use`, prompt caching, 5× SDK retry, regex fallback on error.
  Auto-selects when `ANTHROPIC_API_KEY` is set; override with `--extractor
  agentic|regex|auto` or `CONTEXTIX_EXTRACTOR` env var.
- **Token usage summary** — every batch ingest reports calls, input/output
  tokens, cache write/read tokens, and cache hit rate.
- **CLI** — `--json` flag on query commands for piping; `signals`, `why`,
  `connect`, `entities` (CLI surface mirrors MCP tools).
- **Entity types** — added `concept` (wikilink targets) and `model` (AI
  models).
- **Examples** — `examples/obsidian-vault`, `examples/daily-rss`,
  `examples/research-blend` with runnable scripts and sample data.
- **GitHub templates** — issue templates (bug, feature, connector
  request), PR template, Discussions link.
- **Demo tooling** — `scripts/record-demo.md` + `scripts/demo-run.sh`
  for the README GIF.

### Changed

- **Pitch** — from "cross-domain signal graph MCP" to "CLI toolkit for
  agentic AI. Ingest any source into a queryable knowledge graph."
  CLI-first positioning; MCP is one consumption mode, not the identity.
- **README / CLAUDE.md / ROADMAP.md / CONTRIBUTING.md** — rewritten to
  match. Landing page at contextix.io aligned.
- **package.json** — description and keywords refreshed.

### Removed

- `agents/*.md` — platform-specific subagent prompts moved to the
  private `contextix-platform` repo. OSS no longer ships these.

### Notes

Companion changes in the private `contextix-platform` repo add a hosted
graph API under `/api/graph` — a preview of what `contextix serve
--hosted` will eventually pull from.

## 0.2.0 — 2026-03-xx

- Bi-temporal model + entity resolution
- SupabaseStore hosted graph backend + auto-ingest pipeline

## 0.1.0 — initial release

- Local JSON graph store
- 5 MCP tools: signals, why, connect, entities, graph
- Seed data for crypto + macro
