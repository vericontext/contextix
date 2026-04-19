import { readFileSync, readdirSync, statSync } from "fs";
import { resolve } from "path";
import { loadConfig } from "../config.js";
import { LocalJsonStore } from "../graph/store.js";
import { applyFragment } from "./merge.js";
import { ingestRss } from "./rss.js";
import { ingestMarkdown } from "./markdown.js";
import { ingestUrl } from "./url.js";
import { ingestMcp } from "./mcp.js";
import { getExtractor, AgenticExtractor } from "../extract/index.js";
import type { ExtractorMode } from "../extract/index.js";
import type { GraphFragment } from "./merge.js";

export interface IngestCliOptions {
  out?: string;
  domain?: string;
  max?: number;
  importance?: "low" | "medium" | "high" | "critical";
  extractor?: ExtractorMode;
  skill?: string;
}

export async function runIngestCommand(
  kind: string,
  source: string,
  opts: IngestCliOptions
): Promise<void> {
  const config = loadConfig({ graphFile: opts.out });
  const store = new LocalJsonStore(config.graphFile);
  await store.load();

  const extractor = await getExtractor(opts.extractor ?? "auto");
  const mode =
    extractor instanceof AgenticExtractor ? "agentic" : "regex";
  console.error(`[ingest ${kind}] extractor: ${mode}`);

  let fragments: GraphFragment[] = [];

  switch (kind) {
    case "rss": {
      console.error(`[ingest rss] fetching ${source}`);
      const frag = await ingestRss(source, {
        domainHint: opts.domain,
        maxItems: opts.max,
        importance: opts.importance,
        extractor,
      });
      fragments = [frag];
      break;
    }
    case "markdown": {
      console.error(`[ingest markdown] scanning ${source}`);
      const frag = await ingestMarkdown(source, {
        domainHint: opts.domain,
        maxFiles: opts.max,
        importance: opts.importance,
        extractor,
      });
      fragments = [frag];
      break;
    }
    case "url": {
      console.error(`[ingest url] fetching ${source}`);
      const frag = await ingestUrl(source, {
        domainHint: opts.domain,
        importance: opts.importance,
        extractor,
      });
      fragments = [frag];
      break;
    }
    case "mcp": {
      // `source` is the skill path (explicit --skill flag also accepted)
      const skillPath = opts.skill ?? source;
      console.error(`[ingest mcp] loading skill ${skillPath}`);
      const frag = await ingestMcp({
        skillPath,
        domainHint: opts.domain,
      });
      fragments = [frag];
      break;
    }
    case "json": {
      fragments = loadJsonFragments(source);
      break;
    }
    default:
      throw new Error(
        `Unknown ingest kind: ${kind}. Supported: rss, markdown, url, mcp, json`
      );
  }

  let totalEvents = 0,
    totalEntities = 0,
    totalRelations = 0,
    totalDropped = 0;
  for (const frag of fragments) {
    const res = await applyFragment(frag, store);
    totalEvents += res.eventsAdded;
    totalEntities += res.entitiesAdded;
    totalRelations += res.relationsAdded;
    totalDropped += res.relationsDropped;
  }

  console.error(
    `[ingest ${kind}] done — events:+${totalEvents} entities:+${totalEntities} relations:+${totalRelations}` +
      (totalDropped ? ` dropped:${totalDropped}` : "")
  );
  console.error(`[ingest ${kind}] graph → ${config.graphFile}`);

  if (extractor instanceof AgenticExtractor) {
    const u = extractor.usage;
    const totalInput = u.inputTokens + u.cacheCreationTokens + u.cacheReadTokens;
    const cacheHitPct = totalInput > 0 ? ((u.cacheReadTokens / totalInput) * 100).toFixed(0) : "0";
    console.error(
      `[ingest ${kind}] tokens — calls:${u.calls} errors:${u.errors} ` +
        `input:${u.inputTokens} output:${u.outputTokens} ` +
        `cache(write:${u.cacheCreationTokens} read:${u.cacheReadTokens}, hit:${cacheHitPct}%)`
    );
  }
}

function loadJsonFragments(source: string): GraphFragment[] {
  const resolved = resolve(source);
  const stats = statSync(resolved);
  const files = stats.isDirectory()
    ? readdirSync(resolved)
        .filter((f) => f.endsWith(".json"))
        .map((f) => resolve(resolved, f))
    : [resolved];

  const out: GraphFragment[] = [];
  for (const file of files) {
    try {
      const raw = readFileSync(file, "utf-8");
      out.push(JSON.parse(raw) as GraphFragment);
    } catch (err) {
      console.error(`[ingest json] skipped ${file}: ${(err as Error).message}`);
    }
  }
  return out;
}
