import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import type {
  Entity,
  EntityType,
  Relation,
  RelationType,
  SignalEvent,
  Source,
} from "../graph/types.js";
import { RegexExtractor } from "./regex.js";
import type { Extractor, ExtractorInput, ExtractorOutput } from "./regex.js";

const DEFAULT_MODEL = "claude-haiku-4-5";
const MAX_RETRIES = 5;
const MAX_TOKENS = 1024;

const ENTITY_TYPES: EntityType[] = [
  "person",
  "organization",
  "token",
  "protocol",
  "indicator",
  "policy",
  "location",
  "concept",
  "model",
];

const RELATION_TYPES: RelationType[] = [
  "causes",
  "caused_by",
  "correlates",
  "involves",
  "influences",
  "related_to",
  "precedes",
  "contradicts",
];

const SYSTEM_PROMPT = `You extract structured knowledge graph nodes and edges from short news / blog / feed text. Your output feeds a causal graph database — quality matters more than quantity.

## Your job

For every input text (usually a news article title + summary), identify:
- The **event** it describes (exactly one per input — an event is a real-world happening at a point in time).
- The **entities** referenced: people, organizations, tokens, protocols, economic indicators, policies, locations.
- The semantic **relations** between those entities (NOT event↔entity "involves" — the ingestion layer generates those for you).

You will record your extraction by calling the \`record_extraction\` tool exactly once. Never respond with plain text.

## Entity rules

**Types** — pick the most specific that fits:
- \`person\` — named individual (Satoshi Nakamoto, Jerome Powell, Sam Altman)
- \`organization\` — company / agency / DAO / foundation (Federal Reserve, OpenAI, Uniswap Labs, SEC)
- \`token\` — cryptocurrency or tokenized asset (BTC, ETH, USDC, SOL)
- \`protocol\` — blockchain / DeFi protocol / network (Ethereum, Solana, Aave, Lido, Uniswap)
- \`indicator\` — economic / market metric (CPI, GDP, unemployment, DXY, TVL)
- \`policy\` — law / regulation / ruling / sanction (MiCA, SEC ruling, 25bp rate hike — when the policy itself is the noun)
- \`location\` — country / region (US, EU, South Korea)
- \`model\` — AI model / weights (Claude Opus 4.7, GPT-4, Llama 3, DeepSeek-V3). Distinct from the organization that made it.
- \`concept\` — abstract topic / idea / project that doesn't fit above (transformer architecture, DeFi, effective altruism). Use sparingly; prefer a specific type when one fits.

**Name** — the canonical form a human would prefer. "Federal Reserve" not "Fed". "Bitcoin" not "BTC" for the protocol, "BTC" for the token. Use the spelling the input text uses if ambiguous.

**Aliases** — other names that refer to the same entity, including abbreviations, tickers, common misspellings. E.g. Bitcoin → ["BTC", "bitcoin"]. Don't pad with unrelated strings.

**Domain** — one of: \`crypto\`, \`macro\`, \`ai\`, \`media\`, \`general\`. Use the most specific applicable domain.

**Do not invent entities.** If a name isn't in the text, don't add it. Extract only what's actually mentioned.

## Relation rules

Only record **semantic** entity↔entity relations — the causal / correlational / contextual edges that make the graph useful. Types:

- \`causes\` / \`caused_by\` — A is a direct cause of B. Use sparingly; require clear evidence in the text.
- \`correlates\` — A and B move together without clear causation.
- \`influences\` — A has non-causal effect on B (e.g. a person's statement shaping market sentiment).
- \`precedes\` — A happened before B; temporal without causal claim.
- \`related_to\` — generic tie; use when nothing more specific fits.
- \`contradicts\` — A's position opposes B's.
- \`involves\` — **DO NOT USE.** The ingestion layer auto-generates event→entity involves edges.

**Confidence** — 0.0–1.0:
- 0.9+ : text explicitly states the relation ("X caused Y")
- 0.7–0.9 : strongly implied
- 0.4–0.7 : reasonable inference
- <0.4 : don't emit

**Evidence** — a short quote or close paraphrase (≤200 chars) from the input text supporting the relation. Required.

Most short news items yield 0–3 entity↔entity relations. Empty array is fine; fabrication is not.

## Importance / tags

- \`importance\` — low / medium / high / critical. Default medium; reserve high+ for clearly market-moving events.
- \`tags\` — 0–6 short lowercase kebab-case phrases describing the event's topics. Examples: "price-action", "monetary-policy", "regulation", "security-incident", "product-launch", "funding-round", "benchmark-release".

## Output schema

Use the tool. Never output plain text.

## Examples

### Example 1

INPUT: "Fed holds rates at 4.25–4.50% despite softening inflation data. Powell signals patience."

record_extraction({
  domain: "macro",
  importance: "high",
  tags: ["monetary-policy", "rate-decision"],
  entities: [
    { name: "Federal Reserve", entityType: "organization", domain: "macro", aliases: ["Fed"] },
    { name: "Jerome Powell", entityType: "person", domain: "macro", aliases: ["Powell"] },
    { name: "interest rate", entityType: "indicator", domain: "macro", aliases: ["rates"] },
    { name: "inflation", entityType: "indicator", domain: "macro", aliases: [] }
  ],
  relations: [
    { fromEntity: "Federal Reserve", toEntity: "interest rate", type: "influences", label: "Fed sets policy rate", confidence: 0.95, evidence: "Fed holds rates at 4.25–4.50%" },
    { fromEntity: "inflation", toEntity: "interest rate", type: "influences", label: "inflation data informs rate decision", confidence: 0.8, evidence: "softening inflation data" }
  ]
})

### Example 2

INPUT: "Binance and Bitget probe RAVE's 4,500% token surge as insider trading claims emerge."

record_extraction({
  domain: "crypto",
  importance: "medium",
  tags: ["price-action", "investigation", "security"],
  entities: [
    { name: "Binance", entityType: "organization", domain: "crypto", aliases: [] },
    { name: "Bitget", entityType: "organization", domain: "crypto", aliases: [] },
    { name: "RAVE", entityType: "token", domain: "crypto", aliases: [] }
  ],
  relations: [
    { fromEntity: "Binance", toEntity: "RAVE", type: "related_to", label: "investigating token surge", confidence: 0.9, evidence: "Binance and Bitget probe RAVE's 4,500% token surge" },
    { fromEntity: "Bitget", toEntity: "RAVE", type: "related_to", label: "investigating token surge", confidence: 0.9, evidence: "Binance and Bitget probe RAVE's 4,500% token surge" }
  ]
})`;

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "record_extraction",
  description:
    "Record the structured knowledge graph extraction from the input text. Must be called exactly once.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      domain: {
        type: "string",
        enum: ["crypto", "macro", "ai", "media", "general"],
        description: "Primary domain of the event.",
      },
      importance: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
        description: "Significance of the event. Default medium.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "0-6 short lowercase kebab-case topic tags.",
      },
      entities: {
        type: "array",
        description: "Entities referenced in the input text.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", description: "Canonical human-readable name." },
            entityType: {
              type: "string",
              enum: ENTITY_TYPES,
            },
            domain: {
              type: "string",
              enum: ["crypto", "macro", "ai", "media", "general"],
            },
            aliases: {
              type: "array",
              items: { type: "string" },
              description: "Other names (abbreviations, tickers, variants).",
            },
          },
          required: ["name", "entityType", "domain", "aliases"],
        },
      },
      relations: {
        type: "array",
        description:
          "Semantic entity↔entity relations. Do NOT emit 'involves' — auto-generated.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            fromEntity: { type: "string", description: "Source entity name (must match an entity above)." },
            toEntity: { type: "string", description: "Target entity name (must match an entity above)." },
            type: {
              type: "string",
              enum: RELATION_TYPES.filter((t) => t !== "involves"),
            },
            label: { type: "string", description: "Short human-readable description." },
            confidence: {
              type: "number",
              description: "0.0–1.0. Only emit if ≥0.4.",
            },
            evidence: {
              type: "string",
              description: "Short quote or paraphrase from input supporting the relation.",
            },
          },
          required: ["fromEntity", "toEntity", "type", "label", "confidence", "evidence"],
        },
      },
    },
    required: ["domain", "importance", "tags", "entities", "relations"],
  },
};

