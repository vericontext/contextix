# Skills

A **skill** is a single file that tells contextix how to talk to one MCP
server and what to extract from it. Drop a skill file in this directory,
run `contextix ingest mcp <file>`, and the skill's output lands in your
graph.

## Quickstart

```bash
# Example 1 — keyless: Hacker News top stories
contextix ingest mcp ./hackernews-top.mjs

# Example 2 — needs an env var
COINGECKO_DEMO_API_KEY=CG-xxx \
  contextix ingest mcp ./coingecko-markets.mjs

# Example 3 — arXiv AI papers, keyless
contextix ingest mcp ./arxiv-ai.mjs
```

After any ingest:

```bash
contextix signals -t 1d
contextix why "<title from the output>"
contextix connect "<entity a>" "<entity b>"
```

## Anatomy of a skill

```js
import { defineSkill } from "contextix/skill";

export default defineSkill({
  name: "my-skill",
  description: "one-line purpose",
  version: "0.1.0",

  // How to start the MCP server. Same shape as a .mcp.json entry.
  mcpServer: {
    command: "npx",
    args: ["-y", "@some-org/some-mcp"],
    env: { SOME_API_KEY: "${SOME_API_KEY}" },  // interpolated from process.env
  },

  // (optional) documents which env vars are required; runner hard-errors if missing
  requiredEnv: ["SOME_API_KEY"],

  // (optional) default domain for nodes your skill emits
  defaultDomain: "general",

  // The actual work. Called with a connected MCP client + emit helpers.
  async run({ mcp, emit, log }) {
    const result = await mcp.callTool({
      name: "some_tool",
      arguments: { query: "something" },
    });

    // MCP results typically come back as content[0].text (JSON-encoded).
    const text = result.content.find((c) => c.type === "text")?.text ?? "[]";
    const items = JSON.parse(text);

    for (const item of items) {
      emit.entity({
        entityType: "token",
        name: item.symbol,
        aliases: [item.name],
        domain: "crypto",
      });

      emit.event({
        title: `${item.name} price snapshot`,
        sourceUrl: item.url,
        sourceName: "Some MCP",
        importance: "low",
        tags: ["market-data"],
        data: { price: item.price },
      });
    }

    log(`emitted ${items.length} items`);
  },
});
```

## Emit helpers

- `emit.event({ title, ... })` — add a node (typed as `event`). You'd
  call this for news items, price snapshots, paper abstracts, issue
  filings — anything that happens at a point in time.
- `emit.entity({ name, entityType, ... })` — add a graph node for a
  person, organization, token, protocol, indicator, policy, location,
  concept, or model. Dedup is automatic via the `{entityType}:name` key.
- `emit.relation({ source, target, type, label, ... })` — connect two
  nodes with a typed edge. `source` / `target` are node ids (e.g.
  `"token:btc"` or `"event:xxxxxxxxxxxx"`).

IDs are derived automatically — you rarely pass `id:` yourself. Every
helper returns the resulting node/edge so you can chain:

```js
const fed = emit.entity({ entityType: "organization", name: "Federal Reserve" });
const event = emit.event({ title: "Fed holds rates steady" });
emit.relation({
  source: fed.id,
  target: event.id,
  type: "involves",
  label: "Fed is the subject of this decision",
});
```

## Tips

- **Keep extraction thin.** Your skill converts MCP results to graph
  shape — it doesn't need to do smart summarization. The agentic
  extractor runs later on other ingest kinds (rss/url/markdown), but
  MCP skills give you structured data already, so wrap it directly.
- **Err on the side of emitting both entity + event.** Entities survive
  re-ingests (deterministic IDs); events accumulate. A daily market
  snapshot is one event per day + one shared entity per token.
- **Use `sourceUrl`** for events so `contextix why` can link back to
  origin.
- **Check env eagerly.** Set `requiredEnv: ["API_KEY"]` so the runner
  fails fast rather than letting the MCP server crash silently.

## Reusing a skill across machines

Skills are just files. Commit them to a repo, share as gists, or publish
as an npm package. Consuming a skill = dropping the file next to your
ingest command. Community skill packs will be announced as they land.
