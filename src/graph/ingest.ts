/**
 * Ingest pipeline output (graph fragments from analyst) into the signal graph.
 * Usage: node dist/index.js ingest <insights-dir> <output-graph.json>
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import type { SignalGraph, GraphNode, Relation } from "./types.js";

interface GraphFragment {
  events?: GraphNode[];
  entities?: GraphNode[];
  relations?: Relation[];
  summary?: string;
}

export async function runIngest(insightsDir: string, outputPath: string): Promise<void> {
  if (!existsSync(insightsDir)) {
    console.error(`Insights directory not found: ${insightsDir}`);
    process.exit(1);
  }

  // Read all JSON files from insights directory
  const files = readdirSync(insightsDir).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.error(`No JSON files found in ${insightsDir}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} graph fragment(s) to ingest`);

  const allNodes: GraphNode[] = [];
  const allEdges: Relation[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  for (const file of files) {
    const filePath = resolve(insightsDir, file);
    try {
      const raw = readFileSync(filePath, "utf-8");
      const fragment: GraphFragment = JSON.parse(raw);

      // Add events
      if (fragment.events) {
        for (const event of fragment.events) {
          if (!nodeIds.has(event.id)) {
            allNodes.push(event);
            nodeIds.add(event.id);
          }
        }
      }

      // Add entities
      if (fragment.entities) {
        for (const entity of fragment.entities) {
          const normalizedId = entity.id.toLowerCase().replace(/\s+/g, "_");
          entity.id = normalizedId;
          if (!nodeIds.has(normalizedId)) {
            allNodes.push(entity);
            nodeIds.add(normalizedId);
          }
        }
      }

      // Add relations
      if (fragment.relations) {
        for (const relation of fragment.relations) {
          // Normalize IDs
          relation.source = relation.source.toLowerCase().replace(/\s+/g, "_");
          relation.target = relation.target.toLowerCase().replace(/\s+/g, "_");

          if (!edgeIds.has(relation.id)) {
            allEdges.push(relation);
            edgeIds.add(relation.id);
          }
        }
      }

      console.log(`  ${file}: ${fragment.events?.length ?? 0} events, ${fragment.entities?.length ?? 0} entities, ${fragment.relations?.length ?? 0} relations`);
    } catch (err) {
      console.error(`  ${file}: SKIPPED (parse error)`);
    }
  }

  // Remove relations with broken references
  const validEdges = allEdges.filter((e) => {
    const hasSource = nodeIds.has(e.source);
    const hasTarget = nodeIds.has(e.target);
    if (!hasSource || !hasTarget) {
      console.warn(`  Removed broken relation: ${e.source} → ${e.target} (missing ${!hasSource ? "source" : "target"})`);
    }
    return hasSource && hasTarget;
  });

  // Compute time range
  const eventDates = allNodes
    .filter((n) => n.type === "event" && "detectedAt" in n)
    .map((n) => (n as any).detectedAt as string)
    .filter(Boolean)
    .sort();

  const domains = [...new Set(allNodes.map((n) => n.domain))];

  // Load existing graph if present
  let existingGraph: SignalGraph | null = null;
  if (existsSync(outputPath)) {
    try {
      existingGraph = JSON.parse(readFileSync(outputPath, "utf-8")) as SignalGraph;
    } catch {
      // Start fresh
    }
  }

  // Merge with existing
  if (existingGraph && existingGraph.nodes.length > 0) {
    for (const node of existingGraph.nodes) {
      if (!nodeIds.has(node.id)) {
        allNodes.push(node);
        nodeIds.add(node.id);
      }
    }
    for (const edge of existingGraph.edges) {
      if (!edgeIds.has(edge.id) && nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        validEdges.push(edge);
        edgeIds.add(edge.id);
      }
    }
  }

  const graph: SignalGraph = {
    nodes: allNodes,
    edges: validEdges,
    meta: {
      domains,
      timeRange: {
        from: eventDates[0] ?? "",
        to: eventDates[eventDates.length - 1] ?? "",
      },
      nodeCount: allNodes.length,
      edgeCount: validEdges.length,
      generatedAt: new Date().toISOString(),
    },
  };

  // Write output
  const outDir = dirname(outputPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  writeFileSync(outputPath, JSON.stringify(graph, null, 2));

  console.log(`\nGraph written to ${outputPath}`);
  console.log(`  Nodes: ${graph.meta.nodeCount} (${allNodes.filter((n) => n.type === "event").length} events, ${allNodes.filter((n) => n.type === "entity").length} entities)`);
  console.log(`  Edges: ${graph.meta.edgeCount}`);
  console.log(`  Domains: ${domains.join(", ")}`);
}
