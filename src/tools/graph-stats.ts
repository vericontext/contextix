import type { GraphStore } from "../graph/store.js";

export interface GraphStats {
  events: number;
  entities: number;
  activeRelations: number;
  domains: string[];
  orphanNodes: number;
}

/**
 * Compute summary counts from the local graph.
 *
 * Orphan detection: a node is "orphan" if no relation references it as
 * either `source` or `target` (no incoming or outgoing edges).
 */
export async function computeGraphStats(store: GraphStore): Promise<GraphStats> {
  const graph = await store.load();

  let events = 0;
  let entities = 0;
  const domains = new Set<string>();
  for (const node of graph.nodes) {
    if (node.type === "event") events++;
    else if (node.type === "entity") entities++;
    // Derive domains from nodes directly so stats reflect the current
    // graph. `graph.meta.domains` is not refreshed by `addNodes`, so it
    // can go stale on graphs built via the normal ingest path.
    if (node.domain) domains.add(node.domain);
  }

  const connected = new Set<string>();
  for (const edge of graph.edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }
  const orphanNodes = graph.nodes.filter((n) => !connected.has(n.id)).length;

  return {
    events,
    entities,
    activeRelations: graph.edges.length,
    domains: [...domains].sort(),
    orphanNodes,
  };
}
