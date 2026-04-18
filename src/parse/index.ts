/**
 * Parse text from stdin into signal graph nodes.
 * Outputs JSON to stdout.
 */
export async function runParse(): Promise<void> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }

  const text = Buffer.concat(chunks).toString("utf-8").trim();

  if (!text) {
    console.error("No input received. Pipe text to stdin:");
    console.error('  echo "Fed holds rates, BTC drops 5%" | npx contextix parse');
    process.exit(1);
  }

  // Basic extraction (will be enhanced in Phase 2)
  const result = extractFromText(text);
  console.log(JSON.stringify(result, null, 2));
}

interface ParseResult {
  events: Array<{
    title: string;
    domain: string;
    tags: string[];
  }>;
  entities: Array<{
    name: string;
    entityType: string;
    domain: string;
  }>;
  relations: Array<{
    from: string;
    to: string;
    type: string;
    label: string;
  }>;
}

function extractFromText(text: string): ParseResult {
  const events: ParseResult["events"] = [];
  const entities: ParseResult["entities"] = [];
  const relations: ParseResult["relations"] = [];

  // Split on sentence boundaries
  const sentences = text.split(/[.!?\n]+/).filter((s) => s.trim().length > 5);

  // Known entity patterns
  const cryptoTokens = /\b(BTC|ETH|SOL|XRP|Bitcoin|Ethereum|Solana|DOGE|ADA|AVAX|DOT)\b/gi;
  const organizations = /\b(Fed|Federal Reserve|SEC|ECB|BOJ|Binance|Coinbase|BlackRock|NVIDIA|OpenAI|Anthropic|Google|Microsoft|Tesla)\b/gi;
  const indicators = /\b(CPI|GDP|PPI|NFP|unemployment|inflation|interest rate|yield)\b/gi;

  const seenEntities = new Set<string>();

  for (const sentence of sentences) {
    const trimmed = sentence.trim();

    // Extract entities
    const tokenMatches = trimmed.matchAll(cryptoTokens);
    for (const match of tokenMatches) {
      const name = match[0];
      if (!seenEntities.has(name.toUpperCase())) {
        seenEntities.add(name.toUpperCase());
        entities.push({ name, entityType: "token", domain: "crypto" });
      }
    }

    const orgMatches = trimmed.matchAll(organizations);
    for (const match of orgMatches) {
      const name = match[0];
      if (!seenEntities.has(name.toUpperCase())) {
        seenEntities.add(name.toUpperCase());
        entities.push({ name, entityType: "organization", domain: guessOrgDomain(name) });
      }
    }

    const indMatches = trimmed.matchAll(indicators);
    for (const match of indMatches) {
      const name = match[0];
      if (!seenEntities.has(name.toUpperCase())) {
        seenEntities.add(name.toUpperCase());
        entities.push({ name, entityType: "indicator", domain: "macro" });
      }
    }

    // Detect events from sentences
    if (trimmed.length > 10) {
      const domain = guessDomain(trimmed);
      events.push({
        title: trimmed.slice(0, 120),
        domain,
        tags: extractTags(trimmed),
      });
    }
  }

  // Simple causal relation detection
  const causalPatterns = [
    /(.+?)\s+(?:causes?|caused|led to|resulted in|triggered)\s+(.+)/i,
    /(.+?)\s+(?:after|following|due to|because of)\s+(.+)/i,
  ];

  for (const pattern of causalPatterns) {
    const match = text.match(pattern);
    if (match) {
      relations.push({
        from: match[1].trim().slice(0, 80),
        to: match[2].trim().slice(0, 80),
        type: "causes",
        label: "causal relationship detected",
      });
    }
  }

  return { events, entities, relations };
}

function guessDomain(text: string): string {
  const lower = text.toLowerCase();
  if (/btc|eth|crypto|defi|token|blockchain|nft|exchange/i.test(lower)) return "crypto";
  if (/fed|cpi|gdp|rate|inflation|employment|treasury|yield/i.test(lower)) return "macro";
  if (/ai|model|llm|gpu|training|inference|openai|anthropic/i.test(lower)) return "ai";
  return "general";
}

function guessOrgDomain(name: string): string {
  if (/Binance|Coinbase/i.test(name)) return "crypto";
  if (/Fed|SEC|ECB|BOJ/i.test(name)) return "macro";
  if (/OpenAI|Anthropic|NVIDIA|Google|Microsoft/i.test(name)) return "ai";
  return "cross";
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();
  if (/price|drop|surge|rally|crash/i.test(lower)) tags.push("price-action");
  if (/rate|cpi|inflation/i.test(lower)) tags.push("monetary-policy");
  if (/etf|fund|institutional/i.test(lower)) tags.push("institutional");
  if (/hack|exploit|vulnerability/i.test(lower)) tags.push("security");
  if (/regulation|sec|law|ban/i.test(lower)) tags.push("regulation");
  return tags;
}
