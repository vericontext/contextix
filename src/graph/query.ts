import type {
  GraphStore,
} from "./store.js";
import type {
  GraphNode,
  Relation,
  SignalEvent,
  CausalChain,
  CausalStep,
  ConnectionPath,
  SubGraph,
} from "./types.js";

/**
 * Trace causal chain backwards from an event.
 * Follows "causes", "caused_by", "influences", "precedes" edges.
 */
export async function traceCausalChain(
  store: GraphStore,
  eventQuery: string,
  maxDepth: number
): Promise<CausalChain> {
  const graph = await store.load();
  const startNode = findBestMatch(graph.nodes, eventQuery);

  if (!startNode || startNode.type !== "event") {
    return { query: eventQuery, depth: 0, chain: [] };
  }

  const chain: CausalStep[] = [];
  const visited = new Set<string>();
  const causalTypes = new Set(["causes", "caused_by", "influences", "precedes"]);

  async function dfs(nodeId: string, depth: number) {
    if (depth > maxDepth || visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = await store.getNode(nodeId);
    if (!node || node.type !== "event") return;

    // Get edges pointing TO this node (upstream causes)
    const inEdges = await store.getEdgesTo(nodeId);
    const causalEdges = inEdges.filter((e) => causalTypes.has(e.type));

    // Also check outgoing "caused_by" edges
    const outEdges = await store.getEdgesFrom(nodeId);
    const reverseCausal = outEdges.filter((e) => e.type === "caused_by");

    if (depth === 0) {
      chain.push({ event: node, relation: null, depth });
    }

    for (const edge of causalEdges) {
      const sourceNode = await store.getNode(edge.source);
      if (sourceNode?.type === "event" && !visited.has(sourceNode.id)) {
        chain.push({ event: sourceNode, relation: edge, depth: depth + 1 });
        await dfs(sourceNode.id, depth + 1);
      }
    }

    for (const edge of reverseCausal) {
      const targetNode = await store.getNode(edge.target);
      if (targetNode?.type === "event" && !visited.has(targetNode.id)) {
        chain.push({ event: targetNode, relation: edge, depth: depth + 1 });
        await dfs(targetNode.id, depth + 1);
      }
    }
  }

  await dfs(startNode.id, 0);

  return {
    query: eventQuery,
    depth: chain.length > 0 ? Math.max(...chain.map((c) => c.depth)) : 0,
    chain,
  };
}

/**
 * Find shortest connection paths between two topics/entities.
 * Bidirectional BFS on undirected view of the graph.
 */
export async function findConnections(
  store: GraphStore,
  fromQuery: string,
  toQuery: string,
  maxHops: number
): Promise<ConnectionPath> {
  const graph = await store.load();
  const fromNode = findBestMatch(graph.nodes, fromQuery);
  const toNode = findBestMatch(graph.nodes, toQuery);

  if (!fromNode || !toNode) {
    return { from: fromQuery, to: toQuery, paths: [], shortestHops: -1 };
  }

  // BFS from fromNode
  const queue: { nodeId: string; path: string[] }[] = [
    { nodeId: fromNode.id, path: [fromNode.id] },
  ];
  const visited = new Set<string>([fromNode.id]);
  const paths: GraphNode[][] = [];

  // Build adjacency for undirected traversal
  const adj = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, new Set());
    if (!adj.has(edge.target)) adj.set(edge.target, new Set());
    adj.get(edge.source)!.add(edge.target);
    adj.get(edge.target)!.add(edge.source);
  }

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!;

    if (path.length > maxHops + 1) break;

    if (nodeId === toNode.id && path.length > 1) {
      const nodePath = path
        .map((id) => graph.nodes.find((n) => n.id === id))
        .filter((n): n is GraphNode => n !== undefined);
      paths.push(nodePath);
      continue;
    }

    const neighbors = adj.get(nodeId) ?? new Set();
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ nodeId: neighborId, path: [...path, neighborId] });
      }
    }
  }

  return {
    from: fromQuery,
    to: toQuery,
    paths,
    shortestHops: paths.length > 0 ? paths[0].length - 1 : -1,
  };
}

/**
 * Extract a subgraph around a query within a given radius.
 */
export async function extractSubgraph(
  store: GraphStore,
  query: string,
  radius: number,
  maxNodes: number
): Promise<SubGraph> {
  const graph = await store.load();
  const centerNode = findBestMatch(graph.nodes, query);

  if (!centerNode) {
    return { query, radius, nodes: [], edges: [] };
  }

  // BFS to collect nodes within radius
  const nodeIds = new Set<string>([centerNode.id]);
  const queue: { id: string; depth: number }[] = [
    { id: centerNode.id, depth: 0 },
  ];

  // Build adjacency
  const adj = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, new Set());
    if (!adj.has(edge.target)) adj.set(edge.target, new Set());
    adj.get(edge.source)!.add(edge.target);
    adj.get(edge.target)!.add(edge.source);
  }

  while (queue.length > 0 && nodeIds.size < maxNodes) {
    const { id, depth } = queue.shift()!;
    if (depth >= radius) continue;

    const neighbors = adj.get(id) ?? new Set();
    for (const neighborId of neighbors) {
      if (!nodeIds.has(neighborId) && nodeIds.size < maxNodes) {
        nodeIds.add(neighborId);
        queue.push({ id: neighborId, depth: depth + 1 });
      }
    }
  }

  const nodes = graph.nodes.filter((n) => nodeIds.has(n.id));
  const edges = graph.edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  return { query, radius, nodes, edges };
}

/**
 * Fuzzy match a query string against graph nodes.
 * Matches against id, title/name, tags, and aliases.
 */
function findBestMatch(nodes: GraphNode[], query: string): GraphNode | undefined {
  const q = query.toLowerCase();

  // Exact ID match
  const exactId = nodes.find((n) => n.id === query);
  if (exactId) return exactId;

  // Score each node
  let bestNode: GraphNode | undefined;
  let bestScore = 0;

  for (const node of nodes) {
    let score = 0;

    if (node.type === "event") {
      if (node.title.toLowerCase().includes(q)) score += 10;
      if (node.description.toLowerCase().includes(q)) score += 5;
      for (const tag of node.tags) {
        if (tag.toLowerCase().includes(q)) score += 3;
      }
    } else {
      if (node.name.toLowerCase() === q) score += 20;
      if (node.name.toLowerCase().includes(q)) score += 10;
      for (const alias of node.aliases) {
        if (alias.toLowerCase() === q) score += 15;
        if (alias.toLowerCase().includes(q)) score += 5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestNode = node;
    }
  }

  return bestNode;
}
