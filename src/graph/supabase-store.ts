/**
 * SupabaseStore — hosted graph backend.
 * Reads signal_events, entities, relations from Supabase.
 * Used when CONTEXTIX_SUPABASE_URL + CONTEXTIX_SUPABASE_KEY are set.
 */

import type { GraphStore } from "./store.js";
import type {
  SignalGraph,
  GraphNode,
  Relation,
  SignalEvent,
  Entity,
} from "./types.js";

// Lazy dynamic import to avoid bundling @supabase/supabase-js in the default build
async function createClient(url: string, key: string) {
  const mod = await import("@supabase/supabase-js");
  return mod.createClient(url, key);
}

export class SupabaseStore implements GraphStore {
  private url: string;
  private key: string;
  private _client: Awaited<ReturnType<typeof createClient>> | null = null;

  constructor(url: string, key: string) {
    this.url = url;
    this.key = key;
  }

  private async client() {
    if (!this._client) {
      this._client = await createClient(this.url, this.key);
    }
    return this._client;
  }

  async load(): Promise<SignalGraph> {
    // Load full graph (capped for MCP usage)
    const [events, entities, relations] = await Promise.all([
      this.getAllEvents({ limit: 500 }),
      this.getAllEntities({ limit: 500 }),
      this._getRelations(2000),
    ]);

    const nodes: GraphNode[] = [...events, ...entities];
    const nodeIds = new Set(nodes.map((n) => n.id));
    const validEdges = relations.filter(
      (r) => nodeIds.has(r.source) && nodeIds.has(r.target)
    );

    return {
      nodes,
      edges: validEdges,
      meta: {
        domains: [...new Set(nodes.map((n) => n.domain))],
        timeRange: {
          from: events[events.length - 1]?.detectedAt ?? "",
          to: events[0]?.detectedAt ?? "",
        },
        nodeCount: nodes.length,
        edgeCount: validEdges.length,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async save(_graph: SignalGraph): Promise<void> {
    // Read-only in hosted mode — writes go through sync-graph-to-supabase.mjs
    throw new Error("SupabaseStore is read-only. Use sync-graph-to-supabase.mjs to write.");
  }

  async addNodes(_nodes: GraphNode[]): Promise<void> {
    throw new Error("SupabaseStore is read-only.");
  }

  async addEdges(_edges: Relation[]): Promise<void> {
    throw new Error("SupabaseStore is read-only.");
  }

  async getNode(id: string): Promise<GraphNode | undefined> {
    const sb = await this.client();

    const { data: event } = await sb
      .from("signal_events")
      .select("*")
      .eq("id", id)
      .single();

    if (event) return rowToEvent(event);

    const { data: entity } = await sb
      .from("entities")
      .select("*")
      .eq("id", id)
      .single();

    return entity ? rowToEntity(entity) : undefined;
  }

  async getEdgesFrom(nodeId: string): Promise<Relation[]> {
    const sb = await this.client();
    const { data } = await sb
      .from("relations")
      .select("*")
      .eq("source_id", nodeId)
      .is("valid_until", null)
      .order("confidence", { ascending: false })
      .limit(50);
    return (data ?? []).map(rowToRelation);
  }

  async getEdgesTo(nodeId: string): Promise<Relation[]> {
    const sb = await this.client();
    const { data } = await sb
      .from("relations")
      .select("*")
      .eq("target_id", nodeId)
      .is("valid_until", null)
      .order("confidence", { ascending: false })
      .limit(50);
    return (data ?? []).map(rowToRelation);
  }

  async getAllEvents(opts?: {
    domain?: string;
    since?: string;
    limit?: number;
  }): Promise<SignalEvent[]> {
    const sb = await this.client();
    let q = sb
      .from("signal_events")
      .select("*")
      .order("detected_at", { ascending: false });

    if (opts?.domain) q = q.eq("domain", opts.domain);
    if (opts?.since) q = q.gte("detected_at", opts.since);
    if (opts?.limit) q = q.limit(opts.limit);

    const { data } = await q;
    return (data ?? []).map(rowToEvent);
  }

  async getAllEntities(opts?: {
    type?: string;
    query?: string;
    limit?: number;
  }): Promise<Entity[]> {
    const sb = await this.client();
    // merged_into IS NULL: only return canonical entities, not merged aliases
    let q = sb.from("entities").select("*").is("merged_into", null).order("last_seen", { ascending: false });

    if (opts?.type && opts.type !== "any") q = q.eq("entity_type", opts.type);
    if (opts?.query) q = q.ilike("name", `%${opts.query}%`);
    if (opts?.limit) q = q.limit(opts.limit);

    const { data } = await q;
    return (data ?? []).map(rowToEntity);
  }

  private async _getRelations(limit = 1000): Promise<Relation[]> {
    const sb = await this.client();
    const { data } = await sb
      .from("relations")
      .select("*")
      .is("valid_until", null)
      .order("confidence", { ascending: false })
      .limit(limit);
    return (data ?? []).map(rowToRelation);
  }
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function rowToEvent(row: Record<string, unknown>): SignalEvent {
  return {
    id: row.id as string,
    type: "event",
    domain: row.domain as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    detectedAt: row.detected_at as string,
    importance: (row.importance as SignalEvent["importance"]) ?? "medium",
    confidence: (row.confidence as number) ?? 0.7,
    sources: (row.sources as SignalEvent["sources"]) ?? [],
    tags: (row.tags as string[]) ?? [],
    data: (row.data as Record<string, unknown>) ?? {},
  };
}

function rowToEntity(row: Record<string, unknown>): Entity {
  return {
    id: row.id as string,
    type: "entity",
    entityType: row.entity_type as Entity["entityType"],
    name: row.name as string,
    aliases: (row.aliases as string[]) ?? [],
    domain: row.domain as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    firstSeen: (row.first_seen as string) ?? new Date().toISOString(),
    lastSeen: (row.last_seen as string) ?? new Date().toISOString(),
  };
}

function rowToRelation(row: Record<string, unknown>): Relation {
  return {
    id: row.id as string,
    source: row.source_id as string,
    target: row.target_id as string,
    type: row.relation_type as Relation["type"],
    label: (row.label as string) ?? "",
    confidence: (row.confidence as number) ?? 0.7,
    evidence: (row.evidence as string) ?? "",
    detectedAt: (row.detected_at as string) ?? new Date().toISOString(),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}
