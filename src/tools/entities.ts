import type { GraphStore } from "../graph/store.js";

export const entitiesToolDef = {
  name: "contextix_entities",
  description:
    "Search for entities (people, organizations, tokens, protocols, indicators) in the signal graph.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Search query (e.g. 'Bitcoin', 'Federal Reserve', 'CPI')",
      },
      type: {
        type: "string",
        enum: ["person", "organization", "token", "protocol", "indicator", "policy", "any"],
        default: "any",
        description: "Filter by entity type",
      },
      limit: {
        type: "number",
        default: 10,
        description: "Maximum results",
      },
    },
    required: ["query"],
  },
};

export async function handleEntities(
  store: GraphStore,
  args: Record<string, unknown>
) {
  const query = args.query as string;
  const type = (args.type as string) ?? "any";
  const limit = (args.limit as number) ?? 10;

  const entities = await store.getAllEntities({ query, type, limit });

  // Get connected events for each entity
  const results = await Promise.all(
    entities.map(async (entity) => {
      const edgesFrom = await store.getEdgesFrom(entity.id);
      const edgesTo = await store.getEdgesTo(entity.id);
      const allEdges = [...edgesFrom, ...edgesTo];

      // Resolve connected event titles
      const connections = await Promise.all(
        allEdges.slice(0, 5).map(async (edge) => {
          const otherId = edge.source === entity.id ? edge.target : edge.source;
          const otherNode = await store.getNode(otherId);
          return {
            relation: edge.type,
            label: edge.label,
            node: otherNode
              ? {
                  id: otherNode.id,
                  type: otherNode.type,
                  label:
                    otherNode.type === "event"
                      ? otherNode.title
                      : otherNode.name,
                }
              : { id: otherId, type: "unknown", label: otherId },
          };
        })
      );

      return {
        id: entity.id,
        name: entity.name,
        entityType: entity.entityType,
        domain: entity.domain,
        aliases: entity.aliases,
        totalConnections: allEdges.length,
        recentConnections: connections,
      };
    })
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          { query, count: results.length, entities: results },
          null,
          2
        ),
      },
    ],
  };
}
