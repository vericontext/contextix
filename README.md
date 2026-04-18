# Contextix

**The world-context MCP for AI agents.**

There are 10,000+ MCP servers. They connect agents to databases, code editors, and SaaS tools. None of them tell your agent what's happening in the world right now — and *why*.

Contextix is a cross-domain signal graph. It gives your agent structured, causal world-context across crypto, macro, AI, and media — not raw data feeds, not documents. A graph of what happened, who's involved, and how it's connected.

```bash
npx contextix serve
```

---

## What your agent can now answer

- *"Why did BTC drop 8% this week?"* → traces causal chain: Fed hawkish signal → DXY spike → risk-off rotation → crypto sell pressure
- *"How is the NVIDIA export ban connected to stablecoin flows?"* → BFS path: export ban → GPU supply squeeze → AI compute cost → stablecoin treasury reallocation
- *"What's the macro regime right now?"* → returns structured signal graph with confidence weights
- *"Which entities overlap across the AI and crypto domains this month?"* → entity intersection with typed relationships

---

## Quickstart

**Claude Code / Cursor (MCP)**

Add to `.mcp.json`:

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

**Claude Desktop**

Add to `claude_desktop_config.json`:

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

**CLI**

```bash
npm install -g contextix

contextix serve                            # Start MCP server (stdio)
contextix signals --domain crypto          # Print recent signals
contextix signals --domain macro -t 7d     # Macro signals, last 7 days
contextix ingest <insights-dir> <out.json> # Ingest pipeline output into graph
```

Works offline with seed data out of the box. No API keys required for the core graph.

---

## MCP Tools

| Tool | What it does |
|---|---|
| `contextix_signals` | Recent signals across domains — events, importance, confidence |
| `contextix_why` | Trace causal chain backward from any event |
| `contextix_connect` | Find cross-domain path between two entities or topics |
| `contextix_entities` | Search entities (tokens, people, orgs, indicators, policies) |
| `contextix_graph` | Extract raw subgraph for visualization or analysis |

### Example: `contextix_why`

```json
{
  "event": "BTC -8% June 2025",
  "depth": 3
}
```

Returns:

```
BTC -8% ← caused_by → Fed holds rates (0.92)
Fed holds rates ← precedes → DXY +1.4% (0.87)
DXY +1.4% ← influences → crypto risk-off (0.81)
```

### Example: `contextix_connect`

```json
{
  "from": "NVIDIA export ban",
  "to": "USDC treasury",
  "maxHops": 4
}
```

Returns shortest path with typed, confidence-weighted edges across domains.

---

## How It Works

Contextix maintains a **typed causal graph** — not a vector index, not a document store.

```
SignalEvent ──causes──▶ SignalEvent
     │                        │
  involves                involves
     ▼                        ▼
  Entity  ──influences──▶  Entity
```

**Edge types:** `causes`, `caused_by`, `correlates`, `involves`, `influences`, `precedes`, `contradicts`

Every edge has a **confidence score** (0–1) and an **evidence string** — no black-box assertions.

**Domains:** `crypto`, `macro`, `ai`, `media`, `geopolitics` (extensible)

**Stored at:** `~/.contextix/graph.json` (local, portable, no cloud dependency)

---

## Synthesis Pipeline (optional)

The seed graph ships with 20+ events, 30 entities, 60+ relations. To run live synthesis:

```bash
# Run the agent pipeline (requires Claude Code + API keys)
# See agents/ directory for methodology and setup
contextix ingest ./agents/output/crypto ./data/graph.json
```

The synthesis pipeline is Claude agent-based and defined in [`agents/`](./agents/) — the methodology (importance thresholds, causal rules, evidence standards) is fully open-source.

---

## Architecture

```
src/
  index.ts          ← CLI entry (commander)
  server.ts         ← MCP server (stdio transport)
  config.ts         ← ~/.contextix config + env
  graph/
    types.ts        ← SignalEvent, Entity, Relation, SignalGraph
    store.ts        ← LocalJsonStore (graph.json)
    query.ts        ← BFS causal chains, path finding, subgraph
    ingest.ts       ← pipeline JSON → graph merge
  tools/            ← 5 MCP tool handlers
  parse/            ← text → structured signal JSON

agents/             ← open-source synthesis methodology
data/
  seed-graph.json   ← works offline, no API keys
```

---

## Why not just use raw data MCPs?

| | Raw data MCPs (CoinGecko, FRED, etc.) | Contextix |
|---|---|---|
| **What you get** | Price feeds, time-series, indicators | Synthesized events with causal edges |
| **Cross-domain** | No — single domain per server | Yes — crypto ↔ macro ↔ AI ↔ media |
| **Causality** | No — data points only | Yes — typed, evidence-backed edges |
| **Agent query** | "What is BTC price?" | "Why is BTC moving? What else is connected?" |
| **Setup** | Multiple servers, multiple APIs | One `npx` command, works offline |

Contextix is not a replacement for raw data MCPs. It's the synthesis layer on top — the map your agent uses to navigate before drilling into raw data.

---

## Hosted Graph (coming soon)

The local graph requires running the synthesis pipeline yourself. The hosted graph:

- Updated continuously via the [Contextix Platform](https://contextix.io)
- No pipeline setup required
- Higher signal quality (cross-validated, human-reviewed edges)
- Additional domains (energy, geopolitics, biotech)

```json
{
  "mcpServers": {
    "contextix": {
      "command": "npx",
      "args": ["contextix", "serve", "--hosted"],
      "env": { "CONTEXTIX_API_KEY": "your-key" }
    }
  }
}
```

Star this repo to be notified at launch.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

The highest-impact contributions:

- **New domain agents** in `agents/` — energy, geopolitics, biotech, regulatory
- **Causal rules** — domain-specific heuristics for edge inference
- **Graph query algorithms** — `src/graph/query.ts` (PageRank, temporal decay, confidence propagation)
- **Seed data quality** — `data/seed-graph.json` (verified events, sourced edges)
- **New data source integrations** — FRED, arXiv, SEC filings, Polymarket

If you're adding a new domain, start by defining its entity types and causal rule primitives in `agents/`.

---

## License

MIT — core graph engine and CLI.

The hosted graph and synthesis pipeline are proprietary services.
