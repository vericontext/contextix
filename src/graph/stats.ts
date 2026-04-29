import type { SignalGraph } from "./types.js";

export interface GraphStats {
  events: number;
  entities: number;
  activeRelations: number;
  domains: string[];
  orphanNodes: number;
}

export function getGraphStats(graph: SignalGraph): GraphStats {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const connectedNodeIds = new Set<string>();
  const activeRelations = graph.edges.filter((edge) => {
    const valid = nodeIds.has(edge.source) && nodeIds.has(edge.target);
    if (valid) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
    return valid;
  });

  const nodeDomains = graph.nodes
    .map((node) => node.domain)
    .filter((domain): domain is string => Boolean(domain));
  const domains = [...new Set([...nodeDomains, ...graph.meta.domains])].sort();

  return {
    events: graph.nodes.filter((node) => node.type === "event").length,
    entities: graph.nodes.filter((node) => node.type === "entity").length,
    activeRelations: activeRelations.length,
    domains,
    orphanNodes: graph.nodes.filter((node) => !connectedNodeIds.has(node.id)).length,
  };
}

export function formatGraphStats(stats: GraphStats): string {
  const labelWidth = 17;
  const countWidth = 6;
  const countRow = (label: string, count: number) =>
    `${label.padEnd(labelWidth)} ${String(count).padStart(countWidth)}`;

  return [
    countRow("events:", stats.events),
    countRow("entities:", stats.entities),
    countRow("active relations:", stats.activeRelations),
    `${"domains:".padEnd(labelWidth)} ${stats.domains.join(", ") || "(none)"}`,
    countRow("orphan nodes:", stats.orphanNodes),
  ].join("\n");
}
