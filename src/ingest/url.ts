import { RegexExtractor } from "../extract/regex.js";
import type { Extractor } from "../extract/regex.js";
import type { Source } from "../graph/types.js";
import type { GraphFragment } from "./merge.js";

export interface IngestUrlOptions {
  domainHint?: string;
  importance?: "low" | "medium" | "high" | "critical";
  extractor?: Extractor;
}

export async function ingestUrl(url: string, opts: IngestUrlOptions = {}): Promise<GraphFragment> {
  const html = await fetchHtml(url);
  const parsed = parseHtml(html);
  const text = [parsed.title, parsed.description, parsed.body].filter(Boolean).join("\n\n");

  const extractor = opts.extractor ?? new RegexExtractor();
  const source: Source = {
    name: parsed.siteName ?? safeHostname(url),
    url,
    publishedDate: parsed.pubDate,
    description: parsed.description ? truncate(parsed.description, 200) : undefined,
  };

  const result = await extractor.extract({
    text,
    source,
    detectedAt: parsed.pubDate ?? new Date().toISOString(),
    domainHint: opts.domainHint,
    importance: opts.importance,
  });

  // override title with page title (extractor truncates from first sentence)
  if (result.events[0] && parsed.title) {
    result.events[0].title = truncate(parsed.title, 140);
  }

  return {
    events: result.events,
    entities: result.entities,
    relations: result.relations,
    summary: `Ingested ${url}`,
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "contextix/0.3 (+https://github.com/vericontext/contextix)",
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText} (${url})`);
  const contentType = res.headers.get("content-type") ?? "";
  if (!/text\/html|xml/i.test(contentType) && !/xhtml/i.test(contentType)) {
    console.error(`[ingest url] warning: unexpected content-type: ${contentType}`);
  }
  return res.text();
}

interface ParsedHtml {
  title: string;
  description: string;
  pubDate?: string;
  body: string;
  siteName?: string;
}

export function parseHtml(html: string): ParsedHtml {
  const noScript = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const title =
    decode(extractMetaProperty(noScript, "og:title")) ||
    decode(extractMetaProperty(noScript, "twitter:title")) ||
    decode(noScript.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "");

  const description =
    decode(extractMetaProperty(noScript, "og:description")) ||
    decode(extractMetaName(noScript, "description")) ||
    decode(extractMetaProperty(noScript, "twitter:description"));

  const pubDateRaw =
    extractMetaProperty(noScript, "article:published_time") ||
    extractMetaProperty(noScript, "og:published_time") ||
    extractMetaName(noScript, "pubdate");
  const pubDate = pubDateRaw ? normalizeDate(pubDateRaw) : undefined;

  const siteName = decode(extractMetaProperty(noScript, "og:site_name"));

  const containerHtml =
    firstMatch(noScript, /<article\b[^>]*>([\s\S]*?)<\/article>/i) ??
    firstMatch(noScript, /<main\b[^>]*>([\s\S]*?)<\/main>/i) ??
    firstMatch(noScript, /<body\b[^>]*>([\s\S]*?)<\/body>/i) ??
    noScript;

  const stripped = containerHtml
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, " ")
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, " ");

  const body = decode(stripped.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

  return { title, description, pubDate, body, siteName: siteName || undefined };
}

function extractMetaProperty(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = html.match(
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i")
  );
  if (a?.[1]) return a[1];
  const b = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*property=["']${escaped}["']`, "i")
  );
  return b?.[1] ?? "";
}

function extractMetaName(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = html.match(
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i")
  );
  if (a?.[1]) return a[1];
  const b = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*name=["']${escaped}["']`, "i")
  );
  return b?.[1] ?? "";
}

function firstMatch(text: string, re: RegExp): string | undefined {
  return text.match(re)?.[1];
}

function decode(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCharCode(parseInt(n, 16)));
}

function normalizeDate(s: string): string | undefined {
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function safeHostname(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
