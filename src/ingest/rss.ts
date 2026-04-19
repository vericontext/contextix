import { XMLParser } from "fast-xml-parser";
import { RegexExtractor } from "../extract/regex.js";
import type { Extractor } from "../extract/regex.js";
import type { GraphFragment } from "./merge.js";
import type { Source } from "../graph/types.js";

export interface IngestRssOptions {
  domainHint?: string;
  maxItems?: number;
  importance?: "low" | "medium" | "high" | "critical";
  extractor?: Extractor;
}

export interface FeedItem {
  title: string;
  description: string;
  link: string;
  pubDate?: string;
  guid?: string;
  sourceName: string;
}

export async function ingestRss(url: string, opts: IngestRssOptions = {}): Promise<GraphFragment> {
  const xml = await fetchFeed(url);
  const items = parseFeed(xml);

  const limited = opts.maxItems ? items.slice(0, opts.maxItems) : items;
  const extractor = opts.extractor ?? new RegexExtractor();

  const events: GraphFragment["events"] = [];
  const entities: GraphFragment["entities"] = [];
  const relations: GraphFragment["relations"] = [];
  const seenEntityIds = new Set<string>();

  for (const item of limited) {
    const source: Source = {
      name: item.sourceName || new URL(url).hostname,
      url: item.link || url,
      publishedDate: item.pubDate,
    };
    const text = `${item.title}\n\n${stripHtml(item.description)}`;
    const result = await extractor.extract({
      text,
      source,
      detectedAt: item.pubDate ?? new Date().toISOString(),
      domainHint: opts.domainHint,
      importance: opts.importance,
    });

    // override event title with original feed title (extractor truncates from first sentence)
    if (result.events[0]) {
      result.events[0].title = truncate(item.title, 140);
    }

    events.push(...result.events);
    for (const e of result.entities) {
      if (!seenEntityIds.has(e.id)) {
        seenEntityIds.add(e.id);
        entities.push(e);
      }
    }
    relations.push(...result.relations);
  }

  return {
    events,
    entities,
    relations,
    summary: `Ingested ${events.length} events from ${url}`,
  };
}

async function fetchFeed(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": "contextix/0.3 (+https://github.com/vericontext/contextix)",
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
  });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status} ${res.statusText} (${url})`);
  return res.text();
}

function parseFeed(xml: string): FeedItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });
  const obj = parser.parse(xml);

  // RSS 2.0
  if (obj?.rss?.channel) {
    const channel = obj.rss.channel;
    const sourceName = firstString(channel.title) ?? "";
    const rawItems = toArray(channel.item);
    return rawItems.map((it: Record<string, unknown>) => ({
      title: firstString(it.title) ?? "",
      description:
        firstString(it.description) ?? firstString(it["content:encoded"]) ?? "",
      link: firstString(it.link) ?? "",
      pubDate: normalizeDate(firstString(it.pubDate) ?? firstString(it["dc:date"])),
      guid: firstString(it.guid) ?? firstString(it.link),
      sourceName,
    }));
  }

  // Atom
  if (obj?.feed?.entry || obj?.feed?.title) {
    const feed = obj.feed;
    const sourceName = firstString(feed.title) ?? "";
    const rawEntries = toArray(feed.entry);
    return rawEntries.map((e: Record<string, unknown>) => ({
      title: firstString(e.title) ?? "",
      description: firstString(e.summary) ?? firstString(e.content) ?? "",
      link: extractAtomLink(e.link) ?? "",
      pubDate: normalizeDate(firstString(e.published) ?? firstString(e.updated)),
      guid: firstString(e.id),
      sourceName,
    }));
  }

  // RDF / RSS 1.0
  const rdf = obj?.["rdf:RDF"] ?? obj?.RDF;
  if (rdf) {
    const sourceName = firstString(rdf.channel?.title) ?? "";
    const rawItems = toArray(rdf.item);
    return rawItems.map((it: Record<string, unknown>) => ({
      title: firstString(it.title) ?? "",
      description: firstString(it.description) ?? "",
      link: firstString(it.link) ?? "",
      pubDate: normalizeDate(firstString(it["dc:date"])),
      guid: firstString(it["@_rdf:about"]) ?? firstString(it.link),
      sourceName,
    }));
  }

  throw new Error("Unrecognized feed format (expected RSS 2.0, Atom, or RSS 1.0/RDF)");
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function firstString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object" && v !== null) {
    const rec = v as Record<string, unknown>;
    if (typeof rec["#text"] === "string") return rec["#text"];
    // guid, link often have attribute form; fall through
  }
  return undefined;
}

function extractAtomLink(link: unknown): string | undefined {
  if (!link) return undefined;
  if (typeof link === "string") return link;
  if (Array.isArray(link)) {
    const alt = link.find(
      (l) => typeof l === "object" && l !== null && (l as Record<string, unknown>)["@_rel"] === "alternate"
    );
    const target = alt ?? link[0];
    return typeof target === "object" && target !== null
      ? ((target as Record<string, unknown>)["@_href"] as string | undefined)
      : typeof target === "string"
        ? target
        : undefined;
  }
  if (typeof link === "object" && link !== null) {
    return (link as Record<string, unknown>)["@_href"] as string | undefined;
  }
  return undefined;
}

function normalizeDate(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
