#!/usr/bin/env node

import { Command } from "commander";
import { startServer } from "./server.js";

const program = new Command();

program
  .name("contextix")
  .description(
    "Open-source cross-domain signal graph for AI agents. Give your agent world context."
  )
  .version("0.1.0");

program
  .command("serve", { isDefault: true })
  .description("Start the MCP server (default)")
  .option("-d, --data-dir <path>", "Data directory", undefined)
  .option("--domains <domains>", "Comma-separated domains", "crypto,macro")
  .action(async (opts) => {
    const domains = opts.domains.split(",").map((d: string) => d.trim());
    await startServer({ dataDir: opts.dataDir, domains });
  });

program
  .command("parse")
  .description("Parse text into signal graph nodes (stdin → stdout)")
  .action(async () => {
    const { runParse } = await import("./parse/index.js");
    await runParse();
  });

program
  .command("ingest <insights-dir> <output-path>")
  .description("Ingest graph fragments from pipeline into unified signal graph")
  .action(async (insightsDir: string, outputPath: string) => {
    const { runIngest } = await import("./graph/ingest.js");
    await runIngest(insightsDir, outputPath);
  });

program.parse();
