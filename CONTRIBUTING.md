# Contributing to Contextix

Thanks for your interest in contributing. Here's how to get involved.

## Quick start

```bash
git clone https://github.com/vericontext/contextix.git
cd contextix
npm install
npm run build -w packages/mcp
```

Test the MCP server locally:
```bash
node packages/mcp/dist/index.js serve
```

Test the parse CLI:
```bash
echo "Fed holds rates, BTC drops 5%" | node packages/mcp/dist/index.js parse
```

## What we need help with

### Domain schemas

Add new domains by creating YAML schema files that define event types, entity types, and relation patterns for a domain. Examples: AI/ML, energy, geopolitics, climate.

### Source connectors

Write new data source connectors that feed the pipeline. A connector fetches data from an API or website and outputs structured triggers.

### Graph algorithms

Improve causal chain detection, path finding, anomaly detection, or add new query types to the MCP tools.

### Bug reports

Open an issue with:
- What you expected
- What happened
- Steps to reproduce
- Your environment (OS, Node version, AI tool)

## Code style

- TypeScript, strict mode
- ESM modules
- Keep dependencies minimal
- No classes where functions suffice

## Pull requests

1. Fork and create a branch from `main`
2. Make your changes
3. Test locally (MCP server starts, parse CLI works)
4. Open a PR with a clear description of what changed and why

## Project structure

```
packages/mcp/           <- The npm package (contextix)
  src/
    server.ts           <- MCP server + tool registration
    graph/types.ts      <- Core data model
    graph/store.ts      <- Graph storage (local JSON, Supabase)
    graph/query.ts      <- Graph traversal algorithms
    graph/ingest.ts     <- Pipeline output -> graph conversion
    tools/              <- One file per MCP tool
    parse/              <- Text -> graph extraction
  data/
    seed-graph.json     <- Demo data shipped with the package

.claude/agents/         <- Pipeline agent prompts
pipelines/              <- YAML pipeline definitions
scripts/                <- Sync and utility scripts
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
