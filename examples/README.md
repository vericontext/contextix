# Examples

Three runnable walkthroughs showing contextix on different source types.

| Example | Use case | Time |
|---|---|---|
| [`obsidian-vault`](./obsidian-vault) | Point contextix at your Obsidian vault, query from Claude Desktop | 5 min |
| [`daily-rss`](./daily-rss) | Nightly cron ingesting crypto / AI feeds into a local graph | 3 min |
| [`research-blend`](./research-blend) | Blend arXiv abstracts + URLs + your notes into one graph for a research topic | 10 min |

All examples assume `contextix` is installed globally (`npm i -g contextix`) or you can prefix every command with `npx`.

## Prerequisites

```bash
node --version   # 20+
npm i -g contextix
export ANTHROPIC_API_KEY=sk-ant-...   # optional, enables Haiku 4.5 extraction
```

Without `ANTHROPIC_API_KEY` contextix falls back to regex extraction — faster, free, lower quality. Start without it to confirm the flow, then add it once you see what the graph looks like.

## Shared workflow

Every example follows the same shape:

```bash
contextix ingest <kind> <source>   # build / grow the graph
contextix signals -t 7d            # see what landed
contextix why "<event>"            # traverse causal chain
contextix connect "<a>" "<b>"      # shortest path between two nodes
contextix serve                    # expose as MCP to Claude Desktop / Cursor
```

The graph lives at `~/.contextix/graph.json` — a single portable JSON file you can inspect, diff, or version-control.
