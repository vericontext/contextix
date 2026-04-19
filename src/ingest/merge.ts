import type { GraphStore } from "../graph/store.js";
import type { Entity, Relation, SignalEvent } from "../graph/types.js";

export interface GraphFragment {
  events?: SignalEvent[];
  entities?: Entity[];
  relations?: Relation[];
  summary?: string;
}

export interface MergeResult {
  eventsAdded: number;
  entitiesAdded: number;
  relationsAdded: number;
  relationsDropped: number;
}

/**
 * Apply a GraphFragment to the store. Dedups by id, drops relations with unresolved endpoints.
 * Entities are canonicalized on id (lowercase + underscore).
 */
export async function applyFragment(
  fragment: GraphFragment,
  store: GraphStore
): Promise<MergeResult> {
  const events = fragment.events ?? [];
  const entities = (fragment.entities ?? []).map(normalizeEntity);

  const nodeIds = new Set<string>([...events.map((e) => e.id), ...entities.map((e) => e.id)]);

  await store.load();
  // existing nodes count toward valid endpoints
  const existingEvents = await store.getAllEvents();
  const existingEntities = await store.getAllEntities();
  for (const e of existingEvents) nodeIds.add(e.id);
  for (const e of existingEntities) nodeIds.add(e.id);

  const validRelations: Relation[] = [];
  const dropped: Relation[] = [];
  for (const rel of fragment.relations ?? []) {
    const normalized: Relation = {
      ...rel,
      source: normalizeId(rel.source),
      target: normalizeId(rel.target),
    };
    if (nodeIds.has(normalized.source) && nodeIds.has(normalized.target)) {
      validRelations.push(normalized);
    } else {
      dropped.push(normalized);
    }
  }

  await store.addNodes([...events, ...entities]);
  await store.addEdges(validRelations);

  return {
    eventsAdded: events.length,
    entitiesAdded: entities.length,
    relationsAdded: validRelations.length,
    relationsDropped: dropped.length,
  };
}

function normalizeEntity(e: Entity): Entity {
  return { ...e, id: normalizeId(e.id) };
}

function normalizeId(id: string): string {
  return id.toLowerCase().replace(/\s+/g, "_");
}
