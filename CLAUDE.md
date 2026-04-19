# Contextix (OSS)

Agentic CLI that turns sources (RSS, markdown, URLs, APIs) into a typed knowledge graph. Agents query via CLI, MCP, or HTTP.

This is the **OSS repo** (`vericontext/contextix`, published as `contextix` on npm). Target: indie devs, AI engineers, Claude Code / Cursor / Codex users. Goal: GitHub stars, developer adoption. Paired with `contextix-platform` (private) which runs the hosted dogfood at contextix.io.

## Positioning

- **Headline**: CLI-first. MCP is one consumption mode, not the identity.
- **Wedge**: npx + TS/Node + sources-in + agent-built graph. Competitors are Python libs (LightRAG, Graphiti, Cognee) or schema-less memory stores (official mcp-memory).
- **Do NOT lead with**: "cross-domain", "temporal graph" (Graphiti owns), "AI memory" (Cognee owns), "graph RAG" (LightRAG owns).

## Architecture

```
src/
  index.ts         ← CLI entry (commander) — top-level commands
  server.ts        ← MCP server (stdio) — one of N consumption modes
  config.ts        ← ~/.contextix config + env vars
  graph/
    types.ts       ← SignalEvent, Entity, Relation, SignalGraph
    store.ts       ← LocalJsonStore (~/.contextix/graph.json)
    supabase-store.ts ← Hosted mode (--hosted flag, later)
    query.ts       ← BFS causal chains, path finding, subgraph
    ingest.ts      ← Merge graph fragments → unified graph
  ingest/          ← Source connectors (TO ADD)
    rss.ts         ← RSS/Atom → events + entities
    markdown.ts    ← markdown vault → entities + refs
    url.ts         ← fetch + extract
  extract/         ← Extraction backends (TO ADD)
    agentic.ts     ← Claude/Haiku-based (ANTHROPIC_API_KEY)
    regex.ts       ← Rule-based fallback
  tools/           ← 5 MCP tool handlers (also called by CLI)
    signals.ts  why.ts  connect.ts  entities.ts  graph.ts
  parse/           ← stdin → fragment JSON (basic regex; replaced in batch paths by extract/)

data/seed-graph.json   ← ships with package, works offline
```

## CLI Surface

Top-level commands (flat, no sub-groups — agents type these in shell):

```
contextix ingest <kind> <source>   # kind: rss | markdown | url | json | api
contextix signals [--domain] [-t]  # recent events
contextix why <event> [--depth]    # causal chain BFS backward
contextix connect <a> <b>          # shortest path
contextix entities [--search]      # entity lookup
contextix serve [--hosted]         # MCP stdio mode
contextix export [--format]        # json | mermaid | cypher
```

Every query command supports `--json` for piping. Output defaults to human-readable.

## Connector Interface (to build)

Each connector is one file in `src/ingest/` implementing:

```typescript
export async function ingestRss(url: string, opts: IngestOpts): Promise<GraphFragment> {
  // 1. fetch source
  // 2. call extract (agentic or regex based on env)
  // 3. return { events, entities, relations }
}
```

Merge path: `GraphFragment` → `graph/ingest.ts` `mergeFragment()` → `graph.json`. Entity dedup happens at merge time.

## Extraction Modes

- **Agentic** (default when `ANTHROPIC_API_KEY` set): Haiku prompt returns structured JSON (events, entities, relations). Cost: ~$0.001 per source fetch.
- **Regex** (fallback): rule-based extraction. Works offline, lower quality. Current `src/parse/index.ts` is the starting point.
- **Bring-your-own-model** (roadmap): OpenAI, Ollama, local LLM via env vars.

## Key Principles

- **CLI first**: every feature must work from shell. MCP is a wrapper around CLI handlers.
- **Local by default**: `~/.contextix/graph.json`, no cloud required. Hosted mode is opt-in via `--hosted`.
- **Schema is the product**: typed edges + confidence + bi-temporal. Don't let it rot into a bag of strings.
- **Cheap to run**: Haiku for extraction, regex fallback for offline/API-less use. Never require Sonnet/Opus.
- **No feature creep**: if it's not "source → graph" or "query graph", it doesn't belong here. Article publishing, news digests, and cross-domain synthesis belong in `contextix-platform`.

## Development

```bash
npm install
npm run build          # tsup → dist/
npm run typecheck
node dist/index.js ingest rss <url>   # local test
node dist/index.js serve              # MCP test (pipe JSON-RPC)
```

Publish: `npm version patch && npm publish` (after local smoke test).

## Relationship to contextix.io

The hosted graph you see at [contextix.io](https://contextix.io) is a dogfood showcase — we run this OSS on curated crypto + AI sources and display the result. The scheduler, hosting, UI, and source curation all live in a separate private repo; none of that infrastructure belongs in this OSS package.

- **Do not** import hosting-layer code (Next.js frontend, scheduled batch, Supabase-specific dedup logic) into this repo.
- **Do** keep the core engine self-contained so any dev can run the same pipeline on their own sources.

## What NOT to add here

- Article publishing / HTML rendering (platform-only)
- Scheduled job orchestration (platform-only; users can `cron` the CLI)
- Authentication / API keys / billing (platform-only, for hosted mode)
- Supabase as a required dependency (optional for `--hosted`)
- Cross-domain narrative as the pitch (keep the schema domain-agnostic; `domain` is just a string tag)
- Python anything

## Roadmap Update

Update `ROADMAP.md` when tasks complete or direction changes. Format: `- [x] Done (YYYY-MM-DD)` / `- [ ] Pending`. Log architecture decisions in the Decision Log with Context / Decision / Consequence.
