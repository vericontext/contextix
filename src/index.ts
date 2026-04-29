#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "module";
import { startServer } from "./server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("contextix")
  .description("CLI toolkit for agentic AI. Ingest any source into a queryable knowledge graph.")
  .version(version);

program
  .command("serve", { isDefault: true })
  .description("Start the MCP server (stdio)")
  .option("-d, --data-dir <path>", "Data directory", undefined)
  .option("--domains <domains>", "Comma-separated domains", "crypto,macro,ai")
  .option("--hosted", "Use hosted Supabase graph (requires CONTEXTIX_SUPABASE_URL + CONTEXTIX_SUPABASE_KEY)", false)
  .action(async (opts) => {
    const domains = opts.domains.split(",").map((d: string) => d.trim());
    await startServer({ dataDir: opts.dataDir, domains, hosted: opts.hosted });
  });

program
  .command("ingest <kind> <source>")
  .description("Ingest from a source into the graph. kind: mcp | rss | markdown | url | json")
  .option("-o, --out <path>", "Graph file to write (default: ~/.contextix/graph.json)")
  .option("-d, --domain <domain>", "Domain hint for extractor (crypto, macro, ai, ...)")
  .option("-n, --max <n>", "Max items to ingest (connector-specific)", (v) => parseInt(v, 10))
  .option("--importance <level>", "Default importance (low|medium|high|critical)", "medium")
  .option("--extractor <mode>", "Extractor mode: auto|agentic|regex", "auto")
  .option("--skill <path>", "Skill file path (for kind=mcp); overrides <source>")
  .action(async (kind: string, source: string, opts) => {
    const { runIngestCommand } = await import("./ingest/cli.js");
    await runIngestCommand(kind, source, opts);
  });

program
  .command("export")
  .description("Export a subgraph in a given format")
  .option("--format <format>", "Output format: json | mermaid", "json")
  .option("--entity <name>", "Entity name (or event title / id) to center the subgraph on")
  .option("--hops <n>", "Radius in hops from the entity", (v) => parseInt(v, 10), 2)
  .option("--max-nodes <n>", "Maximum nodes to include", (v) => parseInt(v, 10), 200)
  .option("-d, --data-dir <path>", "Data directory override")
  .action(async (opts) => {
    const { loadConfig } = await import("./config.js");
    const { LocalJsonStore } = await import("./graph/store.js");
    const { extractSubgraph } = await import("./graph/query.js");

    if (!opts.entity) {
      console.error("export: --entity <name> is required");
      process.exit(1);
    }

    const config = loadConfig({ dataDir: opts.dataDir });
    const store = new LocalJsonStore(config.graphFile);
    await store.load();

    const sub = await extractSubgraph(store, opts.entity, opts.hops, opts.maxNodes);

    const format = String(opts.format).toLowerCase();
    if (format === "mermaid") {
      const { renderMermaid } = await import("./export/mermaid.js");
      process.stdout.write(renderMermaid(sub));
    } else if (format === "json") {
      process.stdout.write(JSON.stringify(sub, null, 2) + "\n");
    } else {
      console.error(`export: unsupported --format "${opts.format}" (supported: json, mermaid)`);
      process.exit(1);
    }
  });

program
  .command("signals")
  .description("Print recent signals from the local graph")
  .option("-d, --domain <domain>", "Filter by domain (crypto, macro, ai, media)")
  .option("-t, --timeframe <timeframe>", "Time window (1h, 6h, 24h, 7d, 30d)", "24h")
  .option("-n, --limit <n>", "Max results", "20")
  .option("--data-dir <path>", "Data directory override")
  .option("--json", "Output JSON instead of text")
  .action(async (opts) => {
    const { loadConfig } = await import("./config.js");
    const { LocalJsonStore } = await import("./graph/store.js");
    const { handleSignals } = await import("./tools/signals.js");

    const config = loadConfig({ dataDir: opts.dataDir });
    const store = new LocalJsonStore(config.graphFile);
    await store.load();

    const result = await handleSignals(store, {
      timeframe: opts.timeframe,
      domains: opts.domain ? [opts.domain] : undefined,
      minConfidence: 0.5,
      limit: parseInt(opts.limit),
    });

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const text = result.content.find((c: { type: string }) => c.type === "text");
      console.log(text?.text ?? "(no signals found)");
    }
  });

program
  .command("graph-stats")
  .description("Print counts from the local graph")
  .option("--data-dir <path>", "Data directory override")
  .option("--json", "Output JSON instead of text")
  .action(async (opts) => {
    const { loadConfig } = await import("./config.js");
    const { LocalJsonStore } = await import("./graph/store.js");
    const { formatGraphStats, getGraphStats } = await import("./graph/stats.js");

    const config = loadConfig({ dataDir: opts.dataDir });
    const store = new LocalJsonStore(config.graphFile);
    const graph = await store.load();
    const stats = getGraphStats(graph);

    if (opts.json) {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log(formatGraphStats(stats));
    }
  });

program
  .command("parse")
  .description("Parse text from stdin into graph fragment JSON on stdout")
  .action(async () => {
    const { runParse } = await import("./parse/index.js");
    await runParse();
  });

program.parse();
