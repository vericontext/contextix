import type { SubGraph, GraphNode, Relation } from "../graph/types.js";

/**
 * Render a SubGraph as a Mermaid flowchart.
 *
 * Node labels use the entity name / event title so the diagram reads like the
 * underlying graph instead of exposing raw ids. Edge labels carry the relation
 * type. Node ids are sanitized to valid Mermaid identifiers (alphanumeric +
 * underscore, non-conflicting per-subgraph).
 */
export function renderMermaid(sub: SubGraph): string {
  const lines: string[] = ["graph LR"];

  const aliasFor = buildIdAliasMap(sub.nodes);

  for (const node of sub.nodes) {
    const label = labelFor(node);
    lines.push(`  ${aliasFor.get(node.id)}["${escapeLabel(label)}"]`);
  }

  for (const edge of sub.edges) {
    const from = aliasFor.get(edge.source);
    const to = aliasFor.get(edge.target);
    if (!from || !to) continue;
    lines.push(`  ${from} -->|${escapeLabel(edge.type)}| ${to}`);
  }

  return lines.join("\n") + "\n";
}

function buildIdAliasMap(nodes: GraphNode[]): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();
  for (const node of nodes) {
    let alias = sanitizeAlias(node.id);
    if (!alias) alias = "n";
    let candidate = alias;
    let i = 2;
    while (used.has(candidate)) {
      candidate = `${alias}_${i++}`;
    }
    used.add(candidate);
    map.set(node.id, candidate);
  }
  return map;
}

function sanitizeAlias(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^(\d)/, "n$1");
}

function labelFor(node: GraphNode): string {
  if (node.type === "entity") return node.name;
  return node.title;
}

function escapeLabel(text: string): string {
  // Mermaid supports double-quoted labels; escape embedded quotes with &quot;.
  return text.replace(/"/g, "&quot;");
}
