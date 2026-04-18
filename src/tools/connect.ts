import type { GraphStore } from "../graph/store.js";
import { findConnections } from "../graph/query.js";

export const connectToolDef = {
  name: "contextix_connect",
  description:
    "Find hidden connections between two domains, entities, or topics. Reveals cross-domain causal relationships.",
  inputSchema: {
    type: "object" as const,
    properties: {
      from: {
        type: "string",
        description: "First domain, entity, or topic (e.g. 'Bitcoin', 'Federal Reserve')",
      },
      to: {
        type: "string",
        description: "Second domain, entity, or topic",
      },
      maxHops: {
        type: "number",
        default: 4,
        description: "Maximum number of hops between nodes (1-6)",
      },
    },
    required: ["from", "to"],
  },
};

export async function handleConnect(
  store: GraphStore,
  args: Record<string, unknown>
) {
  const from = args.from as string;
  const to = args.to as string;
  const maxHops = Math.min((args.maxHops as number) ?? 4, 6);

  const result = await findConnections(store, from, to, maxHops);

  if (result.paths.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `No connection found between "${from}" and "${to}" within ${maxHops} hops.`,
        },
      ],
    };
  }

  const formattedPaths = result.paths.map((path) =>
    path.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.type === "event" ? node.title : node.name,
      domain: node.domain,
    }))
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            from,
            to,
            pathsFound: result.paths.length,
            shortestHops: result.shortestHops,
            paths: formattedPaths,
          },
          null,
          2
        ),
      },
    ],
  };
}
