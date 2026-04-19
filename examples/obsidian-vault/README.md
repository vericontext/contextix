# Obsidian vault → Claude Desktop MCP

Turn your personal notes into a queryable knowledge graph your agent can traverse.

## What happens

- `contextix ingest markdown <vault>` walks every `.md` file
- YAML frontmatter (`date`, `domain`, `tags`) becomes event metadata
- Wikilinks `[[X]]` become `concept` entities connected via `related_to` edges
- Note body is passed to the extractor — Haiku 4.5 (with API key) or regex fallback — which finds people, orgs, tokens, policies, etc.
- The resulting graph is stored at `~/.contextix/graph.json`
- `contextix serve` exposes the graph via MCP stdio, Claude Desktop reads it

## Step 1 — Ingest your vault

```bash
contextix ingest markdown ~/Documents/ObsidianVault
```

Or use the sample vault in this directory to try before pointing at your own:

```bash
contextix ingest markdown ./sample-vault --extractor regex
```

Expected output (regex mode):

```
[ingest markdown] extractor: regex
[ingest markdown] scanning ./sample-vault
[ingest markdown] done — events:+4 entities:+14 relations:+18
[ingest markdown] graph → ~/.contextix/graph.json
```

## Step 2 — Verify the graph

```bash
contextix signals -t 30d
contextix entities --search "ethereum"
```

## Step 3 — Wire into Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Restart Claude Desktop. The 5 contextix tools (`contextix_signals`, `contextix_why`, `contextix_connect`, `contextix_entities`, `contextix_graph`) will appear.

## Step 4 — Ask your agent

Try prompts like:

- *"Using the contextix tools, summarize what I've been reading about Bitcoin this month."*
- *"What concepts are most connected to Satoshi Nakamoto in my notes?"*
- *"Trace the causal chain behind the Ethereum Pectra upgrade — use contextix_why."*

## Refresh workflow

Vault changes? Re-ingest. Contextix dedups by deterministic ID, so re-runs are idempotent:

```bash
# Run nightly or after a writing session
contextix ingest markdown ~/Documents/ObsidianVault
```

Want incremental instead of full re-ingest? That's on the roadmap — `contextix watch markdown <dir>`.
