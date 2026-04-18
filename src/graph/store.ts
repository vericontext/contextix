import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import type { SignalGraph, GraphNode, Relation, SignalEvent, Entity } from "./types.js";

export interface GraphStore {
  load(): Promise<SignalGraph>;
  save(graph: SignalGraph): Promise<void>;
  addNodes(nodes: GraphNode[]): Promise<void>;
  addEdges(edges: Relation[]): Promise<void>;
  getNode(id: string): Promise<GraphNode | undefined>;
  getEdgesFrom(nodeId: string): Promise<Relation[]>;
  getEdgesTo(nodeId: string): Promise<Relation[]>;
  getAllEvents(opts?: { domain?: string; since?: string; limit?: number }): Promise<SignalEvent[]>;
  getAllEntities(opts?: { type?: string; query?: string; limit?: number }): Promise<Entity[]>;
}

export class LocalJsonStore implements GraphStore {
  private graph: SignalGraph;
  private filePath: string;
  private loaded = false;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.graph = emptyGraph();
  }

  async load(): Promise<SignalGraph> {
    if (this.loaded) return this.graph;

    if (existsSync(this.filePath)) {
      const raw = readFileSync(this.filePath, "utf-8");
      this.graph = JSON.parse(raw) as SignalGraph;
    } else {
      // Load seed data bundled with the package
      this.graph = loadSeedData();
      await this.save(this.graph);
    }
    this.loaded = true;
    return this.graph;
  }

  async save(graph: SignalGraph): Promise<void> {
    this.graph = graph;
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(graph, null, 2));
  }

  async addNodes(nodes: GraphNode[]): Promise<void> {
    await this.load();
    const existingIds = new Set(this.graph.nodes.map((n) => n.id));
    for (const node of nodes) {
      if (!existingIds.has(node.id)) {
        this.graph.nodes.push(node);
        existingIds.add(node.id);
      }
    }
    this.graph.meta.nodeCount = this.graph.nodes.length;
    await this.save(this.graph);
  }

  async addEdges(edges: Relation[]): Promise<void> {
    await this.load();
    const existingIds = new Set(this.graph.edges.map((e) => e.id));
    for (const edge of edges) {
      if (!existingIds.has(edge.id)) {
        this.graph.edges.push(edge);
        existingIds.add(edge.id);
      }
    }
    this.graph.meta.edgeCount = this.graph.edges.length;
    await this.save(this.graph);
  }

  async getNode(id: string): Promise<GraphNode | undefined> {
    await this.load();
    return this.graph.nodes.find((n) => n.id === id);
  }

  async getEdgesFrom(nodeId: string): Promise<Relation[]> {
    await this.load();
    return this.graph.edges.filter((e) => e.source === nodeId);
  }

  async getEdgesTo(nodeId: string): Promise<Relation[]> {
    await this.load();
    return this.graph.edges.filter((e) => e.target === nodeId);
  }

  async getAllEvents(opts?: {
    domain?: string;
    since?: string;
    limit?: number;
  }): Promise<SignalEvent[]> {
    await this.load();
    let events = this.graph.nodes.filter(
      (n): n is SignalEvent => n.type === "event"
    );

    if (opts?.domain) {
      events = events.filter((e) => e.domain === opts.domain);
    }
    if (opts?.since) {
      const since = new Date(opts.since).getTime();
      events = events.filter((e) => new Date(e.detectedAt).getTime() >= since);
    }

    events.sort(
      (a, b) =>
        new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );

    if (opts?.limit) {
      events = events.slice(0, opts.limit);
    }

    return events;
  }

  async getAllEntities(opts?: {
    type?: string;
    query?: string;
    limit?: number;
  }): Promise<Entity[]> {
    await this.load();
    let entities = this.graph.nodes.filter(
      (n): n is Entity => n.type === "entity"
    );

    if (opts?.type && opts.type !== "any") {
      entities = entities.filter((e) => e.entityType === opts.type);
    }
    if (opts?.query) {
      const q = opts.query.toLowerCase();
      entities = entities.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.aliases.some((a) => a.toLowerCase().includes(q))
      );
    }
    if (opts?.limit) {
      entities = entities.slice(0, opts.limit);
    }

    return entities;
  }
}

function emptyGraph(): SignalGraph {
  return {
    nodes: [],
    edges: [],
    meta: {
      domains: [],
      timeRange: { from: "", to: "" },
      nodeCount: 0,
      edgeCount: 0,
      generatedAt: new Date().toISOString(),
    },
  };
}

function loadSeedData(): SignalGraph {
  // Try multiple possible locations for seed data
  const candidates = [
    resolve(process.cwd(), "packages/mcp/data/seed-graph.json"),
    resolve(process.cwd(), "data/seed-graph.json"),
  ];

  try {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(thisDir, "../../data/seed-graph.json"));
    candidates.push(resolve(thisDir, "../data/seed-graph.json"));
  } catch {
    // import.meta.url may not resolve in bundled code
  }

  for (const seedPath of candidates) {
    if (existsSync(seedPath)) {
      try {
        const raw = readFileSync(seedPath, "utf-8");
        return JSON.parse(raw) as SignalGraph;
      } catch {
        continue;
      }
    }
  }

  return emptyGraph();
}
