import { readFile, readdir, stat } from "fs/promises";
import { basename, extname, join, relative, resolve } from "path";
import { createHash } from "crypto";
import { RegexExtractor } from "../extract/regex.js";
import type { Extractor } from "../extract/regex.js";
import type { Entity, Relation, SignalEvent, Source } from "../graph/types.js";
import type { GraphFragment } from "./merge.js";

export interface IngestMarkdownOptions {
  domainHint?: string;
  maxFiles?: number;
  importance?: "low" | "medium" | "high" | "critical";
  extractor?: Extractor;
}

const SKIP_DIRS = new Set([".git", "node_modules", ".obsidian", ".trash", "_templates"]);

export async function ingestMarkdown(
  dir: string,
  opts: IngestMarkdownOptions = {}
): Promise<GraphFragment> {
  const rootAbs = resolve(dir);
  const rootStat = await stat(rootAbs);
  if (!rootStat.isDirectory()) {
    throw new Error(`Not a directory: ${rootAbs}`);
  }

  const files = await walkMarkdown(rootAbs);
  const limited = opts.maxFiles ? files.slice(0, opts.maxFiles) : files;
  const extractor = opts.extractor ?? new RegexExtractor();

  const events: SignalEvent[] = [];
  const entityById = new Map<string, Entity>();
  const relations: Relation[] = [];

  for (const filePath of limited) {
    const raw = await readFile(filePath, "utf-8");
    const { frontmatter, body } = splitFrontmatter(raw);
    const wikilinks = extractWikilinks(body);
    const cleanBody = stripMarkdown(body);

    const title = basename(filePath, extname(filePath));
    const relPath = relative(rootAbs, filePath);
    const mtime = (await stat(filePath)).mtime.toISOString();
    const detectedAt = normalizeDate(frontmatter.date) ?? mtime;

    const source: Source = {
      name: `markdown:${title}`,
      url: `file://${filePath}`,
      publishedDate: detectedAt,
      description: `Markdown note at ${relPath}`,
    };

    const domain =
      opts.domainHint ?? frontmatter.domain ?? inferDomain(frontmatter.tags) ?? "general";

    const result = await extractor.extract({
      text: `${title}\n\n${cleanBody}`,
      source,
      detectedAt,
      domainHint: domain,
      importance: opts.importance,
    });

    const event = result.events[0];
    if (!event) continue;

    // override title with filename (extractor truncates from first sentence)
    event.title = title;
    event.domain = domain;
    if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
      event.tags = dedupe([...event.tags, ...frontmatter.tags.map(normalizeTag)]);
    }

    events.push(event);
    for (const e of result.entities) {
      if (!entityById.has(e.id)) entityById.set(e.id, e);
    }
    relations.push(...result.relations);

    // wikilinks → concept entities + related_to edges
    for (const linkName of wikilinks) {
      const canonical = canonicalize(linkName);
      const linkEntityId = `concept:${canonical}`;
      if (!entityById.has(linkEntityId)) {
        entityById.set(linkEntityId, {
          id: linkEntityId,
          type: "entity",
          entityType: "concept",
          name: canonical,
          aliases: [linkName],
          domain,
          firstSeen: detectedAt,
          lastSeen: detectedAt,
        });
      }
      relations.push({
        id: makeRelationId(event.id, linkEntityId, "related_to"),
        source: event.id,
        target: linkEntityId,
        type: "related_to",
        label: `${title} references ${linkName}`,
        confidence: 0.85,
        evidence: `Wikilink [[${linkName}]] in ${relPath}`,
        detectedAt,
      });
    }
  }

  return {
    events,
    entities: [...entityById.values()],
    relations,
    summary: `Ingested ${events.length} markdown files from ${rootAbs}`,
  };
}

// ----- walk -----

async function walkMarkdown(root: string): Promise<string[]> {
  const out: string[] = [];
  async function recur(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await recur(full);
      } else if (entry.isFile() && /\.(md|markdown)$/i.test(entry.name)) {
        out.push(full);
      }
    }
  }
  await recur(root);
  return out.sort();
}

// ----- frontmatter -----

interface Frontmatter {
  date?: string;
  domain?: string;
  tags?: string[];
  [key: string]: unknown;
}

export function splitFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };
  const [, yaml, body] = match;
  return { frontmatter: parseSimpleYaml(yaml), body };
}

function parseSimpleYaml(yaml: string): Frontmatter {
  const out: Frontmatter = {};
  const lines = yaml.split(/\r?\n/);
  let currentListKey: string | null = null;
  const listBuffer: string[] = [];

  const flushList = (): void => {
    if (currentListKey) {
      out[currentListKey] = [...listBuffer];
      listBuffer.length = 0;
      currentListKey = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line || line.startsWith("#")) continue;

    if (currentListKey && /^\s+-\s+/.test(line)) {
      listBuffer.push(stripQuotes(line.replace(/^\s+-\s+/, "").trim()));
      continue;
    }
    flushList();

    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const [, key, valueRaw] = kv;
    const value = valueRaw.trim();

    if (value === "") {
      currentListKey = key;
      continue;
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      out[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean);
      continue;
    }

    out[key] = coerceScalar(stripQuotes(value));
  }
  flushList();

  return out;
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function coerceScalar(s: string): string | number | boolean {
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function normalizeDate(v: unknown): string | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

// ----- wikilinks + markdown strip -----

export function extractWikilinks(body: string): string[] {
  const links = new Set<string>();
  // [[Target]] or [[Target|Alias]]
  for (const m of body.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?(?:#[^\]]+)?\]\]/g)) {
    const name = m[1].trim();
    if (name) links.add(name);
  }
  return [...links];
}

function stripMarkdown(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // markdown links → text
    .replace(/\[\[([^\]|#]+)(?:\|([^\]]+))?(?:#[^\]]+)?\]\]/g, (_m, a, b) => b || a) // wikilinks → text
    .replace(/^#+\s+/gm, "") // header markers
    .replace(/[*_~>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ----- helpers -----

function canonicalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeTag(t: unknown): string {
  return String(t).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function inferDomain(tags: unknown): string | undefined {
  if (!Array.isArray(tags)) return undefined;
  const lowered = tags.map((t) => String(t).toLowerCase());
  if (lowered.some((t) => /crypto|btc|eth|defi/.test(t))) return "crypto";
  if (lowered.some((t) => /\bai\b|ml|llm/.test(t))) return "ai";
  if (lowered.some((t) => /macro|fed|cpi|economy/.test(t))) return "macro";
  return undefined;
}

function makeRelationId(source: string, target: string, type: string): string {
  const h = createHash("sha1").update(`${source}->${target}::${type}`).digest("hex").slice(0, 12);
  return `rel:${h}`;
}