interface RawEntity {
  name: string;
  entityType: EntityType;
  domain: string;
  aliases: string[];
}

interface RawRelation {
  fromEntity: string;
  toEntity: string;
  type: RelationType;
  label: string;
  confidence: number;
  evidence: string;
}

interface RawExtraction {
  domain: string;
  importance: SignalEvent["importance"];
  tags: string[];
  entities: RawEntity[];
  relations: RawRelation[];
}

export interface AgenticExtractorOptions {
  client?: Anthropic;
  model?: string;
  fallback?: Extractor;
}

export interface TokenUsage {
  calls: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export class AgenticExtractor implements Extractor {
  private client: Anthropic;
  private model: string;
  private fallback: Extractor;
  public usage: TokenUsage = {
    calls: 0,
    errors: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  };

  constructor(opts: AgenticExtractorOptions = {}) {
    this.client = opts.client ?? new Anthropic({ maxRetries: MAX_RETRIES });
    this.model = opts.model ?? DEFAULT_MODEL;
    this.fallback = opts.fallback ?? new RegexExtractor();
  }

  async extract(input: ExtractorInput): Promise<ExtractorOutput> {
    const detectedAt = input.detectedAt ?? new Date().toISOString();
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "tool", name: "record_extraction" },
        messages: [
          {
            role: "user",
            content: buildUserMessage(input),
          },
        ],
      });

      this.usage.calls += 1;
      this.usage.inputTokens += response.usage.input_tokens;
      this.usage.outputTokens += response.usage.output_tokens;
      this.usage.cacheCreationTokens += response.usage.cache_creation_input_tokens ?? 0;
      this.usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;

      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      if (!toolUse) throw new Error("Model did not call record_extraction");

      const raw = toolUse.input as RawExtraction;
      return normalize(raw, input, detectedAt);
    } catch (err) {
      this.usage.errors += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[extract agentic] fallback to regex: ${msg}`);
      return this.fallback.extract(input);
    }
  }
}

function buildUserMessage(input: ExtractorInput): string {
  const hint = input.domainHint ? `\nDomain hint: ${input.domainHint}` : "";
  const source = `\nSource: ${input.source.name} — ${input.source.url}`;
  return `Extract from the following:${hint}${source}\n\n---\n${input.text}\n---`;
}

function normalize(
  raw: RawExtraction,
  input: ExtractorInput,
  detectedAt: string
): ExtractorOutput {
  const title = truncate(firstSentence(input.text), 140);
  const eventId = makeEventId(input.source.url, title);

  const event: SignalEvent = {
    id: eventId,
    type: "event",
    domain: input.domainHint ?? raw.domain ?? "general",
    title,
    description: truncate(input.text, 1000),
    detectedAt,
    importance: input.importance ?? raw.importance ?? "medium",
    confidence: input.confidence ?? 0.75,
    sources: [input.source],
    tags: (raw.tags ?? []).slice(0, 6).map((t) => String(t).toLowerCase()),
  };

  const entityByName = new Map<string, Entity>();
  for (const rawEntity of raw.entities ?? []) {
    const canonical = canonicalizeName(rawEntity.name);
    const id = `${rawEntity.entityType}:${canonical}`;
    if (entityByName.has(rawEntity.name)) continue;
    const entity: Entity = {
      id,
      type: "entity",
      entityType: rawEntity.entityType,
      name: canonical,
      aliases: dedupe([rawEntity.name, ...(rawEntity.aliases ?? [])]),
      domain: rawEntity.domain ?? raw.domain ?? "general",
      firstSeen: detectedAt,
      lastSeen: detectedAt,
    };
    entityByName.set(rawEntity.name, entity);
  }

  const entities = [...entityByName.values()];
  const relations: Relation[] = [];

  // event → entity "involves" edges
  for (const entity of entities) {
    relations.push({
      id: makeRelationId(eventId, entity.id, "involves"),
      source: eventId,
      target: entity.id,
      type: "involves",
      label: `${title} involves ${entity.name}`,
      confidence: 0.8,
      evidence: truncate(input.text, 200),
      detectedAt,
    });
  }

  // entity ↔ entity semantic relations from the model
  for (const r of raw.relations ?? []) {
    if (!r || r.confidence < 0.4) continue;
    const from = entityByName.get(r.fromEntity);
    const to = entityByName.get(r.toEntity);
    if (!from || !to) continue;
    relations.push({
      id: makeRelationId(from.id, to.id, r.type),
      source: from.id,
      target: to.id,
      type: r.type,
      label: r.label,
      confidence: clamp(r.confidence, 0, 1),
      evidence: truncate(r.evidence ?? "", 400),
      detectedAt,
    });
  }

  return { events: [event], entities, relations };
}

function canonicalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function firstSentence(text: string): string {
  const stripped = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const match = stripped.match(/^[^.!?\n]+[.!?]?/);
  return (match?.[0] ?? stripped).trim();
}

function makeEventId(sourceUrl: string, title: string): string {
  const h = createHash("sha1").update(`${sourceUrl}::${title}`).digest("hex").slice(0, 12);
  return `event:${h}`;
}

function makeRelationId(source: string, target: string, type: string): string {
  const h = createHash("sha1").update(`${source}->${target}::${type}`).digest("hex").slice(0, 12);
  return `rel:${h}`;
}
