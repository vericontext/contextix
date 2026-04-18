#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "module";
import { startServer } from "./server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("contextix")
  .description(
    "Open-source cross-domain signal graph for AI agents. Give your agent world context."
  )
  .version(version);

program
  .command("serve", { isDefault: true })
  .description("Start the MCP server (default)")
  .option("-d, --data-dir <path>", "Data directory", undefined)
  .option("--domains <domains>", "Comma-separated domains", "crypto,macro")
  .option("--hosted", "Use hosted Supabase graph (requires CONTEXTIX_SUPABASE_URL + CONTEXTIX_SUPABASE_KEY)", false)
  .action(async (opts) => {
    const domains = opts.domains.split(",").map((d: string) => d.trim());
    await startServer({ dataDir: opts.dataDir, domains, hosted: opts.hosted });
  });

program
  .command("parse")
  .description("Parse text into signal graph nodes (stdin → stdout)")
  .action(async () => {
    const { runParse } = await import("./parse/index.js");
    await runParse();
  });

program
  .command("signals")
  .description("Print recent signals from the local graph")
  .option("-d, --domain <domain>", "Filter by domain (crypto, macro, ai, media)")
  .option("-t, --timeframe <timeframe>", "Time window (1h, 6h, 24h, 7d, 30d)", "24h")
  .option("-n, --limit <n>", "Max results", "20")
  .option("--data-dir <path>", "Data directory override")
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

    const text = result.content.find((c: { type: string }) => c.type === "text");
    console.log(text?.text ?? "(no signals found)");
  });

program
  .command("ingest <insights-dir> <output-path>")
  .description("Ingest graph fragments from pipeline into unified signal graph")
  .action(async (insightsDir: string, outputPath: string) => {
    const { runIngest } = await import("./graph/ingest.js");
    await runIngest(insightsDir, outputPath);
  });

program.parse();
