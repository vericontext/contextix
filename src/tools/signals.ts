import type { GraphStore } from "../graph/store.js";

export const signalsToolDef = {
  name: "contextix_signals",
  description:
    "Get recent cross-domain signals. Returns events and their causal relationships across crypto, macro, AI, and other domains.",
  inputSchema: {
    type: "object" as const,
    properties: {
      timeframe: {
        type: "string",
        enum: ["1h", "6h", "24h", "7d", "30d"],
        default: "24h",
        description: "Time window for signals",
      },
      domains: {
        type: "array",
        items: { type: "string" },
        description: "Filter by domains (e.g. crypto, macro)",
      },
      minConfidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        description: "Minimum confidence threshold",
      },
      limit: {
        type: "number",
        default: 20,
        description: "Maximum number of signals to return",
      },
    },
  },
};

const TIMEFRAME_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export async function handleSignals(
  store: GraphStore,
  args: Record<string, unknown>
) {
  const timeframe = (args.timeframe as string) ?? "24h";
  const domains = args.domains as string[] | undefined;
  const minConfidence = (args.minConfidence as number) ?? 0;
  const limit = (args.limit as number) ?? 20;

  const since = new Date(Date.now() - (TIMEFRAME_MS[timeframe] ?? TIMEFRAME_MS["24h"])).toISOString();

  let events = await store.getAllEvents({ since, limit: limit * 2 });

  if (domains && domains.length > 0) {
    events = events.filter((e) => domains.includes(e.domain));
  }
  if (minConfidence > 0) {
    events = events.filter((e) => e.confidence >= minConfidence);
  }

  events = events.slice(0, limit);

  // Get related edges for each event
  const eventEdges = await Promise.all(
    events.map(async (e) => {
      const from = await store.getEdgesFrom(e.id);
      const to = await store.getEdgesTo(e.id);
      return { event: e, relations: [...from, ...to] };
    })
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            timeframe,
            count: eventEdges.length,
            signals: eventEdges.map(({ event, relations }) => ({
              id: event.id,
              domain: event.domain,
              title: event.title,
              description: event.description,
              importance: event.importance,
              confidence: event.confidence,
              detectedAt: event.detectedAt,
              tags: event.tags,
              relations: relations.map((r) => ({
                type: r.type,
                target: r.target === event.id ? r.source : r.target,
                label: r.label,
                confidence: r.confidence,
              })),
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}
