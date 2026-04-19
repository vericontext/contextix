# Contextix

**A CLI toolkit for agentic AI.** Point it at your sources (RSS, markdown, URLs, APIs). Agents extract entities and relations. Query the graph from your terminal, your agent, or via MCP.

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # optional but recommended (Haiku 4.5 extraction)
npx contextix ingest rss https://news.ycombinator.com/rss
npx contextix ingest markdown ~/notes
npx contextix why "AI export controls"
```

No Python. No Docker. No Neo4j. One `npx` command, your data stays local at `~/.contextix/graph.json`.

---

## Why

Your agent is smart about code, dumb about the world. Document RAG gives it text; vector search gives it snippets. Neither tells it **what happened, who's involved, and how it's connected**.

Contextix builds a **typed causal graph** from sources you choose. Agents query it via CLI — the same way they already call `git`, `rg`, or `curl` — so it slots into Claude Code, Cursor, Codex, Aider, or any shell-capable agent. MCP mode is bundled for Claude Desktop and MCP-native clients.

---

## Install

```bash
npm install -g contextix
contextix --help

# or one-shot
npx contextix ingest markdown ~/notes
```

Requires Node 20+. Optional: `ANTHROPIC_API_KEY` env var for agentic extraction (falls back to regex mode).

---

## CLI

### Ingest — point at sources

```bash
contextix ingest rss <url>              # RSS / Atom / RDF feed → events + entities
contextix ingest markdown <dir>         # Markdown vault → events + wikilink graph
contextix ingest url <url>              # Fetch a page, extract title/body/og-meta
contextix ingest json <file|dir>        # Pre-formatted graph fragment (agent output)
contextix ingest api <openapi.json>     # OpenAPI spec → schema entities  (roadmap)
```

Each ingest run:
1. Fetches / reads source
2. Runs extraction — **agentic** (Haiku 4.5 with tool-use) when `ANTHROPIC_API_KEY` is set, **regex** otherwise
3. Dedups entities (`BTC` / `Bitcoin` / `bitcoin` → one canonical node)
4. Merges into `~/.contextix/graph.json` with `valid_from` timestamps

Force a specific mode with `--extractor agentic|regex|auto` or env `CONTEXTIX_EXTRACTOR`.

### Markdown ingest specifics

- Walks recursively, skips `.git`, `node_modules`, `.obsidian`, `.trash`, `_templates`
- Parses YAML frontmatter (`date`, `domain`, `tags`) — flat key/value + inline/block lists
- Wikilinks `[[X]]` become `concept` entities with `related_to` edges from the note
- File mtime is used as `detectedAt` when frontmatter lacks `date`

### Query — ask the graph

```bash
contextix signals                       # Recent events (24h default)
contextix signals --domain crypto -t 7d
contextix why "<event>"                 # Causal chain (BFS backward)
contextix connect "<a>" "<b>"           # Shortest path between entities
contextix entities --search "fed"       # Entity lookup
```

Output is human-readable by default. `--json` for piping.

```bash
contextix signals --json | jq '.events[] | select(.importance == "CRITICAL")'
```

### Serve — MCP mode

```bash
contextix serve                         # stdio MCP server (default)
```

Same graph, exposed as 5 MCP tools: `contextix_signals`, `contextix_why`, `contextix_connect`, `contextix_entities`, `contextix_graph`.

### Export

```bash
contextix export --format json          # Full graph dump
contextix export --format mermaid       # Mermaid diagram (roadmap)
contextix export --format cypher        # Cypher for Neo4j import (roadmap)
```

---

## Use with your agent

### Claude Code (bash tool)

Your agent calls contextix directly — no MCP needed:

```
"ingest my daily reads then tell me why the market moved"
```

Claude Code runs:
```bash
contextix ingest rss https://feeds.bloomberg.com/markets/news.rss
contextix why "S&P drop" --depth 3
```

### Claude Desktop / Cursor (MCP)

`.mcp.json`:
```json
{
  "mcpServers": {
    "contextix": {
      "command": "npx",
      "args": ["contextix", "serve"]
    }
  }
}
```

### Scripts / cron

```bash
# Nightly ingest
0 2 * * * contextix ingest rss https://example.com/feed.xml
```

---

## Data model

```
SignalEvent ──causes──▶ SignalEvent
     │                        │
  involves                involves
     ▼                        ▼
  Entity  ──influences──▶  Entity
```

- **Edge types**: `causes`, `caused_by`, `correlates`, `involves`, `influences`, `precedes`, `contradicts`
- **Bi-temporal**: every edge has `valid_from` / `valid_until`; invalidated edges are kept so you can reconstruct the graph at any point in time
- **Confidence**: every edge carries a `[0,1]` score + an evidence string
- **Entity resolution**: fuzzy dedup via string similarity; canonical node + alias list
- **Storage**: one JSON file at `~/.contextix/graph.json`. Portable, inspectable, git-friendly

Full schema: [`src/graph/types.ts`](./src/graph/types.ts).

---

## What contextix is not

| | Contextix | GraphRAG / LightRAG | mcp-memory | Graphiti |
|---|---|---|---|---|
| Install | `npx contextix` | `pip + indexing` | MCP only | `pip + Neo4j` |
| Ingest from sources | ✅ RSS / md / URL | ❌ docs only | ❌ manual writes | ❌ SDK calls |
| CLI interface | ✅ primary | ❌ Python scripts | ❌ | ❌ Python |
| MCP mode | ✅ bundled | ❌ | ✅ only | ✅ |
| Local file graph | ✅ `graph.json` | ❌ | ✅ jsonl | ❌ Neo4j |

Contextix is **not** a RAG system, not a vector database, not a memory store for conversations. It's an agentic CLI that turns feeds and files into a queryable typed graph.

---

## Dogfood: contextix.io

[contextix.io](https://contextix.io) runs contextix on live crypto and AI sources. See what the graph looks like in production before you run it yourself.

---

## Roadmap

See [`ROADMAP.md`](./ROADMAP.md). Top priorities:

1. **Connectors**: RSS (shipping) → markdown vault → URL fetch → OpenAPI
2. **Agentic extraction**: replace regex parse with Haiku-based entity/relation extraction
3. **Bring-your-own-model**: OpenAI, Ollama, local LLM support
4. **Graph query depth**: PageRank, temporal decay, contradiction detection
5. **Hosted graph** (later): optional `--hosted` mode pulls curated crypto/AI graph from contextix.io

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Highest-impact areas:

- **New connectors** — every source type is one function in `src/ingest/`
- **Extraction prompts** — improve agentic entity/relation extraction
- **Query algorithms** — `src/graph/query.ts` (PageRank, confidence propagation, temporal decay)
- **Seed graph** — verified events in `data/seed-graph.json`

Star the repo if this is the graph tool you wanted to exist. File issues for connectors you'd use.

---

## License

MIT.
