/** A detected real-world event */
export interface SignalEvent {
  id: string;
  type: "event";
  domain: string;
  title: string;
  description: string;
  detectedAt: string;
  importance: "low" | "medium" | "high" | "critical";
  confidence: number;
  sources: Source[];
  tags: string[];
  data?: Record<string, unknown>;
}

/** A real-world entity referenced by events */
export interface Entity {
  id: string;
  type: "entity";
  entityType: EntityType;
  name: string;
  aliases: string[];
  domain: string;
  metadata?: Record<string, unknown>;
  firstSeen: string;
  lastSeen: string;
}

export type EntityType =
  | "person"
  | "organization"
  | "token"
  | "protocol"
  | "indicator"
  | "policy"
  | "location"
  | "concept"
  | "model";

/** A typed, weighted edge between two graph nodes */
export interface Relation {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  label: string;
  confidence: number;
  evidence: string;
  detectedAt: string;
  metadata?: Record<string, unknown>;
}

export type RelationType =
  | "causes"
  | "caused_by"
  | "correlates"
  | "involves"
  | "influences"
  | "related_to"
  | "precedes"
  | "contradicts";

export type GraphNode = SignalEvent | Entity;

export interface SignalGraph {
  nodes: GraphNode[];
  edges: Relation[];
  meta: GraphMeta;
}

export interface GraphMeta {
  domains: string[];
  timeRange: { from: string; to: string };
  nodeCount: number;
  edgeCount: number;
  generatedAt: string;
}

export interface Source {
  name: string;
  url: string;
  publishedDate?: string;
  description?: string;
}

// -- Query result types --

export interface CausalChain {
  query: string;
  depth: number;
  chain: CausalStep[];
}

export interface CausalStep {
  event: SignalEvent;
  relation: Relation | null;
  depth: number;
}

export interface ConnectionPath {
  from: string;
  to: string;
  paths: GraphNode[][];
  shortestHops: number;
}

export interface SubGraph {
  query: string;
  radius: number;
  nodes: GraphNode[];
  edges: Relation[];
}
