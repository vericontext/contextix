import type { GraphStore } from "../graph/store.js";
import { traceCausalChain } from "../graph/query.js";

export const whyToolDef = {
  name: "contextix_why",
  description:
    "Explain WHY an event happened by tracing causal chains in the signal graph. Returns upstream events and the reasoning chain.",
  inputSchema: {
    type: "object" as const,
    properties: {
      event: {
        type: "string",
        description:
          "Event description or ID to explain (e.g. 'BTC price drop' or 'evt_crypto_...')",
      },
      depth: {
        type: "number",
        default: 3,
        description: "How many hops back in the causal chain (1-5)",
      },
    },
    required: ["event"],
  },
};

export async function handleWhy(
  store: GraphStore,
  args: Record<string, unknown>
) {
  const event = args.event as string;
  const depth = Math.min((args.depth as number) ?? 3, 5);

  const result = await traceCausalChain(store, event, depth);

  if (result.chain.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `No causal chain found for "${event}". The event may not exist in the signal graph, or it has no upstream causes tracked.`,
        },
      ],
    };
  }

  const formatted = result.chain.map((step) => ({
    depth: step.depth,
    event: {
      id: step.event.id,
      title: step.event.title,
      domain: step.event.domain,
      importance: step.event.importance,
      detectedAt: step.event.detectedAt,
    },
    causedBy: step.relation
      ? {
          type: step.relation.type,
          confidence: step.relation.confidence,
          evidence: step.relation.evidence,
        }
      : null,
  }));

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            query: event,
            chainLength: result.chain.length,
            maxDepth: result.depth,
            causalChain: formatted,
          },
          null,
          2
        ),
      },
    ],
  };
}
