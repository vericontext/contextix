# Contributing to Contextix

Thanks for the interest. Contextix is a small TypeScript project — the code is approachable and high-leverage contributions are easy to make.

## Quick start

```bash
git clone https://github.com/vericontext/contextix.git
cd contextix
npm install
npm run build
node dist/index.js --help
```

Test the MCP server locally:
```bash
node dist/index.js serve
# (pipe JSON-RPC over stdin, or wire into Claude Desktop .mcp.json)
```

Test an ingest + query loop:
```bash
node dist/index.js ingest markdown ~/notes
node dist/index.js signals -t 7d
node dist/index.js why "<some event title from the output>"
```

## Where contributions help most

### New source connectors (highest impact)

Each connector is one file in `src/ingest/` and a CLI command in `src/index.ts`. Pattern:

```typescript
export async function ingestFrom<Source>(input: string, opts: IngestOpts): Promise<GraphFragment> {
  // 1. fetch or read source
  // 2. call extract (agentic or regex based on env)
  // 3. return { events, entities, relations }
}
```

Wanted: Notion, Linear, GitHub issues, Slack archives, Gmail, Readwise, Pocket, arXiv, Hacker News.

### Extraction prompts

`src/extract/agentic.ts` — Haiku prompt that turns raw text into structured `{ events, entities, relations }`. Improvements to precision/recall directly show up in graph quality.

### Graph algorithms

`src/graph/query.ts` — BFS exists but there's room for PageRank entity importance, temporal decay, confidence propagation, contradiction surfacing. All pure functions over `SignalGraph`.

### Seed data

`data/seed-graph.json` ships with the package so offline use works. Verified events + sourced edges raise the floor for new users.

### Bug reports

Open an issue with: expected behavior, actual behavior, repro steps, `node --version`, OS. A failing `contextix signals --json > out.json` paste is gold.

## Code style

- TypeScript strict mode, ESM modules
- Keep dependencies minimal — every new dep is a review question
- Functions over classes
- No runtime frameworks (no Next.js, no NestJS, no Express — this is a CLI)
- No comments unless the *why* is non-obvious

## Pull requests

1. Fork, branch from `main`
2. Make changes + add a minimal test / smoke script
3. `npm run typecheck && npm run build`
4. PR with a short description — what changed, why, any tradeoffs

Small focused PRs merge fast. If in doubt, open an issue first to align on direction.

## Project structure

```
src/
  index.ts          ← CLI entry (commander)
  server.ts         ← MCP stdio server
  config.ts         ← ~/.contextix + env
  graph/
    types.ts        ← data model
    store.ts        ← LocalJsonStore
    supabase-store.ts ← hosted mode
    query.ts        ← BFS, paths, subgraphs
    ingest.ts       ← fragment merge
  ingest/           ← source connectors (this is where most PRs land)
  extract/          ← agentic + regex extractors
  tools/            ← MCP tool handlers (also used by CLI)
data/
  seed-graph.json   ← ships with package
```

## What this repo is not for

Contextix OSS is the engine. The hosted contextix.io pipeline (curated crypto/AI sources, Supabase, Next.js frontend, scheduled batch) lives in a separate private repo and is not accepted here. If you want to propose a new domain-specific curated graph, please open an issue instead of a PR — we'll discuss whether it belongs in OSS seed data, a separate connector package, or the hosted side.

## License

By contributing you agree your contributions are MIT-licensed.
