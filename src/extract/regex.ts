import { createHash } from "crypto";
import type {
  Entity,
  EntityType,
  Relation,
  RelationType,
  SignalEvent,
  Source,
} from "../graph/types.js";

export interface ExtractorInput {
  text: string;
  source: Source;
  detectedAt?: string;
  domainHint?: string;
  importance?: SignalEvent["importance"];
  confidence?: number;
}

export interface ExtractorOutput {
  events: SignalEvent[];
  entities: Entity[];
  relations: Relation[];
}

export interface Extractor {
  extract(input: ExtractorInput): Promise<ExtractorOutput>;
}

const CRYPTO_TOKENS = /\b(BTC|ETH|SOL|XRP|DOGE|ADA|AVAX|DOT|Bitcoin|Ethereum|Solana)\b/gi;
const ORGANIZATIONS =
  /\b(Fed|Federal Reserve|SEC|ECB|BOJ|Binance|Coinbase|Kraken|BlackRock|NVIDIA|OpenAI|Anthropic|Google|Microsoft|Tesla|Meta|Apple)\b/gi;
const INDICATORS = /\b(CPI|GDP|PPI|NFP|unemployment|inflation|interest rate|yield)\b/gi;
const CAUSAL_PATTERNS: Array<{ regex: RegExp; type: RelationType; label: string }> = [
  { regex: /(.+?)\s+(?:causes?|caused|led to|resulted in|triggered)\s+(.+)/i, type: "causes", label: "causal relationship" },
  { regex: /(.+?)\s+(?:after|following|due to|because of)\s+(.+)/i, type: "caused_by", label: "consequential relationship" },
];

export class RegexExtractor implements Extractor {
  async extract(input: ExtractorInput): Promise<ExtractorOutput> {
    const detectedAt = input.detectedAt ?? new Date().toISOString();
    const domain = input.domainHint ?? guessDomain(input.text);
    const importance = input.importance ?? "medium";
    const confidence = input.confidence ?? 0.6;

    const entities = extractEntities(input.text, detectedAt);

    const title = truncate(stripHtml(input.text).split(/[.!?\n]/)[0] ?? input.text, 140);
    const eventId = makeEventId(input.source.url, title);

    const event: SignalEvent = {
      id: eventId,
      type: "event",
      domain,
      title,
      description: truncate(stripHtml(input.text), 1000),
      detectedAt,
      importance,
      confidence,
      sources: [input.source],
      tags: extractTags(input.text),
    };

    const relations: Relation[] = [];

    // event -> entity (involves)
    for (const entity of entities) {
      relations.push({
        id: makeRelationId(eventId, entity.id, "involves"),
        source: eventId,
        target: entity.id,
        type: "involves",
        label: `${title} involves ${entity.name}`,
        confidence: 0.7,
        evidence: truncate(input.text, 200),
        detectedAt,
      });
    }

    // causal text patterns
    for (const { regex, type, label } of CAUSAL_PATTERNS) {
      const match = input.text.match(regex);
      if (match) {
        const fromText = truncate(match[1].trim(), 80);
        const toText = truncate(match[2].trim(), 80);
        relations.push({
          id: makeRelationId(fromText, toText, type),
          source: eventId,
          target: eventId,
          type,
          label: `${label}: ${fromText} → ${toText}`,
          confidence: 0.4,
          evidence: truncate(input.text, 200),
          detectedAt,
          metadata: { fromText, toText },
        });
      }
    }

    return {
      events: [event],
      entities,
      relations,
    };
  }
}

function extractEntities(text: string, now: string): Entity[] {
  const seen = new Set<string>();
  const out: Entity[] = [];

  const pushEntity = (
    name: string,
    entityType: EntityType,
    domain: string,
    aliases: string[] = []
  ): void => {
    const canonical = canonicalizeName(name);
    const id = `${entityType}:${canonical}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      type: "entity",
      entityType,
      name: canonical,
      aliases: [name, ...aliases].filter((a, i, arr) => arr.indexOf(a) === i),
      domain,
      firstSeen: now,
      lastSeen: now,
    });
  };

  for (const m of text.matchAll(CRYPTO_TOKENS)) pushEntity(m[0], "token", "crypto");
  for (const m of text.matchAll(ORGANIZATIONS))
    pushEntity(m[0], "organization", guessOrgDomain(m[0]));
  for (const m of text.matchAll(INDICATORS)) pushEntity(m[0], "indicator", "macro");

  return out;
}

function canonicalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

function guessDomain(text: string): string {
  const lower = text.toLowerCase();
  if (/btc|eth|crypto|defi|token|blockchain|nft|exchange|bitcoin|ethereum/.test(lower))
    return "crypto";
  if (/fed|cpi|gdp|rate|inflation|employment|treasury|yield/.test(lower)) return "macro";
  if (/\bai\b|\bllm\b|model|gpu|training|inference|openai|anthropic|transformer/.test(lower))
    return "ai";
  return "general";
}

function guessOrgDomain(name: string): string {
  if (/Binance|Coinbase|Kraken/i.test(name)) return "crypto";
  if (/Fed|SEC|ECB|BOJ/i.test(name)) return "macro";
  if (/OpenAI|Anthropic|NVIDIA|Google|Microsoft|Meta|Apple/i.test(name)) return "ai";
  return "general";
}

function extractTags(text: string): string[] {
  const tags = new Set<string>();
  const lower = text.toLowerCase();
  if (/price|drop|surge|rally|crash|pump|dump/.test(lower)) tags.add("price-action");
  if (/rate|cpi|inflation|hawkish|dovish/.test(lower)) tags.add("monetary-policy");
  if (/etf|fund|institutional|whale/.test(lower)) tags.add("institutional");
  if (/hack|exploit|vulnerability|breach/.test(lower)) tags.add("security");
  if (/regulation|sec|law|ban|lawsuit/.test(lower)) tags.add("regulation");
  if (/\bai\b|\bllm\b|benchmark|gpu/.test(lower)) tags.add("ai");
  return [...tags];
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function makeEventId(sourceUrl: string, title: string): string {
  const h = createHash("sha1").update(`${sourceUrl}::${title}`).digest("hex").slice(0, 12);
  return `event:${h}`;
}

function makeRelationId(source: string, target: string, type: string): string {
  const h = createHash("sha1").update(`${source}->${target}::${type}`).digest("hex").slice(0, 12);
  return `rel:${h}`;
}
