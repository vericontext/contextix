# Research topic blend — papers + URLs + notes into one graph

The most powerful use of contextix: blend multiple source types for one
research topic. Your agent then queries across all of them as one graph.

This example tracks a single theme — **"LLM agents & tool use"** — and
pulls from arXiv RSS, a hand-picked URL list, and a small notes vault.

## Step 1 — Seed the vault

Your own notes are the most important signal. Drop a few markdown files
in `./notes/` with wikilinks to concepts you care about.

Sample notes included:
- `notes/mcp.md` — primer on Model Context Protocol
- `notes/react-framework.md` — ReAct reasoning framework
- `notes/agent-survey.md` — personal reading notes

## Step 2 — Run the blend script

```bash
./blend.sh
```

This runs three ingests in order:

```bash
contextix ingest rss http://arxiv.org/rss/cs.AI --max 10 --domain ai
contextix ingest markdown ./notes --domain ai
cat urls.txt | xargs -I{} contextix ingest url {} --domain ai
```

Expected scale: 25–40 events, 60–100 entities, 80–150 relations.

## Step 3 — Ask questions the single-source tools can't answer

```bash
# "What agent concepts appear across papers AND my notes?"
contextix entities --domain ai --type concept -n 20

# "Trace causal chain around ReAct"
contextix why "ReAct" --depth 3

# "How is MCP connected to tool use?"
contextix connect "MCP" "tool use"
```

Or plug into Claude Desktop via MCP and ask in plain English:

> *"Using contextix tools, synthesize what the papers say about agent
> planning vs. what I've noted myself. Where do they agree and where
> do they diverge?"*

## Why this works

- **arXiv** contributes freshly-extracted paper entities (authors,
  methods, benchmarks)
- **URLs** contribute blog-post context (author opinions, code refs)
- **Markdown notes** contribute the shape of your own understanding
  (wikilinks become `related_to` edges)
- Contextix dedups: "RLHF" in a paper and `[[RLHF]]` in your note collapse
  to one entity. Your note automatically connects to every paper that
  mentions the concept.

This is the payoff of a graph over a vector store — cross-source
identity is a first-class operation, not a similarity guess.
