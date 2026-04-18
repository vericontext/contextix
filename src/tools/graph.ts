import type { GraphStore } from "../graph/store.js";
import { extractSubgraph } from "../graph/query.js";

export const graphToolDef = {
  name: "contextix_graph",
  description:
    "Get a raw subgraph around a query. Returns nodes and edges for visualization or further analysis.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Center query — entity name, event title, or node ID",
      },
      radius: {
        type: "number",
        default: 2,
        description: "How many hops from center (1-4)",
      },
      maxNodes: {
        type: "number",
        default: 50,
        description: "Maximum nodes to return",
      },
    },
    required: ["query"],
  },
};

export async function handleGraph(
  store: GraphStore,
  args: Record<string, unknown>
) {
  const query = args.query as string;
  const radius = Math.min((args.radius as number) ?? 2, 4);
  const maxNodes = Math.min((args.maxNodes as number) ?? 50, 200);

  const result = await extractSubgraph(store, query, radius, maxNodes);

  if (result.nodes.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `No nodes found matching "${query}" in the signal graph.`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            query,
            radius,
            nodeCount: result.nodes.length,
            edgeCount: result.edges.length,
            nodes: result.nodes.map((n) => ({
              id: n.id,
              type: n.type,
              label: n.type === "event" ? n.title : n.name,
              domain: n.domain,
              ...(n.type === "event"
                ? { importance: n.importance, detectedAt: n.detectedAt }
                : { entityType: n.entityType }),
            })),
            edges: result.edges.map((e) => ({
              source: e.source,
              target: e.target,
              type: e.type,
              label: e.label,
              confidence: e.confidence,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}
