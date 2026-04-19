// contextix skill: CoinGecko top coins + global market snapshot.
// Requires COINGECKO_DEMO_API_KEY (Demo tier = free after signup at coingecko.com).
//
//   COINGECKO_DEMO_API_KEY=CG-xxx \
//     contextix ingest mcp ./coingecko-markets.mjs

import { defineSkill } from "contextix/skill";

export default defineSkill({
  name: "coingecko-markets",
  description: "Top 20 coins by market cap + global market stats.",
  version: "0.1.0",

  mcpServer: {
    command: "npx",
    args: ["-y", "@coingecko/coingecko-mcp"],
    env: { COINGECKO_DEMO_API_KEY: "${COINGECKO_DEMO_API_KEY}" },
  },
  requiredEnv: ["COINGECKO_DEMO_API_KEY"],
  defaultDomain: "crypto",

  async run({ mcp, emit, log }) {
    // 1. Global market snapshot as one event
    const global = await callJson(mcp, "get_global", {});
    if (global?.data) {
      const { total_market_cap, total_volume, market_cap_percentage } = global.data;
      emit.event({
        title: "Global crypto market snapshot",
        description: `Total market cap $${fmtBig(total_market_cap?.usd)}, BTC dominance ${market_cap_percentage?.btc?.toFixed(1)}%`,
        sourceName: "CoinGecko",
        sourceUrl: "https://www.coingecko.com/en/global-charts",
        importance: "low",
        tags: ["market-data", "global"],
        domain: "crypto",
        data: {
          totalMarketCapUSD: total_market_cap?.usd,
          totalVolumeUSD: total_volume?.usd,
          btcDominance: market_cap_percentage?.btc,
        },
      });
    }

    // 2. Top 20 coins: one entity per token + one event per coin
    const coins = await callJson(mcp, "get_coins_markets", {
      vs_currency: "usd",
      per_page: 20,
      order: "market_cap_desc",
      page: 1,
    });
    if (!Array.isArray(coins)) {
      log(`unexpected coins response: ${JSON.stringify(coins).slice(0, 120)}...`);
      return;
    }

    for (const coin of coins) {
      const symbol = String(coin.symbol ?? "").toUpperCase();
      if (!symbol) continue;

      const token = emit.entity({
        entityType: "token",
        name: symbol,
        aliases: [coin.name].filter(Boolean),
        domain: "crypto",
        metadata: {
          coingeckoId: coin.id,
          marketCapRank: coin.market_cap_rank,
        },
      });

      const change = coin.price_change_percentage_24h;
      const direction = change >= 0 ? "up" : "down";
      const magnitude = Math.abs(change ?? 0);
      const importance = magnitude >= 10 ? "high" : magnitude >= 5 ? "medium" : "low";

      const event = emit.event({
        title: `${coin.name} 24h: ${fmtPct(change)} at $${fmtPrice(coin.current_price)}`,
        description: `${coin.name} (${symbol}) ${direction} ${magnitude.toFixed(2)}% in the last 24h. Market cap rank #${coin.market_cap_rank}.`,
        sourceName: "CoinGecko",
        sourceUrl: `https://www.coingecko.com/en/coins/${coin.id}`,
        importance,
        tags: ["price-action", direction === "up" ? "gainer" : "decliner"],
        domain: "crypto",
        data: {
          price: coin.current_price,
          marketCap: coin.market_cap,
          volume24h: coin.total_volume,
          change24h: change,
        },
      });

      emit.relation({
        source: event.id,
        target: token.id,
        type: "involves",
        label: `${coin.name} price movement`,
        confidence: 1,
        evidence: `CoinGecko 24h data for ${symbol}`,
      });
    }

    log(`emitted ${coins.length} coin snapshots + 1 global event`);
  },
});

async function callJson(mcp, toolName, args) {
  const result = await mcp.callTool({ name: toolName, arguments: args });
  const text = result.content?.find((c) => c.type === "text")?.text ?? "null";
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function fmtPct(v) {
  if (v == null) return "n/a";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function fmtPrice(v) {
  if (v == null) return "?";
  if (v >= 100) return v.toFixed(0);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

function fmtBig(v) {
  if (v == null) return "?";
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  return String(v);
}
