# Contextix

**Cross-domain signal graph for AI agents.** Give your agent world context — not just documents.

```bash
npx contextix serve
```

Adds 5 MCP tools to Claude Code or Cursor. Your agent can now answer:
- *"Why did BTC drop this week?"* → traces causal chain across macro + crypto
- *"How is the Fed connected to ETH?"* → finds cross-domain path
- *"What's happening in AI right now?"* → returns structured signal graph

---

## Install

**Claude Code / Cursor (MCP)**

Add to your `.mcp.json`:

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

contextix serve                          # Start MCP server
contextix signals --domain crypto        # Recent signals
contextix run crypto                     # Run synthesis pipeline
```

---

## Tools

| Tool | Description |
|---|---|
| `contextix_signals` | Recent cross-domain signals (crypto, macro, AI) |
| `contextix_why` | Trace causal chain for any event |
| `contextix_connect` | Find path between two entities across domains |
| `contextix_entities` | Search entities in the signal graph |
| `contextix_graph` | Extract subgraph within N hops |

---

## How It Works

Contextix maintains a **typed causal graph** — not a document store, not a vector index.

```
SignalEvent ──causes──▶ SignalEvent
     │                        │
  involves                involves
     ▼                        ▼
  Entity  ──influences──▶  Entity
```

Edges are typed (`causes`, `correlates`, `influences`, `precedes`, `contradicts`) and confidence-weighted (0–1).

### Synthesis Pipeline (optional)

If you want to generate your own graph from live data:

```bash
contextix run crypto    # crypto signals via CoinGecko + Etherscan
contextix run macro     # macro signals via web search
```

The pipeline uses Claude agents defined in [`agents/`](./agents/) — open-source synthesis methodology.

---

## Architecture

```
src/
  index.ts          ← CLI entry (commander)
  server.ts         ← MCP server (@modelcontextprotocol/sdk)
  graph/
    types.ts        ← SignalEvent, Entity, Relation, SignalGraph
    store.ts        ← LocalJsonStore (~/.contextix/graph.json)
    query.ts        ← BFS causal chain, path finding, subgraph
    ingest.ts       ← Pipeline JSON → SignalGraph merge
  tools/            ← 5 MCP tool handlers
  parse/            ← stdin → structured signal JSON

agents/             ← synthesis methodology (open)
data/
  seed-graph.json   ← 20+ events, 30 entities, 60+ relations (works offline)
```

---

## Methodology

The [`agents/`](./agents/) directory contains the open-source synthesis rules:

- **Importance thresholds** per domain (what signal to ignore)
- **Cross-domain causal rules** (Fed rate → BTC, CPI → stablecoin flows, AI compute → GPU markets)
- **Evidence standards** (every causal edge requires specific data, not vague assertions)
- **Confidence scoring** (0.9+ = strong evidence, 0.7–0.9 = moderate, <0.7 = speculative)

This methodology is the core contribution — not just the code.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

Areas where contributions matter most:
- New domain agents (energy, geopolitics, biotech)
- Additional causal rules in `agents/`
- Graph query algorithms in `src/graph/query.ts`
- Seed data quality in `data/seed-graph.json`

---

## License

MIT
